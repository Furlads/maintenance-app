import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const rpID = process.env.WEBAUTHN_RP_ID!;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body?.phone || "").trim();

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Phone is required" },
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
        { ok: false, error: "No Face ID set up for this user" },
        { status: 404 }
      );
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: worker.webauthnCredentials.map((cred) => ({
        id: Buffer.from(cred.id, "base64url"),
        type: "public-key",
      })),
      userVerification: "preferred",
    });

    return NextResponse.json({
      ok: true,
      options,
    });
  } catch (error) {
    console.error("WEBAUTHN_LOGIN_START_ERROR", error);
    return NextResponse.json(
      { ok: false, error: "Could not start Face ID login" },
      { status: 500 }
    );
  }
}