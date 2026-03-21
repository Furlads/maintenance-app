import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const rpID = process.env.WEBAUTHN_RP_ID!;
const origin = process.env.WEBAUTHN_ORIGIN!;

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cookieStore = await cookies();
    const challenge = cookieStore.get("furlads_webauthn_auth_challenge")?.value;
    const credentialID = String(body?.id || "").trim();

    if (!credentialID) {
      return NextResponse.json(
        { ok: false, error: "Missing credential ID" },
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
        { ok: false, error: "Credential not found" },
        { status: 404 }
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
          ? (credential.transports.split(",").filter(Boolean) as AuthenticatorTransport[])
          : undefined,
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        { ok: false, error: "Face ID verification failed" },
        { status: 401 }
      );
    }

    await prisma.webAuthnCredential.update({
      where: { id: credential.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
      },
    });

    cookieStore.set("furlads_webauthn_auth_challenge", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    const accessLevel = credential.worker.accessLevel || "worker";
    const redirectTo = getRedirectPath(credential.worker);

    const res = NextResponse.json({
      ok: true,
      redirectTo,
    });

    res.cookies.set(
      "furlads_session",
      JSON.stringify({
        workerId: credential.worker.id,
        workerName: `${credential.worker.firstName} ${credential.worker.lastName}`.trim(),
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
    console.error("WEBAUTHN_LOGIN_FINISH_ERROR", error);
    return NextResponse.json(
      { ok: false, error: "Face ID login failed" },
      { status: 500 }
    );
  }
}