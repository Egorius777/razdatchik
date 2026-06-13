"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Badge, Button, Card, EmptyState, Input, LoadingState, PageHeader, Select } from "@/components/ui";
import { formatPersonName } from "@/lib/people";

type Student = {
  id: string;
  name: string;
  payerName?: string | null;
  defaultPrice: string;
  commissionType: string;
  commissionValue: string;
  status: string;
  tutor?: { id: string; firstName: string; lastName?: string | null; username?: string | null };
};

type TutorOption = {
  user: { id: string; firstName: string; lastName?: string | null; username?: string | null };
};

function StudentsContent() {
  const [role, setRole] = useState<"Distributor" | "Tutor">("Tutor");
  const [students, setStudents] = useState<Student[]>([]);
  const [tutors, setTutors] = useState<TutorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    payerName: "",
    defaultPrice: "2000",
    commissionType: "Percent",
    commissionValue: "25",
    tutorId: "",
  });

  async function load() {
    const me = await fetch("/api/auth/telegram").then((r) => r.json());
    setRole(me.role ?? "Tutor");
    const requests: Promise<Response>[] = [fetch("/api/students")];
    if (me.role === "Distributor") {
      requests.push(fetch("/api/tutors"));
    }
    const [studentsRes, tutorsRes] = await Promise.all(requests);
    const studentsData = await studentsRes.json();
    setStudents(studentsData.students ?? []);
    if (tutorsRes) {
      const tutorsData = await tutorsRes.json();
      const list = tutorsData.tutors ?? [];
      setTutors(list);
      if (list.length === 1) {
        setForm((f) => ({ ...f, tutorId: list[0].user.id }));
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createStudent() {
    const payload: Record<string, unknown> = {
      name: form.name,
      payerName: form.payerName.trim() || undefined,
      defaultPrice: Number(form.defaultPrice),
      commissionType: form.commissionType,
      commissionValue: Number(form.commissionValue),
    };
    if (role === "Distributor") {
      payload.tutorId = form.tutorId;
    }
    await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setShowForm(false);
    setForm({
      name: "",
      payerName: "",
      defaultPrice: "2000",
      commissionType: "Percent",
      commissionValue: "25",
      tutorId: tutors.length === 1 ? tutors[0].user.id : "",
    });
    await load();
  }

  const canCreate =
    form.name.trim() &&
    (role === "Tutor" || (form.tutorId && tutors.length > 0));

  if (loading) return <LoadingState />;

  return (
    <main className="mx-auto max-w-lg p-4 pb-28">
      <PageHeader
        title="Ученики"
        subtitle={role === "Distributor" ? "Все ученики команды" : "Цена и комиссия для каждого"}
      />
      <Button className="mb-4 w-full" onClick={() => setShowForm(!showForm)}>
        {showForm ? "Отмена" : "+ Добавить ученика"}
      </Button>

      {showForm ? (
        <Card className="mb-4 space-y-3">
          {role === "Distributor" ? (
            tutors.length === 0 ? (
              <p className="text-sm text-[var(--tg-hint)]">
                Сначала пригласите репетитора в разделе «Команда».
              </p>
            ) : (
              <Select
                label="Репетитор"
                value={form.tutorId}
                onChange={(e) => setForm({ ...form, tutorId: e.target.value })}
              >
                <option value="">Выберите репетитора</option>
                {tutors.map((t) => (
                  <option key={t.user.id} value={t.user.id}>
                    {formatPersonName(t.user)}
                  </option>
                ))}
              </Select>
            )
          ) : null}
          <Input label="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input
            label="Кто платит (имя в переводе)"
            value={form.payerName}
            onChange={(e) => setForm({ ...form, payerName: e.target.value })}
            placeholder="Как в банковском переводе"
          />
          <p className="text-xs text-[var(--tg-hint)]">
            Это имя увидит раздатчик при проверке входящих оплат
          </p>
          <Input
            label="Цена урока, ₽"
            type="number"
            value={form.defaultPrice}
            onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })}
          />
          <Select
            label="Тип комиссии"
            value={form.commissionType}
            onChange={(e) => setForm({ ...form, commissionType: e.target.value })}
          >
            <option value="Percent">Процент</option>
            <option value="Fixed">Фикс</option>
          </Select>
          <Input
            label={form.commissionType === "Percent" ? "Комиссия, %" : "Комиссия, ₽"}
            type="number"
            value={form.commissionValue}
            onChange={(e) => setForm({ ...form, commissionValue: e.target.value })}
          />
          <Button className="w-full" onClick={createStudent} disabled={!canCreate}>
            Сохранить
          </Button>
        </Card>
      ) : null}

      {students.length === 0 ? (
        <EmptyState title="Пока нет учеников" description="Добавьте первого ученика" />
      ) : (
        <div className="space-y-2">
          {students.map((s) => (
            <Link key={s.id} href={`/students/${s.id}`}>
              <Card className="flex items-center justify-between py-3 active:scale-[0.99]">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-[var(--tg-hint)]">
                    {Number(s.defaultPrice).toLocaleString("ru-RU")} ₽ ·{" "}
                    {s.commissionType === "Percent"
                      ? `${s.commissionValue}%`
                      : `${s.commissionValue} ₽`}
                  </p>
                  {role === "Distributor" && s.tutor ? (
                    <p className="text-xs text-[var(--tg-hint)]">
                      Репетитор: {formatPersonName(s.tutor)}
                    </p>
                  ) : null}
                  {s.payerName ? (
                    <p className="text-xs text-[var(--tg-hint)]">Платит: {s.payerName}</p>
                  ) : null}
                </div>
                <Badge>{s.status}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <BottomNav role={role} />
    </main>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={null}>
      <AppShell>
        <StudentsContent />
      </AppShell>
    </Suspense>
  );
}
