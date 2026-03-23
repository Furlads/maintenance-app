import { NextResponse } from "next/server"
import twilio from "twilio"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function buildSms(job: any) {
  const address = [job.address, job.postcode].filter(Boolean).join(", ")

  return [
    "⏰ Furlads Reminder",
    "",
    "You have an appointment in 60 minutes.",
    "",
    `Customer: ${job.customer?.name || "Unknown"}`,
    `Job: ${job.title || "No title"}`,
    `Address: ${address || "Not provided"}`,
    `Notes: ${job.notes || "None"}`,
    `Estimated travel: ${job.estimatedTravelTime || "Not set"}`,
  ].join("\n")
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id

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