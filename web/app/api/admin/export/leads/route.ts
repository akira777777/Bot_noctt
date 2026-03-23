import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { adminFetch } from "@/lib/admin-api";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const response = await adminFetch("/export/leads");
  const payload = await response.arrayBuffer();
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  const contentDisposition = response.headers.get("content-disposition");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  if (contentDisposition) {
    headers.set("Content-Disposition", contentDisposition);
  }

  return new NextResponse(payload, {
    status: response.status,
    headers,
  });
}
