import { NextResponse } from "next/server";

const BOT_API = process.env.API_URL || "http://localhost:3000";

export async function GET() {
  const res = await fetch(`${BOT_API}/api/catalog`, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 60 },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
