import prisma from "@/lib/prisma"
import twilio from "twilio"

export const runtime = "nodejs"

function buildSms(job: any) {
  const address = [job.address, job.customer?.postcode]
    .filter(Boolean)
    .join(", ")

  return [
    "⏰ Furlads Reminder",
    "",
    "You have an appointment in 60 minutes.",
    "",
    `Customer: ${job.customer?.name || "Unknown"}`,
    `Job: ${job.title || "No title"}`,
    `Address: ${address || "Not provided"}`,
    `Notes: ${job.notes || "None"}`,
  ].join("\n")
}

export async function GET() {
  try {
    const now = new Date()
    const in60 = new Date(now.getTime() + 60 * 60 * 1000)
    const in65 = new Date(now.getTime() + 65 * 60 * 1000)

    // Find jobs starting in the next 60–65 minutes window
    const jobs = await prisma.job.findMany({
      where: {
        startTime: {
          gte: in60,
          lte: in65,
        },
      },
      include: {
        customer: true,
      },
    })

    if (!jobs.length) {
      return Response.json({ ok: true, message: "No jobs to notify" })
    }

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    const results = []

    for (const job of jobs) {
      const message = await client.messages.create({
        body: buildSms(job),
        from: process.env.TWILIO_FROM_NUMBER!,
        to: process.env.TREV_ALERT_PHONE!,
      })

      results.push({
        jobId: job.id,
        sid: message.sid,
      })
    }

    return Response.json({
      ok: true,
      sent: results.length,
      results,
    })
  } catch (err: any) {
    console.error("REMINDER ERROR:", err)

    return Response.json({
      ok: false,
      error: err.message,
    })
  }
}