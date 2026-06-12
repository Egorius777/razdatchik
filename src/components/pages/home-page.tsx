"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import {
  Badge,
  Card,
  EmptyState,
  KpiCard,
  LoadingState,
  PageHeader,
} from "@/components/ui";

function formatRub(n: string | number) {
  return `${Number(n).toLocaleString("ru-RU")} ₽`;
}

export function HomePage() {
  const [role, setRole] = useState<"Distributor" | "Tutor" | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/telegram").then((r) => r.json());
      setRole(me.role);
      const url =
        me.role === "Distributor" ? "/api/dashboard/distributor" : "/api/dashboard/tutor";
      const dash = await fetch(url).then((r) => r.json());
      setData(dash);
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !role) return <LoadingState />;

  return (
    <main className="mx-auto max-w-lg p-4">
      <PageHeader
        title={role === "Distributor" ? "Дашборд" : "Главная"}
        subtitle={
          data?.weekStart
            ? `Неделя ${new Date(String(data.weekStart)).toLocaleDateString("ru-RU")}`
            : undefined
        }
      />

      {role === "Tutor" ? <TutorHome data={data} /> : <DistributorHome data={data} />}
      <BottomNav role={role} />
    </main>
  );
}

function TutorHome({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <EmptyState title="Нет данных" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Заработок" value={formatRub(String(data.weekEarnings ?? 0))} />
        <KpiCard label="Уроков" value={String(data.lessonsDone ?? 0)} hint={`из ${data.lessonsTotal ?? 0}`} />
      </div>
      {(Number(data.pendingConfirmations) || 0) > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm">
            Ожидает подтверждения: <strong>{String(data.pendingConfirmations)}</strong> оплат
          </p>
        </Card>
      ) : null}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--tg-hint)]">
          Уроки недели
        </h2>
        <div className="space-y-2">
          {(Array.isArray(data.recentLessons) ? data.recentLessons : []).map(
            (lesson: { id: string; scheduledAt: string; status: string; tutorAmount: string }) => (
              <Card key={lesson.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    {new Date(lesson.scheduledAt).toLocaleDateString("ru-RU", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <Badge tone={lesson.status === "Done" ? "success" : "default"}>{lesson.status}</Badge>
                </div>
                <span className="font-semibold">{formatRub(lesson.tutorAmount)}</span>
              </Card>
            )
          )}
        </div>
      </section>
    </div>
  );
}

function DistributorHome({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <EmptyState title="Нет данных" />;
  const kpis = (data.kpis ?? {}) as Record<string, number | string>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Комиссия" value={formatRub(String(kpis.commissionTotal ?? 0))} />
        <KpiCard label="Уроков" value={String(kpis.lessonsDone ?? 0)} />
        <KpiCard label="Ожидает" value={String(kpis.incomingReported ?? 0)} hint="оплат" />
        <KpiCard label="К выплате" value={String(kpis.payoutPending ?? 0)} hint="репетиторов" />
      </div>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--tg-hint)]">
          Входящие за неделю
        </h2>
        <div className="space-y-2">
          {(Array.isArray(data.payments) ? data.payments : []).slice(0, 8).map(
            (p: {
              id: string;
              amount: string;
              status: string;
              student?: { name: string };
            }) => (
              <Card key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{p.student?.name ?? "Ученик"}</p>
                  <Badge
                    tone={
                      p.status === "Confirmed"
                        ? "success"
                        : p.status === "Disputed"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {p.status}
                  </Badge>
                </div>
                <span className="font-semibold">{formatRub(p.amount)}</span>
              </Card>
            )
          )}
        </div>
      </section>
    </div>
  );
}
