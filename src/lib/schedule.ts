import { DateTime } from "luxon";
import { prisma } from "./db";
import { buildLessonCreateData } from "./settlement";
import { getWeekBounds } from "./utils";

export const DEFAULT_TIMEZONE = "Europe/Moscow";

export function resolveTimezone(tz: string | null | undefined): string {
  return tz && tz.length > 0 ? tz : DEFAULT_TIMEZONE;
}

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

export function todayDateKey(timezone = DEFAULT_TIMEZONE): string {
  return DateTime.now().setZone(timezone).toFormat("yyyy-MM-dd");
}

export function normalizeWeekStart(date: Date, settlementWeekday = 1): Date {
  return getWeekBounds(date, settlementWeekday).start;
}

export function weekStartKeyFromDate(date: Date, settlementWeekday = 1): string {
  return formatDateKey(normalizeWeekStart(date, settlementWeekday));
}

export function shiftWeekDateKey(weekStartKey: string, deltaWeeks: number): string {
  const base = DateTime.fromISO(weekStartKey, { zone: "utc" }).startOf("day");
  return base.plus({ weeks: deltaWeeks }).toFormat("yyyy-MM-dd");
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** @deprecated use scheduledAtFromSlot for tutor-local slot times */
export function parseStartTime(startTime: string, date: Date): Date {
  const [hours, minutes] = startTime.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function slotLessonKey(scheduleSlotId: string, dateKey: string): string {
  return `${scheduleSlotId}:${dateKey}`;
}

export function lessonDateForSlot(weekStart: Date, weekday: number): Date {
  return addDays(weekStart, weekday - 1);
}

export function scheduledAtFromSlot(
  weekStartKey: string,
  weekday: number,
  startTime: string,
  timezone: string
): Date {
  const [hour, minute] = startTime.split(":").map(Number);
  const base = DateTime.fromISO(weekStartKey, { zone: timezone }).startOf("day");
  const lessonDay = base.plus({ days: weekday - 1 });
  return DateTime.fromObject(
    { year: lessonDay.year, month: lessonDay.month, day: lessonDay.day, hour, minute },
    { zone: timezone }
  )
    .toUTC()
    .toJSDate();
}

export function lessonDateKeyInTimezone(iso: Date, timezone: string): string {
  return DateTime.fromJSDate(iso, { zone: "utc" }).setZone(timezone).toFormat("yyyy-MM-dd");
}

export function isoWeekdayInTimezone(iso: Date, timezone: string): number {
  return DateTime.fromJSDate(iso, { zone: "utc" }).setZone(timezone).weekday;
}

export function weekDateKeys(weekStartKey: string, timezone: string): string[] {
  const base = DateTime.fromISO(weekStartKey, { zone: timezone }).startOf("day");
  return Array.from({ length: 7 }, (_, i) => base.plus({ days: i }).toFormat("yyyy-MM-dd"));
}

export function weekUtcBounds(weekStartKey: string, timezone: string): { start: Date; end: Date } {
  const start = DateTime.fromISO(weekStartKey, { zone: timezone }).startOf("day");
  const end = start.plus({ days: 6 }).endOf("day");
  return { start: start.toUTC().toJSDate(), end: end.toUTC().toJSDate() };
}

export function dayUtcBounds(dateKey: string, timezone: string): { start: Date; end: Date } {
  const start = DateTime.fromISO(dateKey, { zone: timezone }).startOf("day");
  const end = start.endOf("day");
  return { start: start.toUTC().toJSDate(), end: end.toUTC().toJSDate() };
}

export type ActiveSlotRef = { id: string; weekday: number };

export type PlannedLessonRef = {
  id: string;
  status: string;
  scheduleSlotId: string | null;
  scheduledAt: Date;
  createdAt: Date;
  paymentCount: number;
};

export function shouldDeleteStalePlannedLesson(
  lesson: PlannedLessonRef,
  activeSlots: ActiveSlotRef[],
  timezone: string
): boolean {
  if (lesson.status !== "Planned") return false;
  if (!lesson.scheduleSlotId) return false;
  if (lesson.paymentCount > 0) return false;

  const slot = activeSlots.find((s) => s.id === lesson.scheduleSlotId);
  if (!slot) return true;

  const lessonWeekday = isoWeekdayInTimezone(lesson.scheduledAt, timezone);
  return lessonWeekday !== slot.weekday;
}

export function currentWeekStartKey(settlementWeekday: number, timezone: string): string {
  const now = DateTime.now().setZone(timezone).startOf("day");
  const diff = (now.weekday - settlementWeekday + 7) % 7;
  return now.minus({ days: diff }).toFormat("yyyy-MM-dd");
}

export function pickDuplicateLessonIdsToDeleteInTimezone(
  lessons: PlannedLessonRef[],
  timezone: string
): string[] {
  const groups = new Map<string, PlannedLessonRef[]>();

  for (const lesson of lessons) {
    if (lesson.status !== "Planned" || !lesson.scheduleSlotId || lesson.paymentCount > 0) {
      continue;
    }
    const key = slotLessonKey(
      lesson.scheduleSlotId,
      lessonDateKeyInTimezone(lesson.scheduledAt, timezone)
    );
    const list = groups.get(key) ?? [];
    list.push(lesson);
    groups.set(key, list);
  }

  const toDelete: string[] = [];
  for (const list of groups.values()) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    toDelete.push(...sorted.slice(1).map((l) => l.id));
  }
  return toDelete;
}

export async function getTutorTimezone(tutorId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: tutorId },
    select: { timezone: true },
  });
  return resolveTimezone(user?.timezone);
}

export async function cleanupStaleWeekLessons(
  workspaceId: string,
  tutorId: string,
  weekStartKey: string,
  timezone: string,
  activeSlots: ActiveSlotRef[]
): Promise<void> {
  const { start, end } = weekUtcBounds(weekStartKey, timezone);

  const lessons = await prisma.lesson.findMany({
    where: {
      workspaceId,
      tutorId,
      scheduleSlotId: { not: null },
      scheduledAt: { gte: start, lte: end },
    },
    include: { _count: { select: { payments: true } } },
  });

  const refs: PlannedLessonRef[] = lessons.map((l) => ({
    id: l.id,
    status: l.status,
    scheduleSlotId: l.scheduleSlotId,
    scheduledAt: l.scheduledAt,
    createdAt: l.createdAt,
    paymentCount: l._count.payments,
  }));

  const deleteIds = new Set<string>();

  for (const lesson of refs) {
    if (shouldDeleteStalePlannedLesson(lesson, activeSlots, timezone)) {
      deleteIds.add(lesson.id);
    }
  }

  for (const id of pickDuplicateLessonIdsToDeleteInTimezone(refs, timezone)) {
    deleteIds.add(id);
  }

  if (deleteIds.size === 0) return;

  await prisma.lesson.deleteMany({
    where: {
      id: { in: [...deleteIds] },
      status: "Planned",
      payments: { none: {} },
    },
  });
}

export async function deleteFuturePlannedLessonsForSlot(
  workspaceId: string,
  tutorId: string,
  slotId: string
): Promise<void> {
  const timezone = await getTutorTimezone(tutorId);
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { settlementWeekday: true },
  });
  const weekStartKey = currentWeekStartKey(workspace.settlementWeekday, timezone);
  const { start } = weekUtcBounds(weekStartKey, timezone);

  await prisma.lesson.deleteMany({
    where: {
      workspaceId,
      tutorId,
      scheduleSlotId: slotId,
      status: "Planned",
      payments: { none: {} },
      scheduledAt: { gte: start },
    },
  });
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

  const timezone = await getTutorTimezone(tutorId);
  const normalizedWeekStart = normalizeWeekStart(weekStart, workspace.settlementWeekday);
  const weekStartKey = formatDateKey(normalizedWeekStart);
  const currentWeekKey = currentWeekStartKey(workspace.settlementWeekday, timezone);

  if (weekStartKey < currentWeekKey) {
    return;
  }

  const slots = await prisma.scheduleSlot.findMany({
    where: { workspaceId, tutorId, isActive: true },
    include: { student: true },
  });

  const activeSlots: ActiveSlotRef[] = slots.map((s) => ({ id: s.id, weekday: s.weekday }));

  for (const slot of slots) {
    const dateKey = weekDateKeys(weekStartKey, timezone)[slot.weekday - 1];
    const { start: dayStart, end: dayEnd } = dayUtcBounds(dateKey, timezone);

    const existing = await prisma.lesson.findFirst({
      where: {
        workspaceId,
        tutorId,
        scheduleSlotId: slot.id,
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
    });
    if (existing) continue;

    const scheduledAt = scheduledAtFromSlot(weekStartKey, slot.weekday, slot.startTime, timezone);
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

  await cleanupStaleWeekLessons(workspaceId, tutorId, weekStartKey, timezone, activeSlots);
}

export const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const start = weekStart.toLocaleDateString("ru-RU", opts);
  const end = weekEnd.toLocaleDateString("ru-RU", { ...opts, year: "numeric" });
  return `${start} – ${end}`;
}
