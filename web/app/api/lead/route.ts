import { NextRequest, NextResponse } from "next/server";

const BOT_API = process.env.API_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${BOT_API}/api/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
