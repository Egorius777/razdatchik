import { createHmac, timingSafeEqual } from "crypto";

export type TelegramWebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
};

export type ParsedInitData = {
  user: TelegramWebAppUser;
  authDate: number;
  hash: string;
  raw: Record<string, string>;
};

function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400
): ParsedInitData {
  const data = parseInitData(initData);
  const hash = data.hash;
  if (!hash) {
    throw new Error("Missing hash in initData");
  }

  const checkString = Object.keys(data)
    .filter((key) => key !== "hash")
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(checkString).digest("hex");

  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid initData signature");
  }

  const authDate = Number(data.auth_date);
  if (!authDate || Number.isNaN(authDate)) {
    throw new Error("Invalid auth_date");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > maxAgeSeconds) {
    throw new Error("initData expired");
  }

  const userRaw = data.user;
  if (!userRaw) {
    throw new Error("Missing user in initData");
  }

  const user = JSON.parse(userRaw) as TelegramWebAppUser;
  if (!user?.id) {
    throw new Error("Invalid user in initData");
  }

  return { user, authDate, hash, raw: data };
}

export function getBotToken(): string {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error("BOT_TOKEN is not configured");
  }
  return token;
}

export function getPublicAppUrl(): string {
  return process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
}
