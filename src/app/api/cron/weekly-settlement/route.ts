import { prisma } from "@/lib/db";
import { Bot } from "grammy";
import { upsertWeeklyPayouts } from "@/lib/settlement";
import { getBotToken } from "@/lib/telegram";
import { formatRub } from "@/lib/money";
import { serializeBigInt } from "@/lib/utils";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret;
}

export async function POST(request: Request) {
  if (!verifyCron(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const workspaces = await prisma.workspace.findMany({
    include: {
      owner: true,
      memberships: {
        where: { status: "Active", role: "Tutor" },
        include: { user: true },
      },
    },
  });

  const bot = new Bot(getBotToken());
  const results = [];

  for (const ws of workspaces) {
    const settlement = await upsertWeeklyPayouts(ws.id, ws.settlementWeekday);

    const payments = await prisma.payment.findMany({
      where: {
        workspaceId: ws.id,
        reportedAt: { gte: settlement.periodStart, lte: settlement.periodEnd },
      },
    });

    const confirmed = payments.filter((p) => p.status === "Confirmed").length;
    const reported = payments.filter((p) => p.status === "Reported").length;

    const payoutLines = settlement.payouts
      .map((p) => `• ${p.tutorId.slice(0, 6)}… → ${formatRub(p.netAmount.toString())}`)
      .join("\n");

    const ownerMsg =
      `📊 Недельная сводка «${ws.name}»\n` +
      `Период: ${settlement.periodStart.toLocaleDateString("ru-RU")} — ${settlement.periodEnd.toLocaleDateString("ru-RU")}\n\n` +
      `Входящие: подтверждено ${confirmed}, ожидает ${reported}\n\n` +
      `К выплате:\n${payoutLines || "—"}`;

    try {
      await bot.api.sendMessage(Number(ws.owner.telegramId), ownerMsg);
    } catch (e) {
      console.error("Failed to notify owner", e);
    }

    for (const payout of settlement.payouts) {
      const tutorMembership = ws.memberships.find((m) => m.userId === payout.tutorId);
      if (!tutorMembership) continue;
      try {
        await bot.api.sendMessage(
          Number(tutorMembership.user.telegramId),
          `💰 Ваш заработок за неделю: ${formatRub(payout.netAmount.toString())}\nУроков: ${payout.lessonCount}`
        );
      } catch (e) {
        console.error("Failed to notify tutor", e);
      }
    }

    results.push({ workspaceId: ws.id, payouts: settlement.payouts.length });
  }

  return Response.json(serializeBigInt({ ok: true, results }));
}
