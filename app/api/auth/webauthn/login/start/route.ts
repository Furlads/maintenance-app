import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const rpID = process.env.WEBAUTHN_RP_ID;
const AUTH_CHALLENGE_COOKIE = "furlads_webauthn_auth_challenge";

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
    if (!rpID) {
      return NextResponse.json(
        { ok: false, error: "WebAuthn is not configured correctly." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const phone = normalisePhone(String(body?.phone || ""));

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Phone is required." },
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

    if (!worker || worker.webauthnCredentials.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No Face ID set up for this user." },
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

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: worker.webauthnCredentials.map((cred) => ({
        id: cred.id,
        type: "public-key",
        transports: cred.transports
          ? (cred.transports.split(",").filter(Boolean) as AuthenticatorTransport[])
          : undefined,
      })),
      userVerification: "preferred",
    });

    const cookieStore = await cookies();
    cookieStore.set(AUTH_CHALLENGE_COOKIE, options.challenge, {
      httpOnly: true,
      secure: getSecureCookieFlag(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return NextResponse.json({
      ok: true,
      options,
    });
  } catch (error) {
    console.error("WEBAUTHN_LOGIN_START_ERROR", error);

    return NextResponse.json(
      { ok: false, error: "Could not start Face ID login." },
      { status: 500 }
    );
  }
}