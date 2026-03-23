import { NextRequest, NextResponse } from "next/server";
import {
  verifyTelegramLogin,
  isAdmin,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const data = await req.json();

  if (!data.id || !data.hash || !data.auth_date) {
    return NextResponse.json({ ok: false, error: "Invalid data" }, { status: 400 });
  }

  if (!verifyTelegramLogin(data)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  if (!isAdmin(Number(data.id))) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const token = createSessionToken(Number(data.id));

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}
