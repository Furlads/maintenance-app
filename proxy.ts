// /proxy.ts
import { NextRequest, NextResponse } from "next/server";

// AUTH TEMP DISABLED (test build phase)
// This file remains only to satisfy Next 16's "proxy" requirement.
export function proxy(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};