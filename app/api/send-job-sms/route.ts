import { NextResponse } from "next/server"
import twilio from "twilio"

type ReminderPayload = {
  customerName?: string
  jobTitle?: string
  address?: string
  postcode?: string
  notes?: string
  estimatedTravelTime?: string
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function buildSms(payload: ReminderPayload) {
  const customerName = clean(payload.customerName) || "Customer"
  const jobTitle = clean(payload.jobTitle) || "Appointment"
  const address = clean(payload.address)
  const postcode = clean(payload.postcode)
  const notes = clean(payload.notes)
  const estimatedTravelTime =
    clean(payload.estimatedTravelTime) || "Not provided"

  const addressLine = [address, postcode].filter(Boolean).join(", ")

  return [
    "Furlads reminder: you have an appointment in 60 minutes.",
    "",
    `Customer: ${customerName}`,
    `Job: ${jobTitle}`,
    `Address: ${addressLine || "Not provided"}`,
    `Notes: ${notes || "None"}`,
    `Estimated travel time: ${estimatedTravelTime}`,
  ].join("\n")
}

export async function POST(req: Request) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_FROM_NUMBER
    const to = process.env.TREV_ALERT_PHONE

    if (!accountSid || !authToken || !from || !to) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing Twilio env vars",
        },
        { status: 500 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as ReminderPayload

    const client = twilio(accountSid, authToken)

    const message = await client.messages.create({
      body: buildSms(body),
      from,
      to,
    })

    return NextResponse.json({
      ok: true,
      sid: message.sid,
      status: message.status,
    })
  } catch (err: any) {
    console.error("APPOINTMENT SMS ERROR:", err)

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const payload: ReminderPayload = {
      customerName: searchParams.get("customerName") || "",
      jobTitle: searchParams.get("jobTitle") || "",
      address: searchParams.get("address") || "",
      postcode: searchParams.get("postcode") || "",
      notes: searchParams.get("notes") || "",
      estimatedTravelTime: searchParams.get("estimatedTravelTime") || "",
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_FROM_NUMBER
    const to = process.env.TREV_ALERT_PHONE

    if (!accountSid || !authToken || !from || !to) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing Twilio env vars",
        },
        { status: 500 }
      )
    }

    const client = twilio(accountSid, authToken)

    const message = await client.messages.create({
      body: buildSms(payload),
      from,
      to,
    })

    return NextResponse.json({
      ok: true,
      sid: message.sid,
      status: message.status,
    })
  } catch (err: any) {
    console.error("APPOINTMENT SMS ERROR:", err)

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}