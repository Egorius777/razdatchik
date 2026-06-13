import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireAuth } from "@/lib/auth";
import { serializeBigInt, tutorScope } from "@/lib/utils";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  payerName: z.string().min(1).max(120).nullable().optional(),
  contact: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  defaultPrice: z.number().int().positive().optional(),
  commissionType: z.enum(["Percent", "Fixed"]).optional(),
  commissionValue: z.number().int().nonnegative().optional(),
  status: z.enum(["Trial", "Active", "Paused", "Archived"]).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const student = await prisma.student.findFirst({
      where: { id, workspaceId: auth.workspaceId, ...tutorScope(auth) },
      include: {
        lessons: { orderBy: { scheduledAt: "desc" }, take: 20 },
        payments: { orderBy: { reportedAt: "desc" }, take: 10 },
      },
    });

    if (!student) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(serializeBigInt({ student }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const existing = await prisma.student.findFirst({
      where: { id, workspaceId: auth.workspaceId, ...tutorScope(auth) },
    });
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const student = await prisma.student.update({
      where: { id },
      data: body,
    });

    return Response.json(serializeBigInt({ student }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}
