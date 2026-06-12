import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionFromCookies, jsonError, setWorkspaceCookie } from "@/lib/auth";
import { serializeBigInt } from "@/lib/utils";

const joinSchema = z.object({ code: z.string().min(4).max(32) });

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = joinSchema.parse(await request.json());
    const invite = await prisma.invite.findUnique({
      where: { code: code.toUpperCase() },
      include: { workspace: true },
    });

    if (!invite) {
      return Response.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.usedById) {
      return Response.json({ error: "Invite already used" }, { status: 400 });
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return Response.json({ error: "Invite expired" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.membership.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: session.userId,
          },
        },
        create: {
          workspaceId: invite.workspaceId,
          userId: session.userId,
          role: "Tutor",
          status: "Active",
        },
        update: { status: "Active", role: "Tutor" },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { usedById: session.userId, usedAt: new Date() },
      });
    });

    await setWorkspaceCookie(invite.workspaceId);
    return Response.json(serializeBigInt({ workspace: invite.workspace }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}
