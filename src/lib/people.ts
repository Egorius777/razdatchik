export type PersonRef = {
  firstName: string;
  lastName?: string | null;
  username?: string | null;
};

export function formatPersonName(person?: PersonRef | null): string {
  if (!person) return "—";
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (person.username) return `@${person.username}`;
  return "Без имени";
}

/** Имя плательщика для сопоставления с переводом (fallback — имя ученика). */
export function formatPayerLabel(student?: { name: string; payerName?: string | null } | null): string {
  if (!student) return "—";
  const payer = student.payerName?.trim();
  if (payer) return payer;
  return student.name;
}

export function formatPeriodRange(start: string | Date, end: string | Date): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const startStr = s.toLocaleDateString("ru-RU", opts);
  const endStr = e.toLocaleDateString("ru-RU", { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}
