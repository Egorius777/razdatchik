import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { calculateLessonAmounts, sumDecimals } from "./money";
import { getPreviousWeekBounds } from "./utils";

export async function computePayoutForTutor(
  workspaceId: string,
  tutorId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const lessons = await prisma.lesson.findMany({
    where: {
      workspaceId,
      tutorId,
      status: "Done",
      scheduledAt: { gte: periodStart, lte: periodEnd },
    },
  });

  const gross = sumDecimals(lessons.map((l) => l.price));
  const commissionTotal = sumDecimals(lessons.map((l) => l.commissionAmount));
  const netAmount = sumDecimals(lessons.map((l) => l.tutorAmount));

  return {
    gross,
    commissionTotal,
    netAmount,
    lessonCount: lessons.length,
  };
}

export async function upsertWeeklyPayouts(workspaceId: string, settlementWeekday: number) {
  const { start, end } = getPreviousWeekBounds(new Date(), settlementWeekday);

  const tutors = await prisma.membership.findMany({
    where: { workspaceId, role: "Tutor", status: "Active" },
    select: { userId: true },
  });

  const results = [];
  for (const { userId: tutorId } of tutors) {
    const calc = await computePayoutForTutor(workspaceId, tutorId, start, end);
    if (calc.lessonCount === 0) continue;

    const payout = await prisma.payout.upsert({
      where: {
        workspaceId_tutorId_periodStart: {
          workspaceId,
          tutorId,
          periodStart: start,
        },
      },
      create: {
        workspaceId,
        tutorId,
        periodStart: start,
        periodEnd: end,
        gross: calc.gross.toFixed(0),
        commissionTotal: calc.commissionTotal.toFixed(0),
        netAmount: calc.netAmount.toFixed(0),
        lessonCount: calc.lessonCount,
      },
      update: {
        periodEnd: end,
        gross: calc.gross.toFixed(0),
        commissionTotal: calc.commissionTotal.toFixed(0),
        netAmount: calc.netAmount.toFixed(0),
        lessonCount: calc.lessonCount,
      },
    });
    results.push(payout);
  }

  return { periodStart: start, periodEnd: end, payouts: results };
}

export function buildLessonCreateData(
  student: {
    defaultPrice: Prisma.Decimal;
    commissionType: "Percent" | "Fixed";
    commissionValue: Prisma.Decimal;
  },
  base: {
    workspaceId: string;
    studentId: string;
    tutorId: string;
    scheduledAt: Date;
    status?: "Planned" | "Done" | "Cancelled" | "NoShow";
    isTrial?: boolean;
    notes?: string | null;
    createdById: string;
  }
) {
  const amounts = calculateLessonAmounts({
    price: student.defaultPrice,
    commissionType: student.commissionType,
    commissionValue: student.commissionValue,
  });

  return {
    ...base,
    status: base.status ?? "Planned",
    isTrial: base.isTrial ?? false,
    price: amounts.price.toFixed(0),
    commissionType: student.commissionType,
    commissionValue: student.commissionValue,
    commissionAmount: amounts.commissionAmount.toFixed(0),
    tutorAmount: amounts.tutorAmount.toFixed(0),
  };
}

export function decimalToNumber(value: Prisma.Decimal | Decimal): number {
  return Number(value.toString());
}
