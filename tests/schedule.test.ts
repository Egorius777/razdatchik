import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDateKey,
  lessonDateForSlot,
  normalizeWeekStart,
  parseStartTime,
  parseWeekStart,
  pickDuplicateLessonIdsToDeleteInTimezone,
  scheduledAtFromSlot,
  shiftWeekDateKey,
  shouldDeleteStalePlannedLesson,
  slotLessonKey,
  type PlannedLessonRef,
} from "@/lib/schedule";

describe("schedule helpers", () => {
  it("parses weekStart as local midnight date", () => {
    const date = parseWeekStart("2025-06-09");
    expect(formatDateKey(date)).toBe("2025-06-09");
    expect(date.getHours()).toBe(0);
  });

  it("builds slot lesson key for duplicate detection", () => {
    const date = parseWeekStart("2025-06-10");
    expect(slotLessonKey("slot-1", formatDateKey(date))).toBe("slot-1:2025-06-10");
  });

  it("adds days within the same week", () => {
    const monday = parseWeekStart("2025-06-09");
    const wednesday = addDays(monday, 2);
    expect(formatDateKey(wednesday)).toBe("2025-06-11");
  });

  it("combines date and HH:MM start time", () => {
    const date = parseWeekStart("2025-06-09");
    const at = parseStartTime("14:30", date);
    expect(at.getHours()).toBe(14);
    expect(at.getMinutes()).toBe(30);
    expect(formatDateKey(at)).toBe("2025-06-09");
  });

  it("shiftWeekDateKey advances 7 local days (not UTC drift)", () => {
    expect(shiftWeekDateKey("2025-06-09", 1)).toBe("2025-06-16");
    expect(shiftWeekDateKey("2025-06-09", -1)).toBe("2025-06-02");
  });

  it("formatDateKey differs from toISOString near UTC midnight in positive TZ", () => {
    const monday = parseWeekStart("2025-06-09");
    const nextMonday = addDays(monday, 7);
    const isoKey = nextMonday.toISOString().slice(0, 10);
    const localKey = formatDateKey(nextMonday);
    if (isoKey !== localKey) {
      expect(shiftWeekDateKey("2025-06-09", 1)).toBe(localKey);
      expect(shiftWeekDateKey("2025-06-09", 1)).not.toBe(isoKey);
    } else {
      expect(localKey).toBe("2025-06-16");
    }
  });

  it("normalizeWeekStart snaps mid-week date to Monday", () => {
    const wednesday = parseWeekStart("2025-06-11");
    const monday = normalizeWeekStart(wednesday, 1);
    expect(formatDateKey(monday)).toBe("2025-06-09");
  });

  it("lessonDateForSlot maps weekday 1 to week start only", () => {
    const weekStart = parseWeekStart("2025-06-09");
    expect(formatDateKey(lessonDateForSlot(weekStart, 1))).toBe("2025-06-09");
    expect(formatDateKey(lessonDateForSlot(weekStart, 3))).toBe("2025-06-11");
    expect(formatDateKey(lessonDateForSlot(weekStart, 7))).toBe("2025-06-15");
  });

  it("mid-week weekStart must not place Monday slot on Wednesday", () => {
    const wrongStart = parseWeekStart("2025-06-11");
    const normalized = normalizeWeekStart(wrongStart, 1);
    const mondaySlotDay = lessonDateForSlot(normalized, 1);
    expect(formatDateKey(mondaySlotDay)).toBe("2025-06-09");
    expect(formatDateKey(mondaySlotDay)).not.toBe("2025-06-11");
  });
});

describe("timezone materialization", () => {
  it("stores Monday 11:00 Asia/Yekaterinburg as 09:00 MSK", () => {
    const at = scheduledAtFromSlot("2025-06-09", 1, "11:00", "Asia/Yekaterinburg");
    const local = at.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Yekaterinburg",
    });
    const msk = at.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });
    expect(local).toBe("11:00");
    expect(msk).toBe("09:00");
  });
});

describe("stale lesson cleanup", () => {
  const activeSlots = [{ id: "slot-1", weekday: 1 }];
  const tz = "Europe/Moscow";

  function plannedLesson(overrides: Partial<PlannedLessonRef> = {}): PlannedLessonRef {
    return {
      id: "lesson-1",
      status: "Planned",
      scheduleSlotId: "slot-1",
      scheduledAt: scheduledAtFromSlot("2025-06-09", 1, "11:00", tz),
      createdAt: new Date("2025-06-01"),
      paymentCount: 0,
      ...overrides,
    };
  }

  it("deletes planned lesson on wrong weekday", () => {
    const lesson = plannedLesson({
      scheduledAt: scheduledAtFromSlot("2025-06-09", 2, "11:00", tz),
    });
    expect(shouldDeleteStalePlannedLesson(lesson, activeSlots, tz)).toBe(true);
  });

  it("keeps Done lesson even on wrong weekday", () => {
    const lesson = plannedLesson({
      status: "Done",
      scheduledAt: scheduledAtFromSlot("2025-06-09", 2, "11:00", tz),
    });
    expect(shouldDeleteStalePlannedLesson(lesson, activeSlots, tz)).toBe(false);
  });

  it("keeps lesson with payment", () => {
    expect(shouldDeleteStalePlannedLesson(plannedLesson({ paymentCount: 1 }), activeSlots, tz)).toBe(
      false
    );
  });

  it("keeps one-off lesson without scheduleSlotId", () => {
    expect(
      shouldDeleteStalePlannedLesson(plannedLesson({ scheduleSlotId: null }), activeSlots, tz)
    ).toBe(false);
  });

  it("dedupes duplicate planned lessons on same slot and day", () => {
    const scheduledAt = scheduledAtFromSlot("2025-06-09", 1, "11:00", tz);
    const lessons: PlannedLessonRef[] = [
      {
        id: "keep",
        status: "Planned",
        scheduleSlotId: "slot-1",
        scheduledAt,
        createdAt: new Date("2025-06-01"),
        paymentCount: 0,
      },
      {
        id: "drop",
        status: "Planned",
        scheduleSlotId: "slot-1",
        scheduledAt,
        createdAt: new Date("2025-06-02"),
        paymentCount: 0,
      },
    ];
    expect(pickDuplicateLessonIdsToDeleteInTimezone(lessons, tz)).toEqual(["drop"]);
  });
});
