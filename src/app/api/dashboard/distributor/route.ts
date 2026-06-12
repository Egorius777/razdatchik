import { prisma } from "@/lib/db";
import { jsonError, requireDistributor } from "@/lib/auth";
import { sumDecimals } from "@/lib/money";
import { getWeekBounds, serializeBigInt } from "@/lib/utils";

export async function GET() {
  try {
    const auth = await requireDistributor();
    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
    });
    if (!workspace) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { start, end } = getWeekBounds(new Date(), workspace.settlementWeekday);

    const [payments, lessons, payouts, tutorsCount, studentsCount] = await Promise.all([
      prisma.payment.findMany({
        where: {
          workspaceId: auth.workspaceId,
          reportedAt: { gte: start, lte: end },
        },
        include: { student: { select: { name: true } } },
        orderBy: { reportedAt: "desc" },
      }),
      prisma.lesson.findMany({
        where: {
          workspaceId: auth.workspaceId,
          status: "Done",
          scheduledAt: { gte: start, lte: end },
        },
      }),
      prisma.payout.findMany({
        where: {
          workspaceId: auth.workspaceId,
          periodStart: start,
        },
      }),
      prisma.membership.count({
        where: { workspaceId: auth.workspaceId, role: "Tutor", status: "Active" },
      }),
      prisma.student.count({ where: { workspaceId: auth.workspaceId } }),
    ]);

    const incomingConfirmed = payments.filter((p) => p.status === "Confirmed");
    const incomingReported = payments.filter((p) => p.status === "Reported");
    const commissionTotal = sumDecimals(lessons.map((l) => l.commissionAmount));
    const payoutPending = payouts.filter((p) => p.status === "Pending");

    return Response.json(
      serializeBigInt({
        weekStart: start,
        weekEnd: end,
        kpis: {
          tutorsCount,
          studentsCount,
          lessonsDone: lessons.length,
          commissionTotal: commissionTotal.toFixed(0),
          incomingReported: incomingReported.length,
          incomingConfirmed: incomingConfirmed.length,
          payoutPending: payoutPending.length,
        },
        payments,
        payouts,
      })
    );
  } catch (error) {
    return jsonError(error);
  }
}
