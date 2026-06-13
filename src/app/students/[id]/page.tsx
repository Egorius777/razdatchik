"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BackHeader } from "@/components/back-header";
import { BottomNav } from "@/components/bottom-nav";
import { Badge, Button, Card, Input, LoadingState } from "@/components/ui";
import { getLessonStatusLabel, LESSON_STATUS_TONE } from "@/lib/status";

function StudentDetailContent() {
  const params = useParams();
  const id = String(params.id);
  const [role, setRole] = useState<"Distributor" | "Tutor">("Tutor");
  const [student, setStudent] = useState<{
    name: string;
    defaultPrice: string;
    lessons: Array<{ id: string; scheduledAt: string; status: string; tutorAmount: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [payBusy, setPayBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/telegram").then((r) => r.json());
      setRole(me.role ?? "Tutor");
      const res = await fetch(`/api/students/${id}`).then((r) => r.json());
      setStudent(res.student);
      setLoading(false);
    }
    load();
  }, [id]);

  async function reportPayment(lessonId?: string) {
    setPayBusy(true);
    const form = new FormData();
    form.set("studentId", id);
    form.set("amount", paymentAmount || student!.defaultPrice);
    if (lessonId) form.set("lessonId", lessonId);
    if (receiptFile) form.set("receipt", receiptFile);
    await fetch("/api/payments", { method: "POST", body: form });
    setPayBusy(false);
    setReceiptFile(null);
    const res = await fetch(`/api/students/${id}`).then((r) => r.json());
    setStudent(res.student);
  }

  async function addLesson() {
    await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: id,
        scheduledAt: new Date().toISOString(),
        status: "Done",
      }),
    });
    const res = await fetch(`/api/students/${id}`).then((r) => r.json());
    setStudent(res.student);
  }

  if (loading) return <LoadingState />;
  if (!student) return null;

  return (
    <main className="mx-auto max-w-lg p-4 pb-28">
      <BackHeader
        href="/students"
        title={student.name}
        subtitle={`${Number(student.defaultPrice).toLocaleString("ru-RU")} ₽ / урок`}
      />

      <Link href="/schedule" className="mb-4 block">
        <Card className="py-3 text-sm text-[var(--tg-link)] active:scale-[0.99]">
          Открыть в расписании →
        </Card>
      </Link>

      <Button className="mb-4 w-full" onClick={addLesson}>
        + Отметить урок проведённым сейчас
      </Button>

      <Card className="mb-4 space-y-3">
        <p className="text-sm font-medium">Отметить оплату</p>
        <Input
          label="Сумма, ₽"
          type="number"
          placeholder={`По умолчанию ${student.defaultPrice}`}
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
        />
        <input
          type="file"
          accept="image/*,.pdf"
          className="text-sm"
          onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
        />
        <Button className="w-full" disabled={payBusy} onClick={() => reportPayment()}>
          Отправить на подтверждение
        </Button>
      </Card>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--tg-hint)]">
        Уроки
      </h2>
      <div className="space-y-2">
        {student.lessons.length === 0 ? (
          <Card className="py-4 text-center text-sm text-[var(--tg-hint)]">
            Уроков пока нет — добавьте в расписании
          </Card>
        ) : (
          student.lessons.map((l) => (
            <Card key={l.id} className="flex items-center justify-between py-3">
              <div>
                <p>{new Date(l.scheduledAt).toLocaleString("ru-RU")}</p>
                <Badge tone={LESSON_STATUS_TONE[l.status] ?? "default"}>
                  {getLessonStatusLabel(l.status)}
                </Badge>
              </div>
              <span className="font-semibold">
                {Number(l.tutorAmount).toLocaleString("ru-RU")} ₽
              </span>
            </Card>
          ))
        )}
      </div>

      <BottomNav role={role} />
    </main>
  );
}

export default function StudentDetailPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AppShell>
        <StudentDetailContent />
      </AppShell>
    </Suspense>
  );
}
