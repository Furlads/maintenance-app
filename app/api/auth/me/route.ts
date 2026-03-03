// app/api/auth/me/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      authenticated: true,
      name: "DEV",
      role: "DEV",
      workerKey: "dev",
      access: "ADMIN",
      isAdmin: true,
      devAuthDisabled: true,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}