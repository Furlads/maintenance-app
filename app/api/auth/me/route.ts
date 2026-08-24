export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession, workerKeyFromName } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        workerId: null,
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

  let workerId = Number(session.workerId);

  if (!Number.isInteger(workerId) || workerId <= 0) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");

    if (firstName) {
      const worker = await prisma.worker.findFirst({
        where: {
          active: true,
          firstName: { equals: firstName, mode: "insensitive" },
          ...(lastName
            ? { lastName: { equals: lastName, mode: "insensitive" } }
            : {}),
        },
        select: { id: true },
      });

      workerId = worker?.id || 0;
    }
  }

  return NextResponse.json(
    {
      authenticated: true,
      name,
      role,
      workerKey: workerKeyFromName(name),
      access: isAdmin ? "ADMIN" : "WORKER",
      isAdmin,
      workerId: workerId > 0 ? workerId : null,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
