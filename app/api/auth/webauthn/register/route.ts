import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
      userID: String(worker.id),
      userName: worker.phone || `${worker.firstName} ${worker.lastName}`.trim(),
      userDisplayName: `${worker.firstName} ${worker.lastName}`.trim(),
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: worker.webauthnCredentials.map((cred) => ({
        id: cred.id,
        type: "public-key",
        transports: cred.transports
          ? (cred.transports.split(",").filter(Boolean) as AuthenticatorTransport[])
          : undefined,
      })),
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

    if (!phone || !credential) {
      return NextResponse.json(
        { ok: false, error: "Phone and credential are required." },
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
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { ok: false, error: "Face ID setup could not be verified." },
        { status: 400 }
      );
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    await prisma.webAuthnCredential.upsert({
      where: {
        id: Buffer.from(credentialID).toString("base64url"),
      },
      update: {
        publicKey: Buffer.from(credentialPublicKey).toString("base64"),
        counter,
      },
      create: {
        id: Buffer.from(credentialID).toString("base64url"),
        workerId: worker.id,
        publicKey: Buffer.from(credentialPublicKey).toString("base64"),
        counter,
        deviceType: "singleDevice",
        backedUp: false,
        transports: Array.isArray(credential.response?.transports)
          ? credential.response.transports.join(",")
          : null,
      },
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