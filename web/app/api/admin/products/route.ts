import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { adminFetch } from "@/lib/admin-api";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.text();
  const response = await adminFetch("/products", {
    method: "POST",
    body,
  });

  const payload = await response.text();
  return new NextResponse(payload, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}
