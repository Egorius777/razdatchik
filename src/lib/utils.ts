import type { AuthContext } from "./auth";

export function getWeekBounds(date: Date, settlementWeekday = 1): { start: Date; end: Date } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay();
  const isoDay = day === 0 ? 7 : day;
  const diffToStart = (isoDay - settlementWeekday + 7) % 7;

  const start = new Date(d);
  start.setDate(d.getDate() - diffToStart);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function getPreviousWeekBounds(
  date: Date,
  settlementWeekday = 1
): { start: Date; end: Date } {
  const current = getWeekBounds(date, settlementWeekday);
  const prevEnd = new Date(current.start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  return getWeekBounds(prevEnd, settlementWeekday);
}

export function tutorScope(auth: AuthContext): { tutorId?: string } {
  if (auth.role === "Tutor") {
    return { tutorId: auth.userId };
  }
  return {};
}

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function serializeBigInt<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v))
  ) as T;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
