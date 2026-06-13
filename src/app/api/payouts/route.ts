import { prisma } from "@/lib/db";
import { jsonError, requireAuth } from "@/lib/auth";
import { attachTutorToPayouts } from "@/lib/members";
import { serializeBigInt } from "@/lib/utils";

export async function GET() {
  try {
    const auth = await requireAuth();
    const payouts = await prisma.payout.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(auth.role === "Tutor" ? { tutorId: auth.userId } : {}),
      },
      orderBy: [{ periodStart: "desc" }, { tutorId: "asc" }],
    });
    const enriched = await attachTutorToPayouts(payouts);
    return Response.json(serializeBigInt({ payouts: enriched }));
  } catch (error) {
    return jsonError(error);
  }
}
