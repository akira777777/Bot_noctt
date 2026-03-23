import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { adminFetch } from "@/lib/admin-api";

interface Props {
  params: Promise<{ clientId: string }>;
}

export async function POST(req: NextRequest, { params }: Props) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const body = await req.text();
  const response = await adminFetch(`/conversations/${clientId}/reply`, {
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
