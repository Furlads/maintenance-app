// app/api/auth/logout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // Clear cookie (host-only)
  res.headers.set(
    "Set-Cookie",
    ["ma_session=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"].join("; ")
  );
  res.headers.set("Cache-Control", "no-store");

  return res;
}