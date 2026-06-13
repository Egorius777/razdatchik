"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

type Slot = {
  id: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  isActive: boolean;
  student: { id: string; name: string };
};

type StudentOption = { id: string; name: string };

const WEEKDAYS = [
  { value: 1, label: "Понедельник" },
  { value: 2, label: "Вторник" },
  { value: 3, label: "Среда" },
  { value: 4, label: "Четверг" },
  { value: 5, label: "Пятница" },
  { value: 6, label: "Суббота" },
  { value: 7, label: "Воскресенье" },
];

const SHORT_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function SetupContent() {
  const [role, setRole] = useState<"Distributor" | "Tutor">("Tutor");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    studentId: "",
    weekday: "1",
    startTime: "10:00",
    durationMin: "60",
  });
  const [busy, setBusy] = useState(false);

  async function load() {
    const [me, slotsRes, studentsRes] = await Promise.all([
      fetch("/api/auth/telegram").then((r) => r.json()),
      fetch("/api/schedule/slots").then((r) => r.json()),
      fetch("/api/students").then((r) => r.json()),
    ]);
    setRole(me.role ?? "Tutor");
    setSlots(slotsRes.slots ?? []);
    setStudents(studentsRes.students ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<number, Slot[]>();
    for (let i = 1; i <= 7; i++) map.set(i, []);
    for (const slot of slots) {
      map.get(slot.weekday)?.push(slot);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [slots]);

  function resetForm() {
    setForm({ studentId: "", weekday: "1", startTime: "10:00", durationMin: "60" });
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(slot: Slot) {
    setEditingId(slot.id);
    setForm({
      studentId: slot.student.id,
      weekday: String(slot.weekday),
      startTime: slot.startTime,
      durationMin: String(slot.durationMin),
    });
    setShowForm(true);
  }

  async function saveSlot() {
    if (!form.studentId) return;
    setBusy(true);
    const payload = {
      studentId: form.studentId,
      weekday: Number(form.weekday),
      startTime: form.startTime,
      durationMin: Number(form.durationMin),
    };

    if (editingId) {
      await fetch(`/api/schedule/slots/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/schedule/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setBusy(false);
    resetForm();
    await load();
  }

  async function toggleActive(slot: Slot) {
    setBusy(true);
    await fetch(`/api/schedule/slots/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !slot.isActive }),
    });
    setBusy(false);
    await load();
  }

  async function deleteSlot(id: string) {
    setBusy(true);
    await fetch(`/api/schedule/slots/${id}`, { method: "DELETE" });
    setBusy(false);
    await load();
  }

  if (loading) return <LoadingState />;

  if (role !== "Tutor") {
    return (
      <main className="mx-auto max-w-lg p-4">
        <PageHeader title="Шаблон расписания" subtitle="Только для репетиторов" />
        <EmptyState title="Недоступно для раздатчика" />
        <BottomNav role={role} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-4 pb-28">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/schedule"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-black/5"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PageHeader title="Шаблон" subtitle="Повторяющиеся слоты по дням недели" />
      </div>

      <Button className="mb-4 w-full" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
        {showForm ? "Отмена" : "+ Добавить слот"}
      </Button>

      {showForm ? (
        <Card className="mb-4 space-y-3">
          <Select
            label="Ученик"
            value={form.studentId}
            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
          >
            <option value="">Выберите ученика</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            label="День недели"
            value={form.weekday}
            onChange={(e) => setForm({ ...form, weekday: e.target.value })}
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
          <Input
            label="Время начала"
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
          <Input
            label="Длительность, мин"
            type="number"
            value={form.durationMin}
            onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
          />
          <Button className="w-full" disabled={busy || !form.studentId} onClick={saveSlot}>
            {editingId ? "Сохранить изменения" : "Добавить слот"}
          </Button>
        </Card>
      ) : null}

      {slots.length === 0 ? (
        <EmptyState
          title="Шаблон пуст"
          description="Добавьте слоты — уроки будут создаваться автоматически каждую неделю"
        />
      ) : (
        <div className="space-y-4">
          {WEEKDAYS.map((day) => {
            const daySlots = grouped.get(day.value) ?? [];
            if (daySlots.length === 0) return null;
            return (
              <section key={day.value}>
                <h2 className="mb-2 text-sm font-semibold text-[var(--tg-hint)]">
                  {SHORT_DAYS[day.value - 1]} · {day.label}
                </h2>
                <div className="space-y-2">
                  {daySlots.map((slot) => (
                    <Card key={slot.id} className="space-y-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{slot.student.name}</p>
                          <p className="text-sm text-[var(--tg-hint)]">
                            {slot.startTime} · {slot.durationMin} мин
                          </p>
                          <Badge tone={slot.isActive ? "success" : "warning"}>
                            {slot.isActive ? "Активен" : "Выключен"}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="secondary" disabled={busy} onClick={() => startEdit(slot)}>
                          Изменить
                        </Button>
                        <Button variant="secondary" disabled={busy} onClick={() => toggleActive(slot)}>
                          {slot.isActive ? "Выкл" : "Вкл"}
                        </Button>
                        <Button variant="danger" disabled={busy} onClick={() => deleteSlot(slot.id)}>
                          Удалить
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <BottomNav role={role} />
    </main>
  );
}

export default function ScheduleSetupPage() {
  return (
    <Suspense fallback={null}>
      <AppShell>
        <SetupContent />
      </AppShell>
    </Suspense>
  );
}
