import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireDistributor } from "@/lib/auth";
import { serializeBigInt } from "@/lib/utils";

const actionSchema = z.object({ action: z.enum(["confirm", "dispute"]) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireDistributor();
    const { id } = await params;
    const { action } = actionSchema.parse(await request.json());

    const payment = await prisma.payment.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!payment) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data:
        action === "confirm"
          ? {
              status: "Confirmed",
              confirmedById: auth.userId,
              confirmedAt: new Date(),
            }
          : { status: "Disputed" },
    });

    return Response.json(serializeBigInt({ payment: updated }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.flatten() }, { status: 400 });
    }
    return jsonError(error);
  }
}
