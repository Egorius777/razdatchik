import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireAuth } from "@/lib/auth";
import { serializeBigInt } from "@/lib/utils";

const updateSlotSchema = z.object({
  studentId: z.string().optional(),
  weekday: z.number().int().min(1).max(7).optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  durationMin: z.number().int().min(15).max(480).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.role !== "Tutor") {
      return Response.json({ error: "Tutor access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = updateSlotSchema.parse(await request.json());

    const slot = await prisma.scheduleSlot.findFirst({
      where: { id, workspaceId: auth.workspaceId, tutorId: auth.userId },
    });
    if (!slot) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (body.studentId) {
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
    }

    const updated = await prisma.scheduleSlot.update({
      where: { id },
      data: body,
      include: { student: { select: { id: true, name: true } } },
    });

    return Response.json(serializeBigInt({ slot: updated }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.role !== "Tutor") {
      return Response.json({ error: "Tutor access required" }, { status: 403 });
    }

    const { id } = await params;
    const slot = await prisma.scheduleSlot.findFirst({
      where: { id, workspaceId: auth.workspaceId, tutorId: auth.userId },
    });
    if (!slot) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.scheduleSlot.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
