import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createSessionForWorker } from "@/lib/auth";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function normalise(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function normalisePhone(value: string) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function isTrevLogin(worker: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  const firstName = normalise(worker.firstName);
  const lastName = normalise(worker.lastName);
  const email = normalise(worker.email);

  if (firstName === "trevor" && lastName === "fudger") return true;
  if (firstName === "trev" && lastName === "fudger") return true;
  if (email.includes("trevor.fudger")) return true;

  return false;
}

function getRedirectPath(worker: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  accessLevel?: string | null | undefined;
}) {
  if (isTrevLogin(worker)) {
    return "/trev";
  }

  const accessLevel = normalise(worker.accessLevel);

  if (
    accessLevel === "admin" ||
    accessLevel === "office" ||
    accessLevel === "manager" ||
    accessLevel === "owner"
  ) {
    return "/admin";
  }

  return "/today";
}

function isLocked(worker: {
  lockedUntil?: Date | null;
}) {
  return !!worker.lockedUntil && worker.lockedUntil.getTime() > Date.now();
}

function getRemainingLockMinutes(worker: {
  lockedUntil?: Date | null;
}) {
  if (!worker.lockedUntil) return 0;
  const diffMs = worker.lockedUntil.getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 60000);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const rawPhone = String(body?.phone || "");
    const password = String(body?.password || "");
    const phone = normalisePhone(rawPhone);

    if (!phone || !password) {
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        accessLevel: true,
        passwordHash: true,
        mustChangePassword: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!worker) {
      return NextResponse.json(
        { ok: false, error: "Invalid login details." },
        { status: 401 }
      );
    }

    if (isLocked(worker)) {
      const minutesRemaining = getRemainingLockMinutes(worker);

      return NextResponse.json(
        {
          ok: false,
          error:
            minutesRemaining > 0
              ? `Account locked. Try again in about ${minutesRemaining} minute${minutesRemaining === 1 ? "" : "s"}.`
              : "Account locked. Try again shortly.",
        },
        { status: 423 }
      );
    }

    if (!worker.passwordHash) {
      return NextResponse.json(
        { ok: false, error: "Invalid login details." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, worker.passwordHash);

    if (!valid) {
      const nextFailedAttempts = (worker.failedLoginAttempts || 0) + 1;
      const shouldLock = nextFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

      await prisma.worker.update({
        where: { id: worker.id },
        data: {
          failedLoginAttempts: nextFailedAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          error: shouldLock
            ? `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
            : "Invalid login details.",
        },
        { status: 401 }
      );
    }

    const updatedWorker = await prisma.worker.update({
      where: { id: worker.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        accessLevel: true,
        mustChangePassword: true,
      },
    });

    const accessLevel = updatedWorker.accessLevel || "worker";
    const redirectTo = updatedWorker.mustChangePassword
      ? "/change-password"
      : getRedirectPath(updatedWorker);

    await createSessionForWorker({
      ...updatedWorker,
    });

    return NextResponse.json({
      ok: true,
      worker: {
        id: updatedWorker.id,
        name: `${updatedWorker.firstName} ${updatedWorker.lastName}`.trim(),
        accessLevel,
      },
      redirectTo,
      mustChangePassword: updatedWorker.mustChangePassword,
    });
  } catch (error) {
    console.error("LOGIN_ROUTE_ERROR", error);

    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}