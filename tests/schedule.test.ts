import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDateKey,
  parseStartTime,
  parseWeekStart,
  slotLessonKey,
} from "@/lib/schedule";

describe("schedule helpers", () => {
  it("parses weekStart as local midnight date", () => {
    const date = parseWeekStart("2025-06-09");
    expect(formatDateKey(date)).toBe("2025-06-09");
    expect(date.getHours()).toBe(0);
  });

  it("builds slot lesson key for duplicate detection", () => {
    const date = parseWeekStart("2025-06-10");
    expect(slotLessonKey("slot-1", date)).toBe("slot-1:2025-06-10");
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
});
