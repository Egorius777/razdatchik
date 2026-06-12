import { jsonError, requireAuth } from "@/lib/auth";
import { readReceiptForAuth } from "@/lib/receipts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const { buffer, mime, filename } = await readReceiptForAuth(auth, id);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Receipt not found") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return jsonError(error);
  }
}
