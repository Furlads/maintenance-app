import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

const TREV_QUOTE_DEFAULT_SLOTS = ["11:00", "12:00", "13:00"]

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isValidISODateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isValidHHMM(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
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

function isTrue(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1"
}

async function findTrevWorkers() {
  return prisma.worker.findMany({
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
      firstName: true,
      lastName: true,
    },
  })
}

async function resolveTrevQuoteVisitSchedule(params: {
  visitDate: Date
  startTime: string | null
  allowQuoteTimeOverride: boolean
  trevWorkerIds: number[]
}) {
  const { visitDate, startTime, allowQuoteTimeOverride, trevWorkerIds } = params

  if (allowQuoteTimeOverride && !startTime) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          error:
            "Override was enabled but no manual startTime was provided for this Trev quote visit.",
        },
        { status: 400 }
      ),
    }
  }

  const dayStart = startOfLondonDayUtc(visitDate)
  const dayEnd = nextLondonDayUtc(visitDate)

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

  if (existingTrevQuoteJobs.length >= 3) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          error: "Trev already has 3 quote visits booked for that day.",
        },
        { status: 400 }
      ),
    }
  }

  const takenTimes = new Set(
    existingTrevQuoteJobs
      .map((job) => cleanString(job.startTime))
      .filter(Boolean)
  )

  let resolvedStartTime = startTime

  if (!resolvedStartTime) {
    const nextFreeDefaultSlot = TREV_QUOTE_DEFAULT_SLOTS.find(
      (slot) => !takenTimes.has(slot)
    )

    if (!nextFreeDefaultSlot) {
      return {
        error: NextResponse.json(
          {
            ok: false,
            error:
              "No Trev quote slots are left for that day. Available default slots are 11:00, 12:00 and 13:00 only.",
          },
          { status: 400 }
        ),
      }
    }

    resolvedStartTime = nextFreeDefaultSlot
  }

  if (
    !allowQuoteTimeOverride &&
    !TREV_QUOTE_DEFAULT_SLOTS.includes(resolvedStartTime)
  ) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          error:
            "Trev quote visits can only be booked at 11:00, 12:00 or 13:00 unless override is enabled.",
        },
        { status: 400 }
      ),
    }
  }

  if (takenTimes.has(resolvedStartTime)) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          error: "Trev already has a quote visit booked at that time.",
        },
        { status: 400 }
      ),
    }
  }

  return {
    startTime: resolvedStartTime,
  }
}

export async function POST(
  req: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const conversationId = cleanString(params.conversationId)
    const body = await req.json().catch(() => ({}))

    const visitDateRaw = cleanString(body.visitDate)
    const requestedStartTimeRaw = cleanString(body.startTime)
    const notes = cleanString(body.notes)
    const allowQuoteTimeOverride = isTrue(body.allowQuoteTimeOverride)

    if (!conversationId) {
      return NextResponse.json(
        { ok: false, error: "Missing conversation id." },
        { status: 400 }
      )
    }

    if (!isValidISODateOnly(visitDateRaw)) {
      return NextResponse.json(
        { ok: false, error: "visitDate must be YYYY-MM-DD." },
        { status: 400 }
      )
    }

    if (requestedStartTimeRaw && !isValidHHMM(requestedStartTimeRaw)) {
      return NextResponse.json(
        { ok: false, error: "startTime must be HH:MM." },
        { status: 400 }
      )
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { ok: false, error: "Conversation not found." },
        { status: 404 }
      )
    }

    const trevWorkers = await findTrevWorkers()

    if (trevWorkers.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Could not find Trev in the worker database." },
        { status: 400 }
      )
    }

    const trevWorkerIds = trevWorkers.map((worker) => worker.id)
    const visitDate = new Date(`${visitDateRaw}T00:00:00.000Z`)

    const resolvedQuoteSchedule = await resolveTrevQuoteVisitSchedule({
      visitDate,
      startTime: requestedStartTimeRaw || null,
      allowQuoteTimeOverride,
      trevWorkerIds,
    })

    if ("error" in resolvedQuoteSchedule) {
      return resolvedQuoteSchedule.error
    }

    const resolvedStartTime = resolvedQuoteSchedule.startTime

    const latestMessage = conversation.messages[0]
    const conversationContactRef = cleanString(conversation.contactRef)
    const conversationRefIsEmail = conversationContactRef.includes("@")

    const derivedEmail =
      cleanString(latestMessage?.senderEmail) ||
      (conversationRefIsEmail ? conversationContactRef : "")

    const derivedPhone =
      cleanString(latestMessage?.senderPhone) ||
      (!conversationRefIsEmail ? conversationContactRef : "")

    const derivedName =
      cleanString(conversation.contactName) ||
      cleanString(latestMessage?.senderName) ||
      "Inbox lead"

    let customer = await prisma.customer.findFirst({
      where: derivedEmail
        ? { email: derivedEmail }
        : derivedPhone
          ? { phone: derivedPhone }
          : { name: derivedName },
    })

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: derivedName,
          email: derivedEmail || null,
          phone: derivedPhone || null,
          address: null,
          postcode: null,
          notes: `Created from inbox conversation ${conversation.id}.`,
        },
      })
    }

    const bodyNotes =
      conversation.messages
        .slice(0, 3)
        .reverse()
        .map((message) => {
          const sender =
            cleanString(message.senderName) ||
            (message.senderEmail ? cleanString(message.senderEmail) : "") ||
            "Contact"
          const text =
            cleanString(message.body) ||
            cleanString(message.preview) ||
            "No message content."
          return `${sender}: ${text}`
        })
        .join("\n\n") || "No inbox notes available."

    const finalNotes = [
      notes ? `Kelly notes: ${notes}` : "",
      `Created from inbox thread.`,
      bodyNotes,
    ]
      .filter(Boolean)
      .join("\n\n")

    const job = await prisma.job.create({
      data: {
        title: `Quote Visit - ${derivedName}`,
        customerId: customer.id,
        address: customer.address || customer.postcode || "Address to be confirmed",
        notes: finalNotes,
        jobType: "Quote",
        visitDate,
        startTime: resolvedStartTime,
        durationMinutes: 60,
        status: "todo",
        assignments: {
          create: [
            {
              worker: {
                connect: { id: trevWorkerIds[0] },
              },
            },
          ],
        },
      },
      include: {
        customer: true,
        assignments: {
          include: {
            worker: true,
          },
        },
      },
    })

    return NextResponse.json({
      ok: true,
      job,
    })
  } catch (error) {
    console.error("POST quote visit from inbox failed:", error)

    return NextResponse.json(
      { ok: false, error: "Failed to create quote visit from inbox." },
      { status: 500 }
    )
  }
}