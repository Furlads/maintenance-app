export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession, workerKeyFromName } from "@/lib/auth";

function normalise(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isAdminLikeRole(role: string | null | undefined) {
  const value = normalise(role);

  return (
    value === "admin" ||
    value === "office" ||
    value === "manager" ||
    value === "owner"
  );
}

export async function GET(_req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
        name: null,
        role: null,
        workerKey: null,
        access: null,
        isAdmin: false,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const role = session.role || "worker";
  const name = session.workerName || "";
  const isAdmin = isAdminLikeRole(role);

  return NextResponse.json(
    {
      authenticated: true,
      name,
      role,
      workerKey: workerKeyFromName(name),
      access: isAdmin ? "ADMIN" : "WORKER",
      isAdmin,
      workerId: session.workerId || null,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}