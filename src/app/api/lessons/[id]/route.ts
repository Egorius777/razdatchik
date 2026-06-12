import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireAuth } from "@/lib/auth";
import { calculateLessonAmounts } from "@/lib/money";
import { serializeBigInt, tutorScope } from "@/lib/utils";

const updateSchema = z.object({
  status: z.enum(["Planned", "Done", "Cancelled", "NoShow"]).optional(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const lesson = await prisma.lesson.findFirst({
      where: { id, workspaceId: auth.workspaceId, ...tutorScope(auth) },
      include: { student: true },
    });
    if (!lesson) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    let updateData: Record<string, unknown> = { ...body };
    if (body.scheduledAt) {
      updateData.scheduledAt = new Date(body.scheduledAt);
    }

    if (body.status === "Done" && lesson.status !== "Done") {
      const amounts = calculateLessonAmounts({
        price: lesson.student.defaultPrice,
        commissionType: lesson.student.commissionType,
        commissionValue: lesson.student.commissionValue,
      });
      updateData = {
        ...updateData,
        price: amounts.price.toFixed(0),
        commissionType: lesson.student.commissionType,
        commissionValue: lesson.student.commissionValue,
        commissionAmount: amounts.commissionAmount.toFixed(0),
        tutorAmount: amounts.tutorAmount.toFixed(0),
      };
    }

    const updated = await prisma.lesson.update({
      where: { id },
      data: updateData,
    });

    return Response.json(serializeBigInt({ lesson: updated }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}
