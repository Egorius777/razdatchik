"use client";

import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Badge, Button, Card, EmptyState, LoadingState, PageHeader } from "@/components/ui";

function ConfirmationsContent() {
  const [payments, setPayments] = useState<
    Array<{
      id: string;
      amount: string;
      status: string;
      student?: { name: string };
      receipt?: { id: string } | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/payments?status=Reported").then((r) => r.json());
    setPayments(res.payments ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "confirm" | "dispute") {
    await fetch(`/api/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
  }

  if (loading) return <LoadingState />;

  return (
    <main className="mx-auto max-w-lg p-4">
      <PageHeader title="Очередь подтверждений" subtitle="Оплаты от репетиторов" />
      {payments.length === 0 ? (
        <EmptyState title="Всё подтверждено" description="Новых оплат нет" />
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <Card key={p.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.student?.name}</p>
                  <p className="text-lg font-semibold">{Number(p.amount).toLocaleString("ru-RU")} ₽</p>
                </div>
                <Badge tone="warning">{p.status}</Badge>
              </div>
              {p.receipt ? (
                <a
                  className="text-sm text-[var(--tg-link)]"
                  href={`/api/receipts/${p.receipt.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть чек
                </a>
              ) : null}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => act(p.id, "confirm")}>
                  Подтвердить
                </Button>
                <Button variant="danger" className="flex-1" onClick={() => act(p.id, "dispute")}>
                  Оспорить
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <BottomNav role="Distributor" />
    </main>
  );
}

export default function ConfirmationsPage() {
  return (
    <Suspense fallback={null}>
      <AppShell>
        <ConfirmationsContent />
      </AppShell>
    </Suspense>
  );
}
