import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { adminFetch } from "@/lib/admin-api";

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(_req: Request, { params }: Props) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const response = await adminFetch(`/products/${id}/toggle`, {
    method: "PATCH",
  });

  const payload = await response.text();
  return new NextResponse(payload, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}
