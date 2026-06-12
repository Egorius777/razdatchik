import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionFromCookies, jsonError, setWorkspaceCookie } from "@/lib/auth";

const selectSchema = z.object({ workspaceId: z.string() });

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = selectSchema.parse(await request.json());
    const membership = await prisma.membership.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: session.userId },
      },
    });

    if (!membership || membership.status !== "Active") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    await setWorkspaceCookie(workspaceId);
    return Response.json({ ok: true, role: membership.role });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}
