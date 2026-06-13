import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireAuth } from "@/lib/auth";
import { serializeBigInt } from "@/lib/utils";

const bodySchema = z.object({
  timezone: z.string().min(1).max(64),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = bodySchema.parse(await request.json());

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { timezone: true },
    });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (user.timezone !== body.timezone) {
      await prisma.user.update({
        where: { id: auth.userId },
        data: { timezone: body.timezone },
      });
    }

    return Response.json(serializeBigInt({ ok: true, timezone: body.timezone }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}
