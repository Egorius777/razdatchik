import { prisma } from "@/lib/db";
import { jsonError, requireDistributor } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = await requireDistributor();
    const url = new URL(request.url);
    const periodStart = url.searchParams.get("periodStart");

    const payouts = await prisma.payout.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(periodStart ? { periodStart: new Date(periodStart) } : {}),
      },
      orderBy: { periodStart: "desc" },
    });

    const header = "periodStart,periodEnd,tutorId,gross,commissionTotal,netAmount,lessonCount,status\n";
    const rows = payouts
      .map(
        (p) =>
          `${p.periodStart.toISOString().slice(0, 10)},${p.periodEnd.toISOString().slice(0, 10)},${p.tutorId},${p.gross},${p.commissionTotal},${p.netAmount},${p.lessonCount},${p.status}`
      )
      .join("\n");

    return new Response(header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="payouts.csv"',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
