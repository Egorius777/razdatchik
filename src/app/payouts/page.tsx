"use client";

import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Badge, Button, Card, EmptyState, LoadingState, PageHeader } from "@/components/ui";

function PayoutsContent() {
  const [role, setRole] = useState<"Distributor" | "Tutor">("Distributor");
  const [payouts, setPayouts] = useState<
    Array<{
      id: string;
      periodStart: string;
      periodEnd: string;
      netAmount: string;
      lessonCount: number;
      status: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const me = await fetch("/api/auth/telegram").then((r) => r.json());
    setRole(me.role ?? "Distributor");
    const res = await fetch("/api/payouts").then((r) => r.json());
    setPayouts(res.payouts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markPaid(id: string) {
    await fetch(`/api/payouts/${id}`, { method: "PATCH" });
    await load();
  }

  if (loading) return <LoadingState />;

  return (
    <main className="mx-auto max-w-lg p-4">
      <PageHeader title="Выплаты" subtitle="По неделям" />
      {role === "Distributor" ? (
        <a
          href="/api/payouts/export"
          className="mb-4 inline-flex min-h-11 items-center rounded-xl bg-black/5 px-4 text-sm font-medium"
        >
          Экспорт CSV
        </a>
      ) : null}
      {payouts.length === 0 ? (
        <EmptyState title="Выплат пока нет" description="Появятся после недельного расчёта" />
      ) : (
        <div className="space-y-2">
          {payouts.map((p) => (
            <Card key={p.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {new Date(p.periodStart).toLocaleDateString("ru-RU")} —{" "}
                    {new Date(p.periodEnd).toLocaleDateString("ru-RU")}
                  </p>
                  <p className="text-sm text-[var(--tg-hint)]">{p.lessonCount} уроков</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">
                    {Number(p.netAmount).toLocaleString("ru-RU")} ₽
                  </p>
                  <Badge tone={p.status === "Paid" ? "success" : "warning"}>{p.status}</Badge>
                </div>
              </div>
              {role === "Distributor" && p.status === "Pending" ? (
                <Button className="w-full" onClick={() => markPaid(p.id)}>
                  Отметить выплачено
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      <BottomNav role={role} />
    </main>
  );
}

export default function PayoutsPage() {
  return (
    <Suspense fallback={null}>
      <AppShell>
        <PayoutsContent />
      </AppShell>
    </Suspense>
  );
}
