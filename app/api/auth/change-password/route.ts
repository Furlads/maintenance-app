import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function getRedirectPath(accessLevel: string | null | undefined) {
  return String(accessLevel || "").toLowerCase() === "admin" ? "/admin" : "/today";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const currentPassword = String(body?.currentPassword || "");
    const newPassword = String(body?.newPassword || "");

    const cookie = req.headers.get("cookie") || "";
    const sessionMatch = cookie.match(/furlads_session=([^;]+)/);

    if (!sessionMatch) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const session = JSON.parse(decodeURIComponent(sessionMatch[1]));
    const workerId = session.workerId;

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
    });

    if (!worker || !worker.passwordHash) {
      return NextResponse.json(
        { ok: false, error: "User not found" },
        { status: 404 }
      );
    }

    const valid = await bcrypt.compare(currentPassword, worker.passwordHash);

    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Current password incorrect" },
        { status: 401 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const accessLevel = worker.accessLevel || "worker";
    const redirectTo = getRedirectPath(accessLevel);

    await prisma.worker.update({
      where: { id: worker.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    return NextResponse.json({
      ok: true,
      redirectTo,
    });
  } catch (error) {
    console.error("CHANGE_PASSWORD_ERROR", error);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}