import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function getRedirectPath(accessLevel: string | null | undefined) {
  return String(accessLevel || "").toLowerCase() === "admin" ? "/admin" : "/today";
}

function normalisePhone(value: string) {
  return String(value || "").replace(/\s+/g, "").trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawPhone = String(body?.phone || "");
    const password = String(body?.password || "");
    const phone = normalisePhone(rawPhone);

    console.log("LOGIN_ATTEMPT", {
      rawPhone,
      normalisedPhone: phone,
      passwordLength: password.length,
    });

    if (!phone || !password) {
      console.log("LOGIN_FAIL_MISSING_FIELDS");
      return NextResponse.json(
        { ok: false, error: "Phone and password are required." },
        { status: 400 }
      );
    }

    const worker = await prisma.worker.findFirst({
      where: {
        active: true,
        phone: {
          equals: phone,
        },
      },
    });

    console.log("LOGIN_WORKER_LOOKUP", {
      found: !!worker,
      workerId: worker?.id ?? null,
      workerPhone: worker?.phone ?? null,
      hasPasswordHash: !!worker?.passwordHash,
      mustChangePassword: !!worker?.mustChangePassword,
      accessLevel: worker?.accessLevel ?? null,
    });

    if (!worker) {
      console.log("LOGIN_FAIL_NO_WORKER");
      return NextResponse.json(
        { ok: false, error: "Invalid login details." },
        { status: 401 }
      );
    }

    if (!worker.passwordHash) {
      console.log("LOGIN_FAIL_NO_PASSWORD_HASH", {
        workerId: worker.id,
      });
      return NextResponse.json(
        { ok: false, error: "Invalid login details." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, worker.passwordHash);

    console.log("LOGIN_PASSWORD_CHECK", {
      workerId: worker.id,
      valid,
    });

    if (!valid) {
      console.log("LOGIN_FAIL_BAD_PASSWORD", {
        workerId: worker.id,
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
    const redirectTo = worker.mustChangePassword
      ? "/change-password"
      : getRedirectPath(accessLevel);

    console.log("LOGIN_SUCCESS", {
      workerId: worker.id,
      redirectTo,
      mustChangePassword: worker.mustChangePassword,
    });

    const res = NextResponse.json({
      ok: true,
      worker: {
        id: worker.id,
        name: `${worker.firstName} ${worker.lastName}`.trim(),
        accessLevel,
      },
      redirectTo,
      mustChangePassword: worker.mustChangePassword,
    });

    res.cookies.set(
      "furlads_session",
      JSON.stringify({
        workerId: worker.id,
        workerName: `${worker.firstName} ${worker.lastName}`.trim(),
        workerAccessLevel: accessLevel,
      }),
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    return res;
  } catch (error) {
    console.error("LOGIN_ROUTE_ERROR", error);
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}