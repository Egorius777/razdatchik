import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireAuth } from "@/lib/auth";
import {
  addDays,
  ensureWeekLessons,
  formatDateKey,
  getWeekEnd,
  normalizeWeekStart,
  parseWeekStart,
  WEEKDAY_LABELS,
} from "@/lib/schedule";
import { getWeekBounds, serializeBigInt } from "@/lib/utils";

function resolveTutorId(
  auth: Awaited<ReturnType<typeof requireAuth>>,
  tutorIdParam: string | null
): string {
  if (auth.role === "Tutor") {
    return auth.userId;
  }
  if (!tutorIdParam) {
    throw new Error("tutorId required for distributor");
  }
  return tutorIdParam;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const weekStartParam = url.searchParams.get("weekStart");

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: auth.workspaceId },
      select: { settlementWeekday: true },
    });

    const rawWeekStart = weekStartParam
      ? parseWeekStart(weekStartParam)
      : getWeekBounds(new Date(), workspace.settlementWeekday).start;

    const weekStart = normalizeWeekStart(rawWeekStart, workspace.settlementWeekday);

    let tutorId: string;
    try {
      tutorId = resolveTutorId(auth, url.searchParams.get("tutorId"));
    } catch {
      return Response.json({ error: "tutorId required" }, { status: 400 });
    }

    if (auth.role === "Distributor") {
      const membership = await prisma.membership.findFirst({
        where: { workspaceId: auth.workspaceId, userId: tutorId, role: "Tutor", status: "Active" },
      });
      if (!membership) {
        return Response.json({ error: "Tutor not found" }, { status: 404 });
      }
    }

    await ensureWeekLessons(auth.workspaceId, tutorId, weekStart, auth.userId);

    const weekEnd = getWeekEnd(weekStart);
    const lessons = await prisma.lesson.findMany({
      where: {
        workspaceId: auth.workspaceId,
        tutorId,
        scheduledAt: { gte: weekStart, lte: weekEnd },
      },
      include: {
        student: { select: { name: true } },
        scheduleSlot: { select: { durationMin: true } },
        payments: {
          include: {
            payment: { select: { status: true, reportedAt: true } },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    });

    function resolvePaymentStatus(
      links: Array<{ payment: { status: string; reportedAt: Date } }>
    ): "none" | "Reported" | "Confirmed" | "Disputed" {
      if (links.length === 0) return "none";
      const sorted = [...links].sort(
        (a, b) => b.payment.reportedAt.getTime() - a.payment.reportedAt.getTime()
      );
      const status = sorted[0].payment.status;
      if (status === "Confirmed" || status === "Reported" || status === "Disputed") {
        return status;
      }
      return "none";
    }

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const dateKey = formatDateKey(date);
      const dayLessons = lessons
        .filter((lesson) => formatDateKey(lesson.scheduledAt) === dateKey)
        .map((lesson) => ({
          id: lesson.id,
          scheduledAt: lesson.scheduledAt.toISOString(),
          studentName: lesson.student.name,
          studentId: lesson.studentId,
          status: lesson.status,
          price: lesson.price.toString(),
          durationMin: lesson.scheduleSlot?.durationMin ?? 60,
          paymentStatus: resolvePaymentStatus(lesson.payments),
        }));

      return {
        weekday: index + 1,
        label: WEEKDAY_LABELS[index],
        date: dateKey,
        lessons: dayLessons,
      };
    });

    return Response.json(
      serializeBigInt({
        weekStart: formatDateKey(weekStart),
        weekEnd: formatDateKey(weekEnd),
        days,
      })
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid weekStart")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return jsonError(error);
  }
}
