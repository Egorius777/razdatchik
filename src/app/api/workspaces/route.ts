import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionFromCookies,
  jsonError,
  requireAuth,
  setWorkspaceCookie,
} from "@/lib/auth";
import { serializeBigInt } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  cardDetails: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = createSchema.parse(await request.json());

    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: body.name,
          ownerUserId: session.userId,
          cardDetails: body.cardDetails,
        },
      });
      await tx.membership.create({
        data: {
          workspaceId: ws.id,
          userId: session.userId,
          role: "Distributor",
          status: "Active",
        },
      });
      return ws;
    });

    await setWorkspaceCookie(workspace.id);
    return Response.json(serializeBigInt({ workspace }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}

export async function GET() {
  try {
    const auth = await requireAuth();
    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
    });
    return Response.json(serializeBigInt({ workspace }));
  } catch (error) {
    return jsonError(error);
  }
}

const settingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cardDetails: z.string().nullable().optional(),
  settlementWeekday: z.number().int().min(1).max(7).optional(),
});

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.role !== "Distributor") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = settingsSchema.parse(await request.json());
    const workspace = await prisma.workspace.update({
      where: { id: auth.workspaceId },
      data: body,
    });
    return Response.json(serializeBigInt({ workspace }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}
