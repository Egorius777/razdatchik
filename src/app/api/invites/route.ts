import { prisma } from "@/lib/db";
import { jsonError, requireDistributor } from "@/lib/auth";
import { generateInviteCode, serializeBigInt } from "@/lib/utils";

export async function GET() {
  try {
    const auth = await requireDistributor();
    const invites = await prisma.invite.findMany({
      where: { workspaceId: auth.workspaceId, usedById: null },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return Response.json(serializeBigInt({ invites }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST() {
  try {
    const auth = await requireDistributor();
    let code = generateInviteCode();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.invite.findUnique({ where: { code } });
      if (!exists) break;
      code = generateInviteCode();
    }

    const invite = await prisma.invite.create({
      data: {
        workspaceId: auth.workspaceId,
        code,
        createdById: auth.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return Response.json(serializeBigInt({ invite }));
  } catch (error) {
    return jsonError(error);
  }
}
