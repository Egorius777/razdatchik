import { describe, expect, it } from "vitest";
import { calculateLessonAmounts, sumDecimals } from "@/lib/money";

describe("calculateLessonAmounts", () => {
  it("computes percent commission for 2000 rub at 25%", () => {
    const result = calculateLessonAmounts({
      price: 2000,
      commissionType: "Percent",
      commissionValue: 25,
    });
    expect(result.commissionAmount.toNumber()).toBe(500);
    expect(result.tutorAmount.toNumber()).toBe(1500);
  });

  it("sums 3 lessons to 4500 tutor and 1500 commission", () => {
    const one = calculateLessonAmounts({
      price: 2000,
      commissionType: "Percent",
      commissionValue: 25,
    });
    const tutorTotal = sumDecimals([one.tutorAmount, one.tutorAmount, one.tutorAmount]);
    const commissionTotal = sumDecimals([
      one.commissionAmount,
      one.commissionAmount,
      one.commissionAmount,
    ]);
    expect(tutorTotal.toNumber()).toBe(4500);
    expect(commissionTotal.toNumber()).toBe(1500);
  });

  it("caps fixed commission at price", () => {
    const result = calculateLessonAmounts({
      price: 1000,
      commissionType: "Fixed",
      commissionValue: 1500,
    });
    expect(result.commissionAmount.toNumber()).toBe(1000);
    expect(result.tutorAmount.toNumber()).toBe(0);
  });
});
