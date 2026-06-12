import { prisma } from "@/lib/db";
import { jsonError, requireAuth, requireDistributor } from "@/lib/auth";
import { serializeBigInt } from "@/lib/utils";

export async function GET() {
  try {
    const auth = await requireDistributor();
    const tutors = await prisma.membership.findMany({
      where: { workspaceId: auth.workspaceId, role: "Tutor", status: "Active" },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            telegramId: true,
          },
        },
      },
    });
    return Response.json(serializeBigInt({ tutors }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST() {
  return requireAuth().then(() =>
    Response.json({ error: "Use /api/invites" }, { status: 405 })
  );
}
