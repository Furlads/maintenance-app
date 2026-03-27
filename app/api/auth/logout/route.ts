export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();

  const res = NextResponse.json({ ok: true });
  res.headers.set("Cache-Control", "no-store");

  return res;
}