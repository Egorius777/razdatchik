"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTelegram } from "@/components/telegram-provider";
import { Button, Card, Input, LoadingState, PageHeader } from "@/components/ui";

type Membership = {
  workspaceId: string;
  role: "Distributor" | "Tutor";
  workspace: { id: string; name: string };
};

type MeResponse = {
  authenticated: boolean;
  user?: { firstName: string };
  memberships?: Membership[];
  workspaceId?: string | null;
  role?: "Distributor" | "Tutor" | null;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { initData } = useTelegram();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timezoneSynced = useRef(false);

  const syncTimezone = useCallback(async () => {
    if (timezoneSynced.current) return;
    timezoneSynced.current = true;
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
    } catch {
      timezoneSynced.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/telegram");
    const data = (await res.json()) as MeResponse;
    setMe(data);
    return data;
  }, []);

  const login = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: initData || "dev" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Auth failed");
      }
      const data = await refresh();
      await syncTimezone();
      const invite = searchParams.get("invite");
      if (invite && !data.workspaceId) {
        await fetch("/api/workspaces/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: invite }),
        });
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }, [initData, refresh, searchParams, syncTimezone]);

  useEffect(() => {
    refresh()
      .then((data) => {
        if (!data.authenticated) {
          return login();
        }
        void syncTimezone();
        setLoading(false);
      })
      .catch(() => login());
  }, [login, refresh, syncTimezone]);

  if (loading) return <LoadingState />;
  if (error) {
    return (
      <main className="mx-auto max-w-lg p-4">
        <PageHeader title="Раздатчик" subtitle="Учёт уроков и выплат" />
        <Card>
          <p className="mb-3 text-sm text-rose-600">{error}</p>
          <p className="mb-4 text-sm text-[var(--tg-hint)]">
            Откройте приложение через Telegram или задайте BOT_TOKEN для dev-режима.
          </p>
          <Button onClick={login}>Повторить вход</Button>
        </Card>
      </main>
    );
  }

  if (!me?.authenticated) return <LoadingState />;

  if (!me.workspaceId) {
    return (
      <Onboarding
        memberships={me.memberships ?? []}
        onDone={async () => {
          await refresh();
          router.refresh();
        }}
      />
    );
  }

  return <>{children}</>;
}

function Onboarding({
  memberships,
  onDone,
}: {
  memberships: Membership[];
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function selectWorkspace(workspaceId: string) {
    setBusy(true);
    await fetch("/api/workspaces/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    setBusy(false);
    onDone();
  }

  async function createWorkspace() {
    setBusy(true);
    await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    onDone();
  }

  async function joinWorkspace() {
    setBusy(true);
    await fetch("/api/workspaces/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <main className="mx-auto max-w-lg p-4">
      <PageHeader title="Добро пожаловать" subtitle="Создайте workspace или вступите по коду" />

      {memberships.length > 0 && mode === "choose" ? (
        <div className="space-y-3">
          {memberships.map((m) => (
            <Card key={m.workspaceId} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{m.workspace.name}</p>
                <p className="text-sm text-[var(--tg-hint)]">
                  {m.role === "Distributor" ? "Раздатчик" : "Репетитор"}
                </p>
              </div>
              <Button disabled={busy} onClick={() => selectWorkspace(m.workspaceId)}>
                Войти
              </Button>
            </Card>
          ))}
          <Button variant="secondary" className="w-full" onClick={() => setMode("create")}>
            Создать новый workspace
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setMode("join")}>
            Ввести код приглашения
          </Button>
        </div>
      ) : null}

      {mode === "create" ? (
        <Card className="space-y-3">
          <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} placeholder="Моя сеть" />
          <Button className="w-full" disabled={busy || !name.trim()} onClick={createWorkspace}>
            Создать как раздатчик
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setMode("choose")}>
            Назад
          </Button>
        </Card>
      ) : null}

      {mode === "join" ? (
        <Card className="space-y-3">
          <Input label="Код приглашения" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <Button className="w-full" disabled={busy || code.length < 4} onClick={joinWorkspace}>
            Вступить
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setMode("choose")}>
            Назад
          </Button>
        </Card>
      ) : null}

      {memberships.length === 0 && mode === "choose" ? (
        <div className="space-y-3">
          <Button className="w-full" onClick={() => setMode("create")}>
            Я раздатчик — создать workspace
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setMode("join")}>
            Я репетитор — ввести код
          </Button>
        </div>
      ) : null}
    </main>
  );
}
