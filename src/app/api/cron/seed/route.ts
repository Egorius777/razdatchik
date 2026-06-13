import { prisma } from "@/lib/db";
import { runDemoSeed } from "@/lib/demo-seed";
import { serializeBigInt } from "@/lib/utils";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-cron-secret");
  const url = new URL(request.url);
  return header === secret || url.searchParams.get("secret") === secret;
}

export async function POST(request: Request) {
  if (!verifyCron(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await runDemoSeed(prisma);
    return Response.json(serializeBigInt({ ok: true, summary }));
  } catch (error) {
    console.error("Demo seed failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  if (!verifyCron(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: {
      memberships: {
        include: { workspace: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(
    serializeBigInt({
      users: users.map((u) => ({
        id: u.id,
        telegramId: u.telegramId.toString(),
        firstName: u.firstName,
        username: u.username,
        memberships: u.memberships.map((m) => ({
          role: m.role,
          workspaceId: m.workspaceId,
          workspaceName: m.workspace.name,
        })),
      })),
    })
  );
}
