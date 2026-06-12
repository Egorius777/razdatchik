"use client";

import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Badge, Card, EmptyState, LoadingState, PageHeader } from "@/components/ui";

function HistoryContent() {
  const [role, setRole] = useState<"Distributor" | "Tutor">("Tutor");
  const [lessons, setLessons] = useState<
    Array<{
      id: string;
      scheduledAt: string;
      status: string;
      tutorAmount: string;
      student?: { name: string };
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/telegram").then((r) => r.json());
      setRole(me.role ?? "Tutor");
      const res = await fetch("/api/lessons").then((r) => r.json());
      setLessons(res.lessons ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  const total = lessons
    .filter((l) => l.status === "Done")
    .reduce((acc, l) => acc + Number(l.tutorAmount), 0);

  return (
    <main className="mx-auto max-w-lg p-4">
      <PageHeader title="История" subtitle={`Заработок: ${total.toLocaleString("ru-RU")} ₽`} />
      {lessons.length === 0 ? (
        <EmptyState title="Уроков пока нет" />
      ) : (
        <div className="space-y-2">
          {lessons.map((l) => (
            <Card key={l.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{l.student?.name ?? "Урок"}</p>
                <p className="text-sm text-[var(--tg-hint)]">
                  {new Date(l.scheduledAt).toLocaleDateString("ru-RU")}
                </p>
                <Badge tone={l.status === "Done" ? "success" : "default"}>{l.status}</Badge>
              </div>
              <span className="font-semibold">{Number(l.tutorAmount).toLocaleString("ru-RU")} ₽</span>
            </Card>
          ))}
        </div>
      )}
      <BottomNav role={role} />
    </main>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <AppShell>
        <HistoryContent />
      </AppShell>
    </Suspense>
  );
}
