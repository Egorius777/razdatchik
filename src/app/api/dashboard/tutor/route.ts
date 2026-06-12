import { prisma } from "@/lib/db";
import { jsonError, requireAuth } from "@/lib/auth";
import { sumDecimals } from "@/lib/money";
import { getWeekBounds, serializeBigInt, tutorScope } from "@/lib/utils";

export async function GET() {
  try {
    const auth = await requireAuth();
    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
    });
    if (!workspace) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { start, end } = getWeekBounds(new Date(), workspace.settlementWeekday);

    const lessons = await prisma.lesson.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...tutorScope(auth),
        scheduledAt: { gte: start, lte: end },
      },
    });

    const doneLessons = lessons.filter((l) => l.status === "Done");
    const weekEarnings = sumDecimals(doneLessons.map((l) => l.tutorAmount));

    const pendingPayments = await prisma.payment.count({
      where: {
        workspaceId: auth.workspaceId,
        ...tutorScope(auth),
        status: "Reported",
      },
    });

    return Response.json(
      serializeBigInt({
        weekStart: start,
        weekEnd: end,
        lessonsTotal: lessons.length,
        lessonsDone: doneLessons.length,
        weekEarnings: weekEarnings.toFixed(0),
        pendingConfirmations: pendingPayments,
        recentLessons: lessons.slice(0, 10),
      })
    );
  } catch (error) {
    return jsonError(error);
  }
}
