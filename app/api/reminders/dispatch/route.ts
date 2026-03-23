import prisma from "@/lib/prisma"
import twilio from "twilio"

export const runtime = "nodejs"

const ORIGIN = "TF9 3FT"

async function getTravelTime(address: string) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY

    if (!apiKey || !address) return "Not available"

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      ORIGIN
    )}&destination=${encodeURIComponent(address)}&key=${apiKey}`

    const res = await fetch(url)
    const data = await res.json()

    const duration =
      data?.routes?.[0]?.legs?.[0]?.duration?.text

    return duration || "Not available"
  } catch {
    return "Not available"
  }
}

function buildSms(job: any, travelTime: string) {
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
    `Estimated travel time: ${travelTime}`,
  ].join("\n")
}

function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

export async function GET() {
  try {
    const now = new Date()
    const in60 = new Date(now.getTime() + 60 * 60 * 1000)
    const in65 = new Date(now.getTime() + 65 * 60 * 1000)

    const startOfDay = new Date(in60)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(in60)
    endOfDay.setHours(23, 59, 59, 999)

    const startTimeFrom = formatTime(in60)
    const startTimeTo = formatTime(in65)

    const jobs = await prisma.job.findMany({
      where: {
        visitDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        startTime: {
          not: null,
          gte: startTimeFrom,
          lte: startTimeTo,
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
      const address = [job.address, job.customer?.postcode]
        .filter(Boolean)
        .join(", ")

      const travelTime = await getTravelTime(address)

      const message = await client.messages.create({
        body: buildSms(job, travelTime),
        from: process.env.TWILIO_FROM_NUMBER!,
        to: process.env.TREV_ALERT_PHONE!,
      })

      results.push({
        jobId: job.id,
        sid: message.sid,
        travelTime,
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