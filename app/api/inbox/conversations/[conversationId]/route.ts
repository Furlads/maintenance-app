import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isValidISODateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function startOfLondonDayUtc(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) {
    throw new Error("Failed to build London date parts")
  }

  return new Date(`${year}-${month}-${day}T00:00:00.000Z`)
}

function nextLondonDayUtc(date: Date) {
  const start = startOfLondonDayUtc(date)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

async function findTrevWorkerIds() {
  const workers = await prisma.worker.findMany({
    where: {
      OR: [
        {
          AND: [
            { firstName: { equals: "Trevor", mode: "insensitive" } },
            { lastName: { contains: "Fudger", mode: "insensitive" } },
          ],
        },
        {
          AND: [
            { firstName: { equals: "Trev", mode: "insensitive" } },
            { lastName: { contains: "Fudger", mode: "insensitive" } },
          ],
        },
        {
          email: { contains: "trevor.fudger", mode: "insensitive" },
        },
      ],
    },
    select: {
      id: true,
    },
  })

  return workers.map((worker) => worker.id)
}

export async function GET(req: NextRequest) {
  try {
    const dateRaw = cleanString(req.nextUrl.searchParams.get("date"))

    if (!isValidISODateOnly(dateRaw)) {
      return NextResponse.json(
        { ok: false, error: "date must be YYYY-MM-DD" },
        { status: 400 }
      )
    }

    const visitDate = new Date(`${dateRaw}T00:00:00.000Z`)
    const dayStart = startOfLondonDayUtc(visitDate)
    const dayEnd = nextLondonDayUtc(visitDate)

    const trevWorkerIds = await findTrevWorkerIds()

    if (trevWorkerIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Could not find Trev in the worker database." },
        { status: 400 }
      )
    }

    const existingTrevQuoteJobs = await prisma.job.findMany({
      where: {
        jobType: {
          equals: "Quote",
          mode: "insensitive",
        },
        visitDate: {
          gte: dayStart,
          lt: dayEnd,
        },
        assignments: {
          some: {
            workerId: {
              in: trevWorkerIds,
            },
          },
        },
      },
      select: {
        id: true,
        startTime: true,
      },
    })

    const quoteCount = existingTrevQuoteJobs.length
    const maxReached = quoteCount >= 3
    const times = ["11:00", "12:00", "13:00"]

    const slots = times.map((time) => {
      const exactTaken = existingTrevQuoteJobs.some(
        (job) => cleanString(job.startTime) === time
      )

      if (maxReached) {
        return {
          time,
          available: false,
          reason: "Day full",
        }
      }

      if (exactTaken) {
        return {
          time,
          available: false,
          reason: "Booked",
        }
      }

      return {
        time,
        available: true,
      }
    })

    return NextResponse.json({
      ok: true,
      quoteCount,
      maxReached,
      slots,
    })
  } catch (error) {
    console.error("GET quote visit availability failed:", error)

    return NextResponse.json(
      { ok: false, error: "Failed to load quote visit availability." },
      { status: 500 }
    )
  }
}