export const LESSON_STATUS_LABELS: Record<string, string> = {
  Planned: "Запланирован",
  Done: "Проведён",
  Cancelled: "Отмена",
  NoShow: "Не пришёл",
};

export const LESSON_STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  Planned: "default",
  Done: "success",
  Cancelled: "warning",
  NoShow: "danger",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  none: "оплата не отправлена",
  Reported: "на проверке",
  Confirmed: "подтверждена",
  Disputed: "спор",
};

export const PAYMENT_STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  none: "default",
  Reported: "warning",
  Confirmed: "success",
  Disputed: "danger",
};

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  Pending: "ожидает выплаты",
  Paid: "выплачено",
};

export const PAYOUT_STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  Pending: "warning",
  Paid: "success",
};

export function getLessonStatusLabel(status: string): string {
  return LESSON_STATUS_LABELS[status] ?? status;
}

export function getPaymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

export function getPayoutStatusLabel(status: string): string {
  return PAYOUT_STATUS_LABELS[status] ?? status;
}

export type DayAccent = "none" | "accent" | "success" | "warning";

export function getDayAccent(
  lessons: Array<{ status: string }>
): DayAccent {
  if (lessons.length === 0) return "none";
  if (lessons.some((l) => l.status === "NoShow")) return "warning";
  if (lessons.some((l) => l.status === "Planned")) return "accent";
  if (lessons.every((l) => l.status === "Done" || l.status === "Cancelled")) {
    return lessons.some((l) => l.status === "Done") ? "success" : "none";
  }
  return "none";
}

export function hapticSuccess(): void {
  if (typeof window === "undefined") return;
  const webApp = (
    window as Window & {
      Telegram?: { WebApp?: { HapticFeedback?: { notificationOccurred?: (type: string) => void } } };
    }
  ).Telegram?.WebApp;
  webApp?.HapticFeedback?.notificationOccurred?.("success");
}
