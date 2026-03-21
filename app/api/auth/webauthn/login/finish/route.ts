import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const rpID = process.env.WEBAUTHN_RP_ID!;
const origin = process.env.WEBAUTHN_ORIGIN!;

function getRedirectPath(accessLevel: string | null | undefined) {
  return String(accessLevel || "").toLowerCase() === "admin"
    ? "/admin"
    : "/today";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const credentialID = body?.id;

    if (!credentialID) {
      return NextResponse.json(
        { ok: false, error: "Missing credential ID" },
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
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(credential.id, "base64url"),
        credentialPublicKey: Buffer.from(credential.publicKey, "base64"),
        counter: credential.counter,
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

    const accessLevel = credential.worker.accessLevel || "worker";
    const redirectTo = getRedirectPath(accessLevel);

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