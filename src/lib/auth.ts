import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

const COOKIE_NAME = "app_session";
const WORKSPACE_COOKIE = "workspace_id";

export type SessionPayload = {
  userId: string;
  telegramId: string;
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  const userId = payload.userId;
  const telegramId = payload.telegramId;
  if (typeof userId !== "string" || typeof telegramId !== "string") {
    throw new Error("Invalid session token");
  }
  return { userId, telegramId };
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(WORKSPACE_COOKIE);
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function setWorkspaceCookie(workspaceId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function getWorkspaceIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
}

export type AuthContext = {
  userId: string;
  telegramId: bigint;
  workspaceId: string;
  role: Role;
  membershipId: string;
};

export async function requireAuth(): Promise<AuthContext> {
  const session = await getSessionFromCookies();
  if (!session) {
    throw new AuthError("Unauthorized", 401);
  }

  const workspaceId = await getWorkspaceIdFromCookies();
  if (!workspaceId) {
    throw new AuthError("Workspace not selected", 403);
  }

  const membership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: session.userId,
      },
    },
    include: { user: true },
  });

  if (!membership || membership.status !== "Active") {
    throw new AuthError("Access denied", 403);
  }

  return {
    userId: session.userId,
    telegramId: membership.user.telegramId,
    workspaceId,
    role: membership.role,
    membershipId: membership.id,
  };
}

export async function requireDistributor(): Promise<AuthContext> {
  const auth = await requireAuth();
  if (auth.role !== "Distributor") {
    throw new AuthError("Distributor access required", 403);
  }
  return auth;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function jsonError(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
