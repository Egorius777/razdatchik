import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      memberships: { include: { workspace: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(
    JSON.stringify(
      users.map((u) => ({
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
      null,
      2
    )
  );
}

main()
  .finally(() => prisma.$disconnect());
