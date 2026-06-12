"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, LoadingState, PageHeader } from "@/components/ui";

function StudentDetailContent() {
  const params = useParams();
  const id = String(params.id);
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
    fetch(`/api/students/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setStudent(d.student);
        setLoading(false);
      });
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
    <main className="mx-auto max-w-lg p-4">
      <PageHeader title={student.name} subtitle={`${Number(student.defaultPrice).toLocaleString("ru-RU")} ₽ / урок`} />
      <Button className="mb-4 w-full" onClick={addLesson}>
        + Отметить урок проведённым
      </Button>
      <Card className="mb-4 space-y-3">
        <p className="text-sm font-medium">Отметить оплату</p>
        <input
          type="number"
          className="min-h-11 w-full rounded-xl border border-black/10 px-3"
          placeholder={`Сумма, ₽ (по умолчанию ${student.defaultPrice})`}
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
      <div className="space-y-2">
        {student.lessons.map((l) => (
          <Card key={l.id} className="flex items-center justify-between py-3">
            <div>
              <p>{new Date(l.scheduledAt).toLocaleString("ru-RU")}</p>
              <Badge tone={l.status === "Done" ? "success" : "default"}>{l.status}</Badge>
            </div>
            <span className="font-semibold">{Number(l.tutorAmount).toLocaleString("ru-RU")} ₽</span>
          </Card>
        ))}
      </div>
    </main>
  );
}

export default function StudentDetailPage() {
  return (
    <Suspense fallback={null}>
      <AppShell>
        <StudentDetailContent />
      </AppShell>
    </Suspense>
  );
}
