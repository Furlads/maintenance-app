import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
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

async function verifyLegacyScryptPassword(password: string, stored: string) {
  try {
    const parts = String(stored || "").split("$");
    if (parts.length !== 6) return false;

    const [algo, nStr, rStr, pStr, saltB64, hashB64] = parts;
    if (algo !== "scrypt") return false;

    const N = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);

    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
      return false;
    }

    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");

    if (!salt.length || !expected.length) {
      return false;
    }

    const derived = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(
        password,
        salt,
        expected.length,
        { N, r, p },
        (err, key) => {
          if (err) reject(err);
          else resolve(key as Buffer);
        }
      );
    });

    if (derived.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

async function verifyAnyPassword(password: string, stored: string) {
  const hash = String(stored || "");

  if (!hash) return false;

  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    return bcrypt.compare(password, hash);
  }

  if (hash.startsWith("scrypt$")) {
    return verifyLegacyScryptPassword(password, hash);
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
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

    const valid = await verifyAnyPassword(password, worker.passwordHash);

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