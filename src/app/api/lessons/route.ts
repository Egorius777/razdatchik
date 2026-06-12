import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireAuth } from "@/lib/auth";
import { buildLessonCreateData } from "@/lib/settlement";
import { getWeekBounds, serializeBigInt, tutorScope } from "@/lib/utils";

const createSchema = z.object({
  studentId: z.string(),
  scheduledAt: z.string().datetime(),
  status: z.enum(["Planned", "Done", "Cancelled", "NoShow"]).optional(),
  isTrial: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const week = url.searchParams.get("week") === "current";

    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
    });

    let dateFilter = {};
    if (week && workspace) {
      const { start, end } = getWeekBounds(new Date(), workspace.settlementWeekday);
      dateFilter = { scheduledAt: { gte: start, lte: end } };
    }

    const lessons = await prisma.lesson.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...tutorScope(auth),
        ...dateFilter,
      },
      include: {
        student: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: "desc" },
    });

    return Response.json(serializeBigInt({ lessons }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = createSchema.parse(await request.json());

    const student = await prisma.student.findFirst({
      where: {
        id: body.studentId,
        workspaceId: auth.workspaceId,
        ...tutorScope(auth),
      },
    });
    if (!student) {
      return Response.json({ error: "Student not found" }, { status: 404 });
    }

    const data = buildLessonCreateData(student, {
      workspaceId: auth.workspaceId,
      studentId: student.id,
      tutorId: student.tutorId,
      scheduledAt: new Date(body.scheduledAt),
      status: body.status,
      isTrial: body.isTrial,
      notes: body.notes,
      createdById: auth.userId,
    });

    const lesson = await prisma.lesson.create({ data });
    return Response.json(serializeBigInt({ lesson }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}
