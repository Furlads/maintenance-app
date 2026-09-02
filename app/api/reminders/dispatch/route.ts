import prisma from "@/lib/prisma"
import twilio from "twilio"

export const runtime = "nodejs"

const ORIGIN = "TF9 3FT"
const LONDON_TIME_ZONE = "Europe/London"

async function getTravelTime(address: string) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY

    if (!apiKey || !address) return "Not available"

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      ORIGIN
    )}&destination=${encodeURIComponent(address)}&key=${apiKey}`

    const res = await fetch(url)
    const data = await res.json()

    const duration = data?.routes?.[0]?.legs?.[0]?.duration?.text

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

function londonDateAndTime(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })

  const parts = formatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value

  const year = get("year")
  const month = get("month")
  const day = get("day")
  const hour = get("hour")
  const minute = get("minute")

  if (!year || !month || !day || !hour || !minute) {
    throw new Error("Failed to calculate Europe/London reminder time")
  }

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  }
}

export async function GET() {
  try {
    const now = new Date()
    const in60 = new Date(now.getTime() + 60 * 60 * 1000)
    const in65 = new Date(now.getTime() + 65 * 60 * 1000)

    const from = londonDateAndTime(in60)
    const to = londonDateAndTime(in65)

    // Jobs store visitDate as the selected calendar date at UTC midnight, while
    // startTime is a local UK HH:MM string. Always calculate the reminder window
    // in Europe/London so BST/GMT changes cannot shift reminders by an hour.
    const startOfVisitDate = new Date(`${from.date}T00:00:00.000Z`)
    const endOfVisitDate = new Date(`${from.date}T23:59:59.999Z`)

    // A five-minute forward-only window means an invocation that runs late never
    // catches up by sending an appointment reminder after its intended time.
    // If the window crosses midnight, handle the second date separately.
    const dateChanged = from.date !== to.date

    const jobs = await prisma.job.findMany({
      where: dateChanged
        ? {
            OR: [
              {
                visitDate: {
                  gte: startOfVisitDate,
                  lte: endOfVisitDate,
                },
                startTime: {
                  not: null,
                  gte: from.time,
                  lte: "23:59",
                },
              },
              {
                visitDate: {
                  gte: new Date(`${to.date}T00:00:00.000Z`),
                  lte: new Date(`${to.date}T23:59:59.999Z`),
                },
                startTime: {
                  not: null,
                  gte: "00:00",
                  lte: to.time,
                },
              },
            ],
          }
        : {
            visitDate: {
              gte: startOfVisitDate,
              lte: endOfVisitDate,
            },
            startTime: {
              not: null,
              gte: from.time,
              lte: to.time,
            },
          },
      include: {
        customer: true,
      },
    })

    if (!jobs.length) {
      return Response.json({
        ok: true,
        message: "No jobs to notify",
        checkedAt: now.toISOString(),
        londonWindow: { from, to },
      })
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
      checkedAt: now.toISOString(),
      londonWindow: { from, to },
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
