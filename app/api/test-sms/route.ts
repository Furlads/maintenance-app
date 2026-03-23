import { NextResponse } from "next/server";
import twilio from "twilio";

export const runtime = "nodejs";

export async function GET() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    const to = process.env.TREV_ALERT_PHONE;

    if (!accountSid || !authToken || !from || !to) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing environment variables",
        },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    const message = await client.messages.create({
      body: "Furlads SMS test successful",
      from,
      to,
    });

    return NextResponse.json({
      ok: true,
      sid: message.sid,
      status: message.status,
    });
  } catch (err: any) {
    console.error("SMS ERROR:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}