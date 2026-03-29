import { NextResponse } from "next/server";

const BOT_API = process.env.API_URL || "http://localhost:3000";

export async function GET() {
  try {
    const res = await fetch(`${BOT_API}/api/catalog`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, products: [] }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, products: [] }, { status: 503 });
  }
}
