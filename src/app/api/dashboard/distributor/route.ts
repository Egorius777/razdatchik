import { prisma } from "@/lib/db";
import { jsonError, requireDistributor } from "@/lib/auth";
import { attachTutorToPayouts } from "@/lib/members";
import { sumDecimals } from "@/lib/money";
import { getPreviousWeekBounds, getWeekBounds, serializeBigInt } from "@/lib/utils";

export async function GET() {
  try {
    const auth = await requireDistributor();
    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
    });
    if (!workspace) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }

    const now = new Date();
    const { start, end } = getWeekBounds(now, workspace.settlementWeekday);
    const payoutPeriod = getPreviousWeekBounds(now, workspace.settlementWeekday);

    const [payments, lessons, pendingPayouts, tutorsCount, studentsCount] = await Promise.all([
      prisma.payment.findMany({
        where: {
          workspaceId: auth.workspaceId,
          reportedAt: { gte: start, lte: end },
        },
        include: {
          student: {
            select: {
              name: true,
              payerName: true,
              tutor: { select: { id: true, firstName: true, lastName: true, username: true } },
            },
          },
        },
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
          status: "Pending",
        },
        orderBy: [{ periodStart: "desc" }, { tutorId: "asc" }],
      }),
      prisma.membership.count({
        where: { workspaceId: auth.workspaceId, role: "Tutor", status: "Active" },
      }),
      prisma.student.count({ where: { workspaceId: auth.workspaceId } }),
    ]);

    const incomingConfirmed = payments.filter((p) => p.status === "Confirmed");
    const incomingReported = payments.filter((p) => p.status === "Reported");
    const commissionTotal = sumDecimals(lessons.map((l) => l.commissionAmount));
    const payoutPendingSum = sumDecimals(pendingPayouts.map((p) => p.netAmount));
    const payoutsWithTutors = await attachTutorToPayouts(pendingPayouts);

    const currentPeriodPayouts = payoutsWithTutors.filter(
      (p) => new Date(p.periodStart).getTime() === payoutPeriod.start.getTime()
    );

    return Response.json(
      serializeBigInt({
        weekStart: start,
        weekEnd: end,
        payoutPeriodStart: payoutPeriod.start,
        payoutPeriodEnd: payoutPeriod.end,
        kpis: {
          tutorsCount,
          studentsCount,
          lessonsDone: lessons.length,
          commissionTotal: commissionTotal.toFixed(0),
          incomingReported: incomingReported.length,
          incomingConfirmed: incomingConfirmed.length,
          payoutPending: pendingPayouts.length,
          payoutPendingSum: payoutPendingSum.toFixed(0),
        },
        payments,
        payouts: payoutsWithTutors,
        currentPeriodPayouts,
      })
    );
  } catch (error) {
    return jsonError(error);
  }
}
