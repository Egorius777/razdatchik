"use client";

import Link from "next/link";
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
import { formatPayerLabel, formatPersonName, formatPeriodRange } from "@/lib/people";
import {
  getLessonStatusLabel,
  getPaymentStatusLabel,
  getPayoutStatusLabel,
  LESSON_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  PAYOUT_STATUS_TONE,
} from "@/lib/status";
import { formatDateKey } from "@/lib/schedule";
import { formatLessonDateTime } from "@/lib/time";

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

  const weekSubtitle = data?.weekStart
    ? `Текущая неделя: ${formatPeriodRange(String(data.weekStart), String(data.weekEnd ?? data.weekStart))}`
    : undefined;

  return (
    <main className="mx-auto max-w-lg p-4 pb-28">
      <PageHeader
        title={role === "Distributor" ? "Дашборд" : "Главная"}
        subtitle={weekSubtitle}
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
        <Card className="border-[var(--badge-warning-bg)] bg-[var(--badge-warning-bg)]">
          <p className="text-sm">
            Ожидает подтверждения: <strong>{String(data.pendingConfirmations)}</strong> оплат
          </p>
        </Card>
      ) : null}
      <section>
        <Link href="/schedule" className="mb-2 block">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--tg-hint)]">
            Уроки недели →
          </h2>
        </Link>
        <div className="space-y-2">
          {(Array.isArray(data.recentLessons) ? data.recentLessons : []).map(
            (lesson: {
              id: string;
              scheduledAt: string;
              status: string;
              tutorAmount: string;
              studentName?: string;
            }) => {
              const dateKey = formatDateKey(new Date(lesson.scheduledAt));
              return (
                <Link key={lesson.id} href={`/schedule?date=${dateKey}`}>
                  <Card className="flex items-center justify-between py-3 active:scale-[0.99]">
                    <div>
                      <p className="font-medium">{lesson.studentName ?? "Урок"}</p>
                      <p className="text-sm text-[var(--tg-hint)]">
                        {formatLessonDateTime(lesson.scheduledAt)}
                      </p>
                      <Badge tone={LESSON_STATUS_TONE[lesson.status] ?? "default"}>
                        {getLessonStatusLabel(lesson.status)}
                      </Badge>
                    </div>
                    <span className="font-semibold">{formatRub(lesson.tutorAmount)}</span>
                  </Card>
                </Link>
              );
            }
          )}
        </div>
      </section>
    </div>
  );
}

type DistributorPayment = {
  id: string;
  amount: string;
  status: string;
  student?: {
    name: string;
    payerName?: string | null;
    tutor?: { firstName: string; lastName?: string | null; username?: string | null };
  };
};

type DistributorPayout = {
  id: string;
  periodStart: string;
  periodEnd: string;
  netAmount: string;
  lessonCount: number;
  status: string;
  tutorName?: string;
  tutor?: { firstName: string; lastName?: string | null; username?: string | null };
};

function DistributorHome({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <EmptyState title="Нет данных" />;
  const kpis = (data.kpis ?? {}) as Record<string, number | string>;
  const payouts = (Array.isArray(data.payouts) ? data.payouts : []) as DistributorPayout[];
  const payments = (Array.isArray(data.payments) ? data.payments : []) as DistributorPayment[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Комиссия"
          value={formatRub(String(kpis.commissionTotal ?? 0))}
          hint="за неделю"
        />
        <KpiCard
          label="Проведено"
          value={String(kpis.lessonsDone ?? 0)}
          hint="уроков за неделю"
        />
        <KpiCard
          label="Ожидает"
          value={String(kpis.incomingReported ?? 0)}
          hint="оплат на проверке"
        />
        <KpiCard
          label="К выплате"
          value={formatRub(String(kpis.payoutPendingSum ?? 0))}
          hint={`${kpis.payoutPending ?? 0} репетиторов`}
        />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--tg-hint)]">
            К выплате репетиторам
          </h2>
          <Link href="/payouts" className="text-xs text-[var(--tg-link)]">
            Все →
          </Link>
        </div>
        {data.payoutPeriodStart ? (
          <p className="mb-2 text-xs text-[var(--tg-hint)]">
            Расчётный период:{" "}
            {formatPeriodRange(
              String(data.payoutPeriodStart),
              String(data.payoutPeriodEnd ?? data.payoutPeriodStart)
            )}
          </p>
        ) : null}
        {payouts.length === 0 ? (
          <Card className="py-4 text-sm text-[var(--tg-hint)]">
            Нет ожидающих выплат. Они появятся после недельного расчёта.
          </Card>
        ) : (
          <div className="space-y-2">
            {payouts.map((p) => (
              <Link key={p.id} href="/payouts">
                <Card className="flex items-center justify-between py-3 active:scale-[0.99]">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--tg-hint)]">
                      Репетитор команды
                    </p>
                    <p className="text-lg font-semibold">
                      {p.tutorName ?? formatPersonName(p.tutor)}
                    </p>
                    <p className="text-sm text-[var(--tg-hint)]">
                      {formatPeriodRange(p.periodStart, p.periodEnd)} · {p.lessonCount}{" "}
                      {p.lessonCount === 1 ? "урок" : p.lessonCount < 5 ? "урока" : "уроков"}
                    </p>
                    <Badge tone={PAYOUT_STATUS_TONE[p.status] ?? "warning"}>
                      {getPayoutStatusLabel(p.status)}
                    </Badge>
                  </div>
                  <span className="font-semibold">{formatRub(p.netAmount)}</span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--tg-hint)]">
            Входящие за неделю
          </h2>
          <Link href="/confirmations" className="text-xs text-[var(--tg-link)]">
            Очередь →
          </Link>
        </div>
        {payments.length === 0 ? (
          <Card className="py-4 text-sm text-[var(--tg-hint)]">Оплат за эту неделю пока нет.</Card>
        ) : (
          <div className="space-y-2">
            {payments.slice(0, 8).map((p) => (
              <Card key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--tg-hint)]">
                    Плательщик
                  </p>
                  <p className="font-medium">{formatPayerLabel(p.student)}</p>
                  <p className="text-sm text-[var(--tg-hint)]">
                    Ученик: {p.student?.name ?? "—"} · Репетитор:{" "}
                    {formatPersonName(p.student?.tutor)}
                  </p>
                  <Badge tone={PAYMENT_STATUS_TONE[p.status] ?? "default"}>
                    {getPaymentStatusLabel(p.status)}
                  </Badge>
                </div>
                <span className="font-semibold">{formatRub(p.amount)}</span>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
