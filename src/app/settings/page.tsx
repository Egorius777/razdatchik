"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, GraduationCap, Settings2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Button, Card, Input, LoadingState, PageHeader, Select } from "@/components/ui";

function SettingsContent() {
  const [role, setRole] = useState<"Distributor" | "Tutor">("Tutor");
  const [workspace, setWorkspace] = useState<{
    name: string;
    cardDetails?: string | null;
    settlementWeekday: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/telegram").then((r) => r.json());
      setRole(me.role ?? "Tutor");
      const res = await fetch("/api/workspaces").then((r) => r.json());
      setWorkspace(res.workspace);
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    if (!workspace || role !== "Distributor") return;
    await fetch("/api/workspaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workspace),
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  if (loading) return <LoadingState />;

  return (
    <main className="mx-auto max-w-lg p-4 pb-28">
      <PageHeader title="Настройки" />
      <Card className="mb-4 space-y-3">
        <p className="text-sm text-[var(--tg-hint)]">Workspace</p>
        <p className="font-medium">{workspace?.name}</p>
        {role === "Distributor" && workspace ? (
          <>
            <Input
              label="Реквизиты карты"
              value={workspace.cardDetails ?? ""}
              onChange={(e) => setWorkspace({ ...workspace, cardDetails: e.target.value })}
            />
            <Select
              label="День расчёта (1=Пн)"
              value={String(workspace.settlementWeekday)}
              onChange={(e) =>
                setWorkspace({ ...workspace, settlementWeekday: Number(e.target.value) })
              }
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <Button className="w-full" onClick={save}>
              Сохранить
            </Button>
          </>
        ) : null}
      </Card>

      {role === "Tutor" ? (
        <Card className="mb-4 space-y-2">
          <p className="text-sm font-medium">Расписание</p>
          <Link
            href="/schedule"
            className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--tg-muted-surface)] px-3 text-sm active:scale-[0.99]"
          >
            <CalendarDays className="h-4 w-4" />
            Открыть расписание
          </Link>
          <Link
            href="/schedule/setup"
            className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--tg-muted-surface)] px-3 text-sm active:scale-[0.99]"
          >
            <Settings2 className="h-4 w-4" />
            Шаблон повторяющихся уроков
          </Link>
        </Card>
      ) : (
        <Card className="mb-4 space-y-2">
          <p className="text-sm font-medium">Управление</p>
          <Link
            href="/students"
            className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--tg-muted-surface)] px-3 text-sm active:scale-[0.99]"
          >
            <GraduationCap className="h-4 w-4" />
            Все ученики команды
          </Link>
        </Card>
      )}

      <Button variant="secondary" className="w-full" onClick={logout}>
        Выйти
      </Button>
      <BottomNav role={role} />
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <AppShell>
        <SettingsContent />
      </AppShell>
    </Suspense>
  );
}
