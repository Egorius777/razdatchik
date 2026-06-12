import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { prisma } from "./db";
import type { AuthContext } from "./auth";

export function getReceiptsDir(): string {
  return process.env.RECEIPTS_DIR ?? path.join(process.cwd(), "data", "receipts");
}

export async function saveReceipt(
  auth: AuthContext,
  file: File
): Promise<{ id: string; path: string }> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || ".bin";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const dir = path.join(getReceiptsDir(), auth.workspaceId);
  await mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, safeName);
  await writeFile(fullPath, bytes);

  const record = await prisma.receiptFile.create({
    data: {
      workspaceId: auth.workspaceId,
      path: fullPath,
      mime: file.type || "application/octet-stream",
      size: bytes.length,
      uploadedById: auth.userId,
    },
  });

  return { id: record.id, path: fullPath };
}

export async function readReceiptForAuth(
  auth: AuthContext,
  receiptId: string
): Promise<{ buffer: Buffer; mime: string; filename: string }> {
  const receipt = await prisma.receiptFile.findFirst({
    where: { id: receiptId, workspaceId: auth.workspaceId },
  });
  if (!receipt) {
    throw new Error("Receipt not found");
  }
  const buffer = await readFile(receipt.path);
  return {
    buffer,
    mime: receipt.mime,
    filename: path.basename(receipt.path),
  };
}
