import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const rpName = "Furlads";
const rpID = process.env.WEBAUTHN_RP_ID;
const origin = process.env.WEBAUTHN_ORIGIN;
const REG_CHALLENGE_COOKIE = "furlads_webauthn_reg_challenge";

function normalisePhone(value: string) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function isLocked(worker: { lockedUntil?: Date | null }) {
  return !!worker.lockedUntil && worker.lockedUntil.getTime() > Date.now();
}

function getRemainingLockMinutes(worker: { lockedUntil?: Date | null }) {
  if (!worker.lockedUntil) return 0;
  const diffMs = worker.lockedUntil.getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 60000);
}

function getSecureCookieFlag() {
  return process.env.NODE_ENV === "production";
}

export async function POST(req: Request) {
  try {
    if (!rpID || !origin) {
      return NextResponse.json(
        {
          ok: false,
          error: "WebAuthn environment variables are missing.",
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const phone = normalisePhone(String(body?.phone || ""));

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Phone number is required." },
        { status: 400 }
      );
    }

    const worker = await prisma.worker.findFirst({
      where: {
        phone,
        active: true,
      },
      include: {
        webauthnCredentials: true,
      },
    });

    if (!worker) {
      return NextResponse.json(
        { ok: false, error: "Worker not found." },
        { status: 404 }
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

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(String(worker.id)),
      userName: worker.phone || `${worker.firstName} ${worker.lastName}`.trim(),
      userDisplayName: `${worker.firstName || ""} ${worker.lastName || ""}`.trim(),
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      supportedAlgorithmIDs: [-7, -257],
      excludeCredentials: worker.webauthnCredentials.map((cred) => ({
        id: cred.id,
        type: "public-key",
        transports: cred.transports
          ? (cred.transports.split(",").filter(Boolean) as AuthenticatorTransport[])
          : undefined,
      })),
    });

    const cookieStore = await cookies();
    cookieStore.set(REG_CHALLENGE_COOKIE, options.challenge, {
      httpOnly: true,
      secure: getSecureCookieFlag(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return NextResponse.json({ ok: true, options });
  } catch (error: unknown) {
    console.error("WEBAUTHN_REGISTER_START_ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not start Face ID setup.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    if (!rpID || !origin) {
      return NextResponse.json(
        {
          ok: false,
          error: "WebAuthn environment variables are missing.",
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const phone = normalisePhone(String(body?.phone || ""));
    const credential = body?.credential;

    const cookieStore = await cookies();
    const challenge = cookieStore.get(REG_CHALLENGE_COOKIE)?.value;

    if (!phone || !credential) {
      return NextResponse.json(
        { ok: false, error: "Phone and credential are required." },
        { status: 400 }
      );
    }

    if (!challenge) {
      return NextResponse.json(
        { ok: false, error: "Registration session expired. Try again." },
        { status: 400 }
      );
    }

    const worker = await prisma.worker.findFirst({
      where: {
        phone,
        active: true,
      },
      select: {
        id: true,
        lockedUntil: true,
      },
    });

    if (!worker) {
      return NextResponse.json(
        { ok: false, error: "Worker not found." },
        { status: 404 }
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

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { ok: false, error: "Face ID setup could not be verified." },
        { status: 400 }
      );
    }

    const {
      credential: newCredential,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;

    const existingCredential = await prisma.webAuthnCredential.findUnique({
      where: {
        id: newCredential.id,
      },
      select: {
        id: true,
        workerId: true,
      },
    });

    if (existingCredential && existingCredential.workerId !== worker.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "This passkey is already registered to another worker.",
        },
        { status: 409 }
      );
    }

    await prisma.webAuthnCredential.upsert({
      where: {
        id: newCredential.id,
      },
      update: {
        publicKey: Buffer.from(newCredential.publicKey).toString("base64"),
        counter: newCredential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: Array.isArray(newCredential.transports)
          ? newCredential.transports.join(",")
          : null,
      },
      create: {
        id: newCredential.id,
        workerId: worker.id,
        publicKey: Buffer.from(newCredential.publicKey).toString("base64"),
        counter: newCredential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: Array.isArray(newCredential.transports)
          ? newCredential.transports.join(",")
          : null,
      },
    });

    cookieStore.set(REG_CHALLENGE_COOKIE, "", {
      httpOnly: true,
      secure: getSecureCookieFlag(),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("WEBAUTHN_REGISTER_FINISH_ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save Face ID setup.",
      },
      { status: 500 }
    );
  }
}