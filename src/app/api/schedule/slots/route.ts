import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireAuth } from "@/lib/auth";
import { serializeBigInt } from "@/lib/utils";

const slotSchema = z.object({
  studentId: z.string(),
  weekday: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMin: z.number().int().min(15).max(480).optional(),
});

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.role !== "Tutor") {
      return Response.json({ error: "Tutor access required" }, { status: 403 });
    }

    const slots = await prisma.scheduleSlot.findMany({
      where: {
        workspaceId: auth.workspaceId,
        tutorId: auth.userId,
      },
      include: {
        student: { select: { id: true, name: true } },
      },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });

    return Response.json(serializeBigInt({ slots }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.role !== "Tutor") {
      return Response.json({ error: "Tutor access required" }, { status: 403 });
    }

    const body = slotSchema.parse(await request.json());

    const student = await prisma.student.findFirst({
      where: {
        id: body.studentId,
        workspaceId: auth.workspaceId,
        tutorId: auth.userId,
      },
    });
    if (!student) {
      return Response.json({ error: "Student not found" }, { status: 404 });
    }

    const slot = await prisma.scheduleSlot.create({
      data: {
        workspaceId: auth.workspaceId,
        tutorId: auth.userId,
        studentId: body.studentId,
        weekday: body.weekday,
        startTime: body.startTime,
        durationMin: body.durationMin ?? 60,
      },
      include: {
        student: { select: { id: true, name: true } },
      },
    });

    return Response.json(serializeBigInt({ slot }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}
