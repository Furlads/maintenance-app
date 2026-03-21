import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const rpName = "Furlads";
const rpID = process.env.WEBAUTHN_RP_ID!;
const origin = process.env.WEBAUTHN_ORIGIN!;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body?.phone || "").trim();

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

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Uint8Array.from(Buffer.from(String(worker.id), "utf8")),
      userName: worker.phone || `${worker.firstName} ${worker.lastName}`.trim(),
      userDisplayName: `${worker.firstName} ${worker.lastName}`.trim(),
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

    cookies().set("furlads_webauthn_reg_challenge", options.challenge, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return NextResponse.json({ ok: true, options });
  } catch (error) {
    console.error("WEBAUTHN_REGISTER_START_ERROR", error);
    return NextResponse.json(
      { ok: false, error: "Could not start Face ID setup." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body?.phone || "").trim();
    const credential = body?.credential;
    const challenge = cookies().get("furlads_webauthn_reg_challenge")?.value;

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
    });

    if (!worker) {
      return NextResponse.json(
        { ok: false, error: "Worker not found." },
        { status: 404 }
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

    cookies().set("furlads_webauthn_reg_challenge", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("WEBAUTHN_REGISTER_FINISH_ERROR", error);
    return NextResponse.json(
      { ok: false, error: "Could not save Face ID setup." },
      { status: 500 }
    );
  }
}