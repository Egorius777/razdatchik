import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireAuth, requireDistributor } from "@/lib/auth";
import { generateInviteCode, serializeBigInt, tutorScope } from "@/lib/utils";

const studentSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  notes: z.string().optional(),
  defaultPrice: z.number().int().positive(),
  commissionType: z.enum(["Percent", "Fixed"]),
  commissionValue: z.number().int().nonnegative(),
  status: z.enum(["Trial", "Active", "Paused", "Archived"]).optional(),
  tutorId: z.string().optional(),
});

export async function GET() {
  try {
    const auth = await requireAuth();
    const students = await prisma.student.findMany({
      where: { workspaceId: auth.workspaceId, ...tutorScope(auth) },
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, username: true } },
        _count: { select: { lessons: true } },
      },
      orderBy: { name: "asc" },
    });
    return Response.json(serializeBigInt({ students }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = studentSchema.parse(await request.json());

    const tutorId =
      auth.role === "Distributor" && body.tutorId ? body.tutorId : auth.userId;

    if (auth.role === "Tutor" && tutorId !== auth.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.student.create({
      data: {
        workspaceId: auth.workspaceId,
        tutorId,
        name: body.name,
        contact: body.contact,
        notes: body.notes,
        defaultPrice: body.defaultPrice,
        commissionType: body.commissionType,
        commissionValue: body.commissionValue,
        status: body.status ?? "Active",
      },
    });

    return Response.json(serializeBigInt({ student }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}
