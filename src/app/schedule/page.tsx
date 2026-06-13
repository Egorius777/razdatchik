"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Settings2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/utils";

type LessonItem = {
  id: string;
  scheduledAt: string;
  studentName: string;
  studentId: string;
  status: string;
  price: string;
  durationMin: number;
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

const STATUS_LABELS: Record<string, string> = {
  Planned: "Запланирован",
  Done: "Проведён",
  Cancelled: "Отмена",
  NoShow: "Не пришёл",
};

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  Planned: "default",
  Done: "success",
  Cancelled: "warning",
  NoShow: "danger",
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

function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + deltaWeeks * 7);
  return date.toISOString().slice(0, 10);
}

function ScheduleContent() {
  const [role, setRole] = useState<"Distributor" | "Tutor">("Tutor");
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [days, setDays] = useState<DayItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [showOneOff, setShowOneOff] = useState(false);
  const [oneOff, setOneOff] = useState({ studentId: "", date: "", time: "10:00" });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const loadWeek = useCallback(async (start?: string) => {
    setLoading(true);
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
      setSelectedDate((prev) => {
        if (prev && data.days.some((d) => d.date === prev)) return prev;
        const today = new Date().toISOString().slice(0, 10);
        const todayInWeek = data.days.find((d) => d.date === today);
        return todayInWeek?.date ?? data.days[0]?.date ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const me = await fetch("/api/auth/telegram").then((r) => r.json());
      setRole(me.role ?? "Tutor");
      if (me.role === "Distributor") {
        setError("Расписание доступно репетиторам");
        setLoading(false);
        return;
      }
      const studentsRes = await fetch("/api/students").then((r) => r.json());
      setStudents(studentsRes.students ?? []);
      await loadWeek();
    }
    init();
  }, [loadWeek]);

  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate) ?? null,
    [days, selectedDate]
  );

  async function updateLessonStatus(lessonId: string, status: string) {
    setBusy(true);
    await fetch(`/api/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    setActiveLesson(null);
    if (weekStart) await loadWeek(weekStart);
  }

  async function reportPayment(lesson: LessonItem) {
    setBusy(true);
    const form = new FormData();
    form.set("studentId", lesson.studentId);
    form.set("lessonId", lesson.id);
    form.set("amount", paymentAmount || lesson.price);
    if (receiptFile) form.set("receipt", receiptFile);
    await fetch("/api/payments", { method: "POST", body: form });
    setBusy(false);
    setActiveLesson(null);
    setReceiptFile(null);
    setPaymentAmount("");
  }

  async function createOneOffLesson() {
    if (!oneOff.studentId || !oneOff.date) return;
    setBusy(true);
    const scheduledAt = new Date(`${oneOff.date}T${oneOff.time}:00`).toISOString();
    await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: oneOff.studentId, scheduledAt }),
    });
    setBusy(false);
    setShowOneOff(false);
    if (weekStart) await loadWeek(weekStart);
  }

  function goToday() {
    loadWeek();
  }

  if (loading && !weekStart) return <LoadingState />;

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
          className="mt-1 flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-black/5 text-[var(--tg-hint)]"
          aria-label="Настроить шаблон"
        >
          <Settings2 className="h-5 w-5" />
        </Link>
      </div>

      {weekStart ? (
        <Card className="mb-4 flex items-center justify-between gap-2 py-3">
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-black/5"
            onClick={() => loadWeek(shiftWeek(weekStart, -1))}
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
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-black/5"
            onClick={() => loadWeek(shiftWeek(weekStart, 1))}
            aria-label="Следующая неделя"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </Card>
      ) : null}

      {error ? (
        <Card className="mb-4 text-sm text-rose-600">{error}</Card>
      ) : (
        <div className="mb-4 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const active = day.date === selectedDate;
            const count = day.lessons.length;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={cn(
                  "flex min-h-[72px] flex-col items-center justify-center rounded-2xl px-1 py-2 text-center transition active:scale-[0.98]",
                  active
                    ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
                    : "bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]"
                )}
              >
                <span className="text-[10px] font-medium opacity-80">{day.label}</span>
                <span className="text-sm font-semibold">
                  {new Date(`${day.date}T00:00:00`).getDate()}
                </span>
                {count > 0 ? (
                  <span
                    className={cn(
                      "mt-1 h-1.5 w-1.5 rounded-full",
                      active ? "bg-white/90" : "bg-[var(--tg-link)]"
                    )}
                  />
                ) : (
                  <span className="mt-1 h-1.5 w-1.5" />
                )}
              </button>
            );
          })}
        </div>
      )}

      <Button className="mb-4 w-full" onClick={() => setShowOneOff(!showOneOff)}>
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
            value={oneOff.date}
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
            disabled={busy || !oneOff.studentId || !oneOff.date}
            onClick={createOneOffLesson}
          >
            Добавить урок
          </Button>
        </Card>
      ) : null}

      {loading ? <LoadingState /> : null}

      {!loading && selectedDay && selectedDay.lessons.length === 0 ? (
        <EmptyState title="Нет уроков" description="Добавьте разовый урок или настройте шаблон" />
      ) : null}

      {!loading && selectedDay ? (
        <div className="space-y-2">
          {selectedDay.lessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              className="w-full text-left"
              onClick={() => {
                setActiveLesson(lesson);
                setPaymentAmount(lesson.price);
              }}
            >
              <Card className="flex items-center justify-between gap-3 py-3 active:scale-[0.99]">
                <div>
                  <p className="font-medium">{lesson.studentName}</p>
                  <p className="text-sm text-[var(--tg-hint)]">
                    {formatTime(lesson.scheduledAt)} · {lesson.durationMin} мин
                  </p>
                  <Badge tone={STATUS_TONE[lesson.status] ?? "default"}>
                    {STATUS_LABELS[lesson.status] ?? lesson.status}
                  </Badge>
                </div>
                <span className="text-sm font-semibold">
                  {Number(lesson.price).toLocaleString("ru-RU")} ₽
                </span>
              </Card>
            </button>
          ))}
        </div>
      ) : null}

      {activeLesson ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-4 pb-[calc(var(--safe-bottom)+1rem)]">
          <Card className="w-full max-w-lg space-y-3">
            <div>
              <p className="font-semibold">{activeLesson.studentName}</p>
              <p className="text-sm text-[var(--tg-hint)]">
                {formatTime(activeLesson.scheduledAt)} · {activeLesson.durationMin} мин
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={busy} onClick={() => updateLessonStatus(activeLesson.id, "Done")}>
                Провёл
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => updateLessonStatus(activeLesson.id, "Cancelled")}
              >
                Отмена
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => updateLessonStatus(activeLesson.id, "NoShow")}
              >
                Не пришёл
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setActiveLesson(null)}>
                Закрыть
              </Button>
            </div>
            <div className="space-y-2 border-t border-black/5 pt-3">
              <p className="text-sm font-medium">Оплата</p>
              <Input
                label="Сумма, ₽"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <input
                type="file"
                accept="image/*,.pdf"
                className="text-sm"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
              <Button className="w-full" disabled={busy} onClick={() => reportPayment(activeLesson)}>
                Отправить оплату
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <BottomNav role={role} />
    </main>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={null}>
      <AppShell>
        <ScheduleContent />
      </AppShell>
    </Suspense>
  );
}
