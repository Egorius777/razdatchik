import { prisma } from "@/lib/db";
import { jsonError, requireAuth } from "@/lib/auth";
import { serializeBigInt } from "@/lib/utils";

export async function GET() {
  try {
    const auth = await requireAuth();
    const payouts = await prisma.payout.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(auth.role === "Tutor" ? { tutorId: auth.userId } : {}),
      },
      orderBy: { periodStart: "desc" },
    });
    return Response.json(serializeBigInt({ payouts }));
  } catch (error) {
    return jsonError(error);
  }
}
