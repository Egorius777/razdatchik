"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Settings2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LessonListSkeleton,
  LoadingState,
  PageHeader,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  formatDateKey,
  shiftWeekDateKey,
  todayDateKey,
} from "@/lib/schedule";
import {
  getDayAccent,
  getLessonStatusLabel,
  getPaymentStatusLabel,
  hapticSuccess,
  LESSON_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  type DayAccent,
} from "@/lib/status";

type LessonItem = {
  id: string;
  scheduledAt: string;
  studentName: string;
  studentId: string;
  status: string;
  price: string;
  durationMin: number;
  paymentStatus: string;
};

type DayItem = {
  weekday: number;
  label: string;
  date: string;
  lessons: LessonItem[];
};

type WeekResponse = {
  weekStart: string;
  weekEnd: string;
  days: DayItem[];
};

type StudentOption = { id: string; name: string; defaultPrice: string };

const DAY_COUNT_COLORS: Record<DayAccent, string> = {
  none: "text-[var(--tg-hint)]",
  accent: "text-[var(--tg-link)]",
  success: "text-[var(--accent-success)]",
  warning: "text-[var(--accent-warning)]",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("ru-RU", opts)} – ${end.toLocaleDateString("ru-RU", { ...opts, year: "numeric" })}`;
}

function formatHeroWhen(iso: string): string {
  const time = formatTime(iso);
  const lessonDate = formatDateKey(new Date(iso));
  const today = todayDateKey();
  if (lessonDate === today) return `Сегодня ${time}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (lessonDate === formatDateKey(tomorrow)) return `Завтра ${time}`;
  const d = new Date(iso);
  return `${d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric" })} ${time}`;
}

function shiftWeek(weekStart: string, deltaWeeks: number): string {
  return shiftWeekDateKey(weekStart, deltaWeeks);
}

function todayKey(): string {
  return todayDateKey();
}

function ScheduleContent() {
  const searchParams = useSearchParams();
  const dateFromUrl = searchParams.get("date");

  const [role, setRole] = useState<"Distributor" | "Tutor">("Tutor");
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [days, setDays] = useState<DayItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<"Cancelled" | "NoShow" | "delete" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [showOneOff, setShowOneOff] = useState(false);
  const [oneOff, setOneOff] = useState({ studentId: "", date: "", time: "10:00" });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const loadWeek = useCallback(
    async (start?: string, preferredDate?: string | null) => {
      if (weekStart) setListLoading(true);
      else setInitialLoading(true);
      setError(null);
      try {
        const query = start ? `?weekStart=${start}` : "";
        const res = await fetch(`/api/schedule/week${query}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Не удалось загрузить расписание");
        }
        const data = (await res.json()) as WeekResponse;
        setWeekStart(data.weekStart);
        setDays(data.days);
        const today = todayKey();
        const pick =
          preferredDate && data.days.some((d) => d.date === preferredDate)
            ? preferredDate
            : dateFromUrl && data.days.some((d) => d.date === dateFromUrl)
              ? dateFromUrl
              : data.days.some((d) => d.date === today)
                ? today
                : (data.days[0]?.date ?? null);
        setSelectedDate(pick);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        setInitialLoading(false);
        setListLoading(false);
      }
    },
    [weekStart, dateFromUrl]
  );

  useEffect(() => {
    async function init() {
      const me = await fetch("/api/auth/telegram").then((r) => r.json());
      setRole(me.role ?? "Tutor");
      if (me.role === "Distributor") {
        setError("Расписание доступно репетиторам");
        setInitialLoading(false);
        return;
      }
      const studentsRes = await fetch("/api/students").then((r) => r.json());
      setStudents(studentsRes.students ?? []);
      await loadWeek(undefined, dateFromUrl);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate) ?? null,
    [days, selectedDate]
  );

  const nextLesson = useMemo(() => {
    const now = Date.now();
    const all = days.flatMap((d) => d.lessons);
    const planned = all
      .filter((l) => l.status === "Planned" && new Date(l.scheduledAt).getTime() > now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    return planned[0] ?? null;
  }, [days]);

  function openLesson(lesson: LessonItem) {
    setActiveLesson(lesson);
    setPaymentAmount(lesson.price);
    setConfirmAction(null);
    setActionError(null);
  }

  function closeSheet() {
    setActiveLesson(null);
    setConfirmAction(null);
    setActionError(null);
  }

  async function updateLessonStatus(lessonId: string, status: string) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(
          typeof err.error === "string" ? err.error : "Не удалось обновить урок"
        );
      }
      hapticSuccess();
      closeSheet();
      if (weekStart) await loadWeek(weekStart, selectedDate);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      if (activeLesson) setActionError(msg);
      else setError(msg);
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  async function deleteLesson(lessonId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(
          typeof err.error === "string" ? err.error : "Не удалось удалить урок"
        );
      }
      hapticSuccess();
      closeSheet();
      if (weekStart) await loadWeek(weekStart, selectedDate);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  async function reportPayment(lesson: LessonItem) {
    setBusy(true);
    setActionError(null);
    try {
      const form = new FormData();
      form.set("studentId", lesson.studentId);
      form.set("lessonId", lesson.id);
      form.set("amount", paymentAmount || lesson.price);
      if (receiptFile) form.set("receipt", receiptFile);
      const res = await fetch("/api/payments", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(
          typeof err.error === "string" ? err.error : "Не удалось отправить оплату"
        );
      }
      hapticSuccess();
      closeSheet();
      setReceiptFile(null);
      setPaymentAmount("");
      if (weekStart) await loadWeek(weekStart, selectedDate);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  function goToday() {
    loadWeek(undefined, todayKey());
  }

  if (initialLoading) return <LoadingState />;

  if (role === "Distributor") {
    return (
      <main className="mx-auto max-w-lg p-4">
        <PageHeader title="Расписание" subtitle="Доступно в приложении репетитора" />
        <EmptyState title="Раздел для репетиторов" />
        <BottomNav role={role} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-4 pb-28">
      <div className="mb-4 flex items-start justify-between gap-2">
        <PageHeader title="Расписание" subtitle="Уроки на неделю" />
        <Link
          href="/schedule/setup"
          className="mt-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tg-muted-surface)] text-[var(--tg-hint)]"
          aria-label="Шаблон расписания"
          title="Шаблон расписания"
        >
          <Settings2 className="h-5 w-5" />
        </Link>
      </div>

      {nextLesson ? (
        <Card className="mb-4 flex items-center justify-between gap-3 border-[var(--tg-link)] bg-[var(--tg-muted-surface)] py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--tg-hint)]">Следующий урок</p>
            <p className="font-semibold">
              {formatHeroWhen(nextLesson.scheduledAt)} · {nextLesson.studentName}
            </p>
          </div>
          <Button
            disabled={busy}
            onClick={() => updateLessonStatus(nextLesson.id, "Done")}
          >
            Провёл
          </Button>
        </Card>
      ) : null}

      {weekStart ? (
        <Card className="mb-4 flex items-center justify-between gap-2 py-3">
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[var(--tg-muted-surface)]"
            onClick={() => loadWeek(shiftWeek(weekStart, -1), selectedDate)}
            disabled={listLoading}
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-medium">{formatWeekLabel(weekStart)}</p>
            <button
              type="button"
              className="mt-1 text-xs text-[var(--tg-link)]"
              onClick={goToday}
            >
              Сегодня
            </button>
          </div>
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[var(--tg-muted-surface)]"
            onClick={() => loadWeek(shiftWeek(weekStart, 1), selectedDate)}
            disabled={listLoading}
            aria-label="Следующая неделя"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </Card>
      ) : null}

      {error ? (
        <Card className="mb-4 text-sm text-[var(--badge-danger-text)]">{error}</Card>
      ) : (
        <div className="mb-4 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const active = day.date === selectedDate;
            const count = day.lessons.length;
            const accent = getDayAccent(day.lessons);
            const isToday = day.date === todayKey();
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={cn(
                  "flex min-h-[72px] flex-col items-center justify-center rounded-2xl px-1 py-2 text-center transition active:scale-[0.98]",
                  active
                    ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
                    : "bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]",
                  isToday &&
                    !active &&
                    "ring-2 ring-[var(--tg-text)] ring-offset-1 ring-offset-[var(--tg-bg)]"
                )}
              >
                <span className="text-[10px] font-medium opacity-80">{day.label}</span>
                <span className={cn("text-sm font-semibold", isToday && "font-bold")}>
                  {new Date(`${day.date}T00:00:00`).getDate()}
                </span>
                <span
                  className={cn(
                    "mt-0.5 text-[10px] font-bold leading-none",
                    active ? "text-[var(--tg-button-text)]" : DAY_COUNT_COLORS[accent]
                  )}
                >
                  {count > 0 ? count : "·"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Button className="mb-4 w-full" onClick={() => setShowOneOff(!showOneOff)} disabled={busy}>
        <Plus className="mr-2 h-4 w-4" />
        {showOneOff ? "Отмена" : "Разовый урок"}
      </Button>

      {showOneOff ? (
        <Card className="mb-4 space-y-3">
          <Select
            label="Ученик"
            value={oneOff.studentId}
            onChange={(e) => setOneOff({ ...oneOff, studentId: e.target.value })}
          >
            <option value="">Выберите ученика</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            label="Дата"
            type="date"
            value={oneOff.date || selectedDate || ""}
            onChange={(e) => setOneOff({ ...oneOff, date: e.target.value })}
          />
          <Input
            label="Время"
            type="time"
            value={oneOff.time}
            onChange={(e) => setOneOff({ ...oneOff, time: e.target.value })}
          />
          <Button
            className="w-full"
            disabled={busy || !oneOff.studentId || !(oneOff.date || selectedDate)}
            onClick={() => {
              const date = oneOff.date || selectedDate || "";
              if (!oneOff.studentId || !date) return;
              setOneOff((prev) => ({ ...prev, date }));
              void (async () => {
                setBusy(true);
                setError(null);
                try {
                  const scheduledAt = new Date(`${date}T${oneOff.time}:00`).toISOString();
                  const res = await fetch("/api/lessons", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ studentId: oneOff.studentId, scheduledAt }),
                  });
                  if (!res.ok) {
                    const err = await res.json();
                    throw new Error(
                      typeof err.error === "string" ? err.error : "Не удалось создать урок"
                    );
                  }
                  hapticSuccess();
                  setShowOneOff(false);
                  if (weekStart) await loadWeek(weekStart, date);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Ошибка");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Добавить урок
          </Button>
        </Card>
      ) : null}

      {listLoading ? (
        <LessonListSkeleton count={selectedDay?.lessons.length || 3} />
      ) : null}

      {!listLoading && selectedDay && selectedDay.lessons.length === 0 ? (
        <EmptyState
          title="Нет уроков"
          description="Настройте шаблон (⚙️ справа вверху) или добавьте разовый урок"
        />
      ) : null}

      {!listLoading && selectedDay ? (
        <div className="space-y-2">
          {selectedDay.lessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              className="w-full text-left"
              onClick={() => openLesson(lesson)}
            >
              <Card className="flex items-center justify-between gap-3 py-3 active:scale-[0.99]">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{lesson.studentName}</p>
                  <p className="text-sm text-[var(--tg-hint)]">
                    {formatTime(lesson.scheduledAt)} · {lesson.durationMin} мин
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={LESSON_STATUS_TONE[lesson.status] ?? "default"}>
                      {getLessonStatusLabel(lesson.status)}
                    </Badge>
                    <Badge tone={PAYMENT_STATUS_TONE[lesson.paymentStatus] ?? "default"}>
                      {getPaymentStatusLabel(lesson.paymentStatus)}
                    </Badge>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold">
                  {Number(lesson.price).toLocaleString("ru-RU")} ₽
                </span>
              </Card>
            </button>
          ))}
        </div>
      ) : null}

      {activeLesson ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => !busy && closeSheet()}
          role="presentation"
        >
          <div
            className="w-full max-w-lg max-h-[calc(100dvh-0.5rem)] overflow-y-auto overscroll-y-contain px-4 pb-[calc(var(--safe-bottom)+1rem)] pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="space-y-3">
            <div>
              <p className="font-semibold">{activeLesson.studentName}</p>
              <p className="text-sm text-[var(--tg-hint)]">
                {formatTime(activeLesson.scheduledAt)} · {activeLesson.durationMin} мин
              </p>
            </div>

            {actionError ? (
              <p className="text-sm text-[var(--badge-danger-text)]">{actionError}</p>
            ) : null}

            {activeLesson.status === "Done" ? (
              <p className="rounded-xl bg-[var(--badge-success-bg)] px-3 py-2 text-sm font-medium text-[var(--badge-success-text)]">
                ✓ Проведён
              </p>
            ) : confirmAction ? (
              <div className="space-y-2">
                <p className="text-sm text-[var(--tg-hint)]">
                  {confirmAction === "Cancelled"
                    ? "Отменить урок?"
                    : confirmAction === "NoShow"
                      ? "Отметить, что ученик не пришёл?"
                      : "Удалить урок из расписания? Для ошибочных или лишних записей."}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      confirmAction === "delete"
                        ? deleteLesson(activeLesson.id)
                        : updateLessonStatus(activeLesson.id, confirmAction)
                    }
                  >
                    {confirmAction === "delete" ? "Удалить" : "Подтвердить"}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setConfirmAction(null)}>
                    Назад
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {activeLesson.status === "Planned" ? (
                  <Button
                    className="w-full min-h-12 text-base"
                    disabled={busy}
                    onClick={() => updateLessonStatus(activeLesson.id, "Done")}
                  >
                    Провёл
                  </Button>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  {activeLesson.status === "Planned" ? (
                    <>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setConfirmAction("Cancelled")}
                      >
                        Отмена
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setConfirmAction("NoShow")}
                      >
                        Не пришёл
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="ghost"
                    disabled={busy}
                    className={activeLesson.status !== "Planned" ? "col-span-2" : ""}
                    onClick={closeSheet}
                  >
                    Закрыть
                  </Button>
                </div>
                {activeLesson.status !== "Done" ? (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    className="w-full text-[var(--badge-danger-text)]"
                    onClick={() => setConfirmAction("delete")}
                  >
                    Удалить из расписания
                  </Button>
                ) : null}
              </div>
            )}

            <div className="space-y-2 border-t border-[var(--tg-border-subtle)] pt-3">
              <p className="text-sm font-medium">Оплата</p>
              <Input
                label="Сумма, ₽"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                disabled={busy}
              />
              <input
                type="file"
                accept="image/*,.pdf"
                className="text-sm"
                disabled={busy}
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => reportPayment(activeLesson)}
              >
                Отправить оплату
              </Button>
            </div>
            </Card>
          </div>
        </div>
      ) : null}

      <BottomNav role={role} />
    </main>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AppShell>
        <ScheduleContent />
      </AppShell>
    </Suspense>
  );
}
