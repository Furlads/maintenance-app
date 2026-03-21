import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function getRedirectPath(accessLevel: string | null | undefined) {
  return String(accessLevel || "").toLowerCase() === "admin" ? "/admin" : "/today";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body?.phone || "").trim();
    const password = String(body?.password || "");

    if (!phone || !password) {
      return NextResponse.json(
        { ok: false, error: "Phone and password are required." },
        { status: 400 }
      );
    }

    const worker = await prisma.worker.findFirst({
      where: {
        phone,
        active: true,
      },
    });

    if (!worker || !worker.passwordHash) {
      return NextResponse.json(
        { ok: false, error: "Invalid login details." },
        { status: 401 }
      );
    }

    if (worker.lockedUntil && worker.lockedUntil > new Date()) {
      return NextResponse.json(
        { ok: false, error: "This account is temporarily locked." },
        { status: 423 }
      );
    }

    const valid = await bcrypt.compare(password, worker.passwordHash);

    if (!valid) {
      const nextAttempts = (worker.failedLoginAttempts || 0) + 1;
      const shouldLock = nextAttempts >= 5;

      await prisma.worker.update({
        where: { id: worker.id },
        data: {
          failedLoginAttempts: nextAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });

      return NextResponse.json(
        { ok: false, error: "Invalid login details." },
        { status: 401 }
      );
    }

    await prisma.worker.update({
      where: { id: worker.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const accessLevel = worker.accessLevel || "worker";
    const redirectTo = getRedirectPath(accessLevel);

    const res = NextResponse.json({
      ok: true,
      worker: {
        id: worker.id,
        name: `${worker.firstName} ${worker.lastName}`.trim(),
        accessLevel,
      },
      redirectTo,
    });

    res.cookies.set("furlads_session", JSON.stringify({
      workerId: worker.id,
      workerName: `${worker.firstName} ${worker.lastName}`.trim(),
      workerAccessLevel: accessLevel,
    }), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (error) {
    console.error("LOGIN_ROUTE_ERROR", error);
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}