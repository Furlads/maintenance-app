import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionForWorker } from "@/lib/auth";

const rpID = process.env.WEBAUTHN_RP_ID;
const origin = process.env.WEBAUTHN_ORIGIN;

function normalise(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
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

function getWorkerDisplayName(worker: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  return `${worker.firstName || ""} ${worker.lastName || ""}`.trim();
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
    if (!rpID || !origin) {
      return NextResponse.json(
        { ok: false, error: "WebAuthn is not configured correctly." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const cookieStore = await cookies();
    const challenge = cookieStore.get("furlads_webauthn_auth_challenge")?.value;
    const credentialID = String(body?.id || "").trim();

    if (!credentialID) {
      return NextResponse.json(
        { ok: false, error: "Missing credential ID." },
        { status: 400 }
      );
    }

    if (!challenge) {
      return NextResponse.json(
        { ok: false, error: "Login session expired. Try again." },
        { status: 400 }
      );
    }

    const credential = await prisma.webAuthnCredential.findUnique({
      where: {
        id: credentialID,
      },
      include: {
        worker: true,
      },
    });

    if (!credential || !credential.worker) {
      return NextResponse.json(
        { ok: false, error: "Credential not found." },
        { status: 404 }
      );
    }

    if (!credential.worker.active) {
      return NextResponse.json(
        { ok: false, error: "This account is inactive." },
        { status: 403 }
      );
    }

    if (isLocked(credential.worker)) {
      const minutesRemaining = getRemainingLockMinutes(credential.worker);

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

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: Uint8Array.from(Buffer.from(credential.publicKey, "base64")),
        counter: credential.counter,
        transports: credential.transports
          ? (credential.transports
              .split(",")
              .filter(Boolean) as AuthenticatorTransport[])
          : undefined,
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        { ok: false, error: "Face ID verification failed." },
        { status: 401 }
      );
    }

    await prisma.$transaction([
      prisma.webAuthnCredential.update({
        where: { id: credential.id },
        data: {
          counter: verification.authenticationInfo.newCounter,
        },
      }),
      prisma.worker.update({
        where: { id: credential.worker.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      }),
    ]);

    cookieStore.set("furlads_webauthn_auth_challenge", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    const redirectTo = getRedirectPath(credential.worker);

    await createSessionForWorker(credential.worker);

    return NextResponse.json({
      ok: true,
      redirectTo,
      worker: {
        id: credential.worker.id,
        name: getWorkerDisplayName(credential.worker),
        accessLevel: String(credential.worker.accessLevel || "worker"),
      },
      mustChangePassword: Boolean(credential.worker.mustChangePassword),
    });
  } catch (error) {
    console.error("WEBAUTHN_LOGIN_FINISH_ERROR", error);

    return NextResponse.json(
      { ok: false, error: "Face ID login failed." },
      { status: 500 }
    );
  }
}