// app/api/auth/me/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

function isAdminName(name: string) {
  const n = (name || "").trim();
  return n === "Trevor Fudger" || n === "Kelly Darby";
}

export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" as const };

  const raw = req.cookies.get("ma_session")?.value;
  const session = readSession(req);

  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
        debug: {
          hasCookie: Boolean(raw),
          cookieLength: raw ? raw.length : 0,
          cookieHasDot: raw ? raw.includes(".") : false,
          cookiePrefix: raw ? raw.slice(0, 16) : "",
          secretPresent: Boolean(process.env.SESSION_SECRET || process.env.AUTH_SECRET),
        },
      },
      { status: 200, headers }
    );
  }

  const name = session.workerName || "";
  const role = session.role || "worker";

  // Admin is Trevor/Kelly (and optionally anyone with role === "admin" if you add it later)
  const isAdmin = isAdminName(name) || String(role).toLowerCase() === "admin";

  return NextResponse.json(
    {
      authenticated: true,
      name,
      role,
      isAdmin,
    },
    { status: 200, headers }
  );
}