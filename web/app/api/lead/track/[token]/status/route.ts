import { NextRequest, NextResponse } from "next/server";

const BOT_API = process.env.API_URL || "http://localhost:3000";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await fetch(`${BOT_API}/api/lead/track/${token}/status`, {
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
