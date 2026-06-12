"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Badge, Button, Card, EmptyState, Input, LoadingState, PageHeader, Select } from "@/components/ui";

type Student = {
  id: string;
  name: string;
  defaultPrice: string;
  commissionType: string;
  commissionValue: string;
  status: string;
};

function StudentsContent() {
  const [role, setRole] = useState<"Distributor" | "Tutor">("Tutor");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    defaultPrice: "2000",
    commissionType: "Percent",
    commissionValue: "25",
  });

  async function load() {
    const me = await fetch("/api/auth/telegram").then((r) => r.json());
    setRole(me.role ?? "Tutor");
    const res = await fetch("/api/students").then((r) => r.json());
    setStudents(res.students ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createStudent() {
    await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        defaultPrice: Number(form.defaultPrice),
        commissionType: form.commissionType,
        commissionValue: Number(form.commissionValue),
      }),
    });
    setShowForm(false);
    setForm({ name: "", defaultPrice: "2000", commissionType: "Percent", commissionValue: "25" });
    await load();
  }

  if (loading) return <LoadingState />;

  return (
    <main className="mx-auto max-w-lg p-4">
      <PageHeader title="Ученики" subtitle="Цена и комиссия для каждого" />
      <Button className="mb-4 w-full" onClick={() => setShowForm(!showForm)}>
        {showForm ? "Отмена" : "+ Добавить ученика"}
      </Button>

      {showForm ? (
        <Card className="mb-4 space-y-3">
          <Input label="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
          <Button className="w-full" onClick={createStudent} disabled={!form.name.trim()}>
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
