import { prisma } from "@/lib/db";
import { jsonError, requireAuth, requireDistributor } from "@/lib/auth";
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireDistributor();
    const { id } = await params;

    const payout = await prisma.payout.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!payout) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.payout.update({
      where: { id },
      data: {
        status: "Paid",
        paidAt: new Date(),
        paidById: auth.userId,
      },
    });

    return Response.json(serializeBigInt({ payout: updated }));
  } catch (error) {
    return jsonError(error);
  }
}
