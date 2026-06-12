"use client";

import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Button, Card, EmptyState, LoadingState, PageHeader } from "@/components/ui";

function TutorsContent() {
  const [tutors, setTutors] = useState<
    Array<{
      user: { firstName: string; lastName?: string | null; username?: string | null };
    }>
  >([]);
  const [invite, setInvite] = useState<{ code: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/tutors").then((r) => r.json());
    setTutors(res.tutors ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createInvite() {
    const res = await fetch("/api/invites", { method: "POST" }).then((r) => r.json());
    setInvite(res.invite);
  }

  if (loading) return <LoadingState />;

  return (
    <main className="mx-auto max-w-lg p-4">
      <PageHeader title="Репетиторы" subtitle="Приглашения в workspace" />
      <Button className="mb-4 w-full" onClick={createInvite}>
        Создать код приглашения
      </Button>
      {invite ? (
        <Card className="mb-4">
          <p className="text-sm text-[var(--tg-hint)]">Код (7 дней)</p>
          <p className="text-2xl font-bold tracking-widest">{invite.code}</p>
        </Card>
      ) : null}
      {tutors.length === 0 ? (
        <EmptyState title="Репетиторов пока нет" description="Отправьте код приглашения" />
      ) : (
        <div className="space-y-2">
          {tutors.map((t, i) => (
            <Card key={i} className="py-3">
              <p className="font-medium">
                {t.user.firstName} {t.user.lastName ?? ""}
              </p>
              {t.user.username ? (
                <p className="text-sm text-[var(--tg-hint)]">@{t.user.username}</p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      <BottomNav role="Distributor" />
    </main>
  );
}

export default function TutorsPage() {
  return (
    <Suspense fallback={null}>
      <AppShell>
        <TutorsContent />
      </AppShell>
    </Suspense>
  );
}
