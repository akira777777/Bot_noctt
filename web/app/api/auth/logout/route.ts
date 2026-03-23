import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

function createLogoutResponse() {
  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"));
  response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}

export async function GET() {
  return createLogoutResponse();
}

export async function POST() {
  return createLogoutResponse();
}
