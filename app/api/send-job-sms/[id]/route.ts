import { NextResponse } from "next/server"
import twilio from "twilio"
import prisma from "@/lib/prisma"

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function buildSms(job: {
  title: string
  address: string
  notes: string | null
  customer: {
    name: string
    postcode: string | null
  } | null
}) {
  const customerName = clean(job.customer?.name) || "Unknown"
  const postcode = clean(job.customer?.postcode)
  const addressLine = [clean(job.address), postcode].filter(Boolean).join(", ")
  const notes = clean(job.notes)

  return [
    "Furlads reminder: you have an appointment in 60 minutes.",
    "",
    `Customer: ${customerName}`,
    `Job: ${clean(job.title) || "No title"}`,
    `Address: ${addressLine || "Not provided"}`,
    `Notes: ${notes || "None"}`,
    "Estimated travel time: Not set",
  ].join("\n")
}

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = Number(params.id)

    if (!Number.isInteger(jobId) || jobId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid job id" },
        { status: 400 }
      )
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
      },
    })

    if (!job) {
      return NextResponse.json(
        { ok: false, error: "Job not found" },
        { status: 404 }
      )
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_FROM_NUMBER
    const to = process.env.TREV_ALERT_PHONE

    if (!accountSid || !authToken || !from || !to) {
      return NextResponse.json(
        { ok: false, error: "Missing Twilio env vars" },
        { status: 500 }
      )
    }

    const client = twilio(accountSid, authToken)

    const message = await client.messages.create({
      body: buildSms(job),
      from,
      to,
    })

    return NextResponse.json({
      ok: true,
      sid: message.sid,
      status: message.status,
    })
  } catch (err: any) {
    console.error("JOB SMS ERROR:", err)

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}