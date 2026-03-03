// middleware.ts
import { NextRequest, NextResponse } from "next/server";

// Auth is temporarily disabled while we build the app.
// Later we can re-enable session gating here.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// Match everything (same as before, but with no redirects)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};