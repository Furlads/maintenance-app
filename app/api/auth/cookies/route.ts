// app/api/auth/cookies/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const ma = req.cookies.get("ma_session")?.value || "";

  return NextResponse.json(
    {
      ok: true,
      debug: {
        cookieHeaderPresent: Boolean(cookieHeader),
        cookieHeaderPreview: cookieHeader.slice(0, 200),
        hasMaSessionCookie: Boolean(ma),
        maSessionLength: ma.length,
        host: req.headers.get("host") || "",
        origin: req.headers.get("origin") || "",
        referer: req.headers.get("referer") || "",
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}