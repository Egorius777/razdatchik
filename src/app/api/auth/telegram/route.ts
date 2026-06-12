import { prisma } from "@/lib/db";
import {
  createSessionToken,
  getSessionFromCookies,
  getWorkspaceIdFromCookies,
  jsonError,
  setSessionCookie,
  setWorkspaceCookie,
} from "@/lib/auth";
import { getBotToken, validateTelegramInitData } from "@/lib/telegram";
import { serializeBigInt } from "@/lib/utils";

function isDevInitData(initData: string): boolean {
  return initData === "dev" && process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { initData?: string };
    if (!body.initData) {
      return Response.json({ error: "initData required" }, { status: 400 });
    }

    let telegramId: bigint;
    let userData: {
      firstName: string;
      lastName?: string;
      username?: string;
      photoUrl?: string;
    };

    if (isDevInitData(body.initData)) {
      telegramId = BigInt(900000001);
      userData = { firstName: "Dev", lastName: "User", username: "dev_user" };
    } else {
      const parsed = validateTelegramInitData(body.initData, getBotToken());
      telegramId = BigInt(parsed.user.id);
      userData = {
        firstName: parsed.user.first_name,
        lastName: parsed.user.last_name,
        username: parsed.user.username,
        photoUrl: parsed.user.photo_url,
      };
    }

    const user = await prisma.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
        photoUrl: userData.photoUrl,
      },
      update: {
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
        photoUrl: userData.photoUrl,
      },
    });

    const token = await createSessionToken({
      userId: user.id,
      telegramId: user.telegramId.toString(),
    });
    await setSessionCookie(token);

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: "Active" },
      include: { workspace: true },
    });

    if (memberships.length === 1) {
      await setWorkspaceCookie(memberships[0].workspaceId);
    }

    return Response.json(
      serializeBigInt({
        user,
        memberships,
        workspaceSelected: memberships.length === 1,
      })
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("initData")) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return jsonError(error);
  }
}

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return Response.json({ authenticated: false });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      return Response.json({ authenticated: false });
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: "Active" },
      include: { workspace: true },
    });

    const workspaceId = await getWorkspaceIdFromCookies();
    const activeMembership = workspaceId
      ? memberships.find((m) => m.workspaceId === workspaceId)
      : null;

    return Response.json(
      serializeBigInt({
        authenticated: true,
        user,
        memberships,
        workspaceId,
        role: activeMembership?.role ?? null,
      })
    );
  } catch (error) {
    return jsonError(error);
  }
}
