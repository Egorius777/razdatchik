export const DEFAULT_TIMEZONE = "Europe/Moscow";
const MSK = "Europe/Moscow";

export function formatLessonTime(iso: string): string {
  const date = new Date(iso);
  const local = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const msk = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: MSK,
  });
  if (local === msk) return local;
  return `${local} · ${msk} МСК`;
}

export function formatLessonDateTime(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${datePart}, ${formatLessonTime(iso)}`;
}
