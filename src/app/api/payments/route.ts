import { prisma } from "@/lib/db";
import { jsonError, requireAuth, requireDistributor } from "@/lib/auth";
import { saveReceipt } from "@/lib/receipts";
import { serializeBigInt, tutorScope } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const payments = await prisma.payment.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...tutorScope(auth),
        ...(status ? { status: status as "Reported" | "Confirmed" | "Disputed" } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            payerName: true,
            tutor: { select: { id: true, firstName: true, lastName: true, username: true } },
          },
        },
        receipt: { select: { id: true, mime: true, size: true } },
        lessons: { include: { lesson: true } },
      },
      orderBy: { reportedAt: "desc" },
    });

    return Response.json(serializeBigInt({ payments }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const form = await request.formData();
    const studentId = String(form.get("studentId") ?? "");
    const lessonId = form.get("lessonId") ? String(form.get("lessonId")) : undefined;
    const amount = Number(form.get("amount"));
    const note = form.get("note") ? String(form.get("note")) : undefined;
    const file = form.get("receipt") as File | null;

    if (!studentId || !amount || Number.isNaN(amount)) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, workspaceId: auth.workspaceId, ...tutorScope(auth) },
    });
    if (!student) {
      return Response.json({ error: "Student not found" }, { status: 404 });
    }

    let receiptFileId: string | undefined;
    if (file && file.size > 0) {
      const saved = await saveReceipt(auth, file);
      receiptFileId = saved.id;
    }

    const payment = await prisma.payment.create({
      data: {
        workspaceId: auth.workspaceId,
        studentId: student.id,
        tutorId: student.tutorId,
        amount,
        receiptFileId,
        reportedById: auth.userId,
        note,
        lessons: lessonId ? { create: [{ lessonId }] } : undefined,
      },
      include: { receipt: true },
    });

    return Response.json(serializeBigInt({ payment }));
  } catch (error) {
    return jsonError(error);
  }
}
