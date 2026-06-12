import Decimal from "decimal.js";
import type { CommissionType } from "@prisma/client";

export type CommissionInput = {
  price: Decimal | number | string;
  commissionType: CommissionType;
  commissionValue: Decimal | number | string;
};

export function toDecimal(value: Decimal | number | string): Decimal {
  return new Decimal(value);
}

export function calculateLessonAmounts(input: CommissionInput): {
  price: Decimal;
  commissionAmount: Decimal;
  tutorAmount: Decimal;
} {
  const price = toDecimal(input.price);
  const commissionValue = toDecimal(input.commissionValue);

  let commissionAmount: Decimal;
  if (input.commissionType === "Percent") {
    commissionAmount = price.mul(commissionValue).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  } else {
    commissionAmount = Decimal.min(commissionValue, price);
  }

  const tutorAmount = price.minus(commissionAmount);

  return { price, commissionAmount, tutorAmount };
}

export function formatRub(value: Decimal | number | string): string {
  const n = toDecimal(value);
  return `${n.toFixed(0)} ₽`;
}

export function sumDecimals(values: Array<Decimal | number | string>): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Decimal(0));
}
