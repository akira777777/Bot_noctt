import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { adminFetch } from "@/lib/admin-api";

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.text();
  const response = await adminFetch(`/leads/${id}/status`, {
    method: "PATCH",
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
