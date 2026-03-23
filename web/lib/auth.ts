import { cookies } from "next/headers";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET?.trim() || "";
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const ADMIN_ID = Number(process.env.ADMIN_ID || "0");
const SESSION_COOKIE = "bot_noct_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

interface TelegramLoginData {
  id: number;
  first_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyTelegramLogin(data: TelegramLoginData): boolean {
  if (!BOT_TOKEN) {
    return false;
  }

  const { hash, ...rest } = data;

  // Check auth_date is not too old (1 day)
  const now = Math.floor(Date.now() / 1000);
  if (now - data.auth_date > 86400) {
    return false;
  }

  // Build check string
  const checkString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key as keyof typeof rest]}`)
    .join("\n");

  // Verify hash
  const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

  return safeCompare(hmac, hash);
}

export function isAdmin(telegramId: number): boolean {
  return telegramId === ADMIN_ID;
}

export function createSessionToken(telegramId: number): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is required for web sessions");
  }

  const payload = JSON.stringify({ sub: telegramId, iat: Math.floor(Date.now() / 1000) });
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): { sub: number } | null {
  if (!JWT_SECRET) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(encoded).digest("base64url");
  if (!safeCompare(signature, expectedSig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (now - payload.iat > SESSION_MAX_AGE) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{ telegramId: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload || !isAdmin(payload.sub)) return null;

  return { telegramId: payload.sub };
}

export { SESSION_COOKIE, SESSION_MAX_AGE, ADMIN_ID };
