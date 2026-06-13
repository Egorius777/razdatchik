import { prisma } from "./db";
import { buildLessonCreateData } from "./settlement";
import { getWeekBounds } from "./utils";

export function parseWeekStart(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error("Invalid weekStart format, expected YYYY-MM-DD");
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayDateKey(): string {
  return formatDateKey(new Date());
}

/** Always returns the settlement-week start (e.g. Monday) containing `date`. */
export function normalizeWeekStart(date: Date, settlementWeekday = 1): Date {
  return getWeekBounds(date, settlementWeekday).start;
}

export function shiftWeekDateKey(weekStartKey: string, deltaWeeks: number): string {
  const date = parseWeekStart(weekStartKey);
  return formatDateKey(addDays(date, deltaWeeks * 7));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function parseStartTime(startTime: string, date: Date): Date {
  const [hours, minutes] = startTime.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function slotLessonKey(scheduleSlotId: string, date: Date): string {
  return `${scheduleSlotId}:${formatDateKey(date)}`;
}

export function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getWeekEnd(weekStart: Date): Date {
  const end = addDays(weekStart, 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function lessonDateForSlot(weekStart: Date, weekday: number): Date {
  return addDays(weekStart, weekday - 1);
}

export async function ensureWeekLessons(
  workspaceId: string,
  tutorId: string,
  weekStart: Date,
  createdById: string
): Promise<void> {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { settlementWeekday: true },
  });

  const normalizedWeekStart = normalizeWeekStart(weekStart, workspace.settlementWeekday);
  const currentWeek = getWeekBounds(new Date(), workspace.settlementWeekday);

  if (normalizedWeekStart < currentWeek.start) {
    return;
  }

  const slots = await prisma.scheduleSlot.findMany({
    where: { workspaceId, tutorId, isActive: true },
    include: { student: true },
  });

  if (slots.length === 0) {
    return;
  }

  for (const slot of slots) {
    const lessonDate = lessonDateForSlot(normalizedWeekStart, slot.weekday);
    const scheduledAt = parseStartTime(slot.startTime, lessonDate);
    const { start: dayStart, end: dayEnd } = getDayBounds(lessonDate);

    const existing = await prisma.lesson.findFirst({
      where: {
        workspaceId,
        tutorId,
        scheduleSlotId: slot.id,
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
    });
    if (existing) {
      continue;
    }

    const data = {
      ...buildLessonCreateData(slot.student, {
        workspaceId,
        studentId: slot.studentId,
        tutorId: slot.tutorId,
        scheduledAt,
        status: "Planned",
        createdById,
      }),
      scheduleSlotId: slot.id,
    };

    await prisma.lesson.create({ data });
  }
}

export const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const start = weekStart.toLocaleDateString("ru-RU", opts);
  const end = weekEnd.toLocaleDateString("ru-RU", { ...opts, year: "numeric" });
  return `${start} – ${end}`;
}
