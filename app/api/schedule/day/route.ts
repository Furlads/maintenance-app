import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type ScheduleJob = {
  id: number
  title: string
  jobType: string
  customerName: string
  postcode: string | null
  address: string
  startTime: string | null
  durationMinutes: number | null
  status: string
}

type ScheduleAvailabilityBlock = {
  id: number
  workerId: number
  title: string
  startTime: string | null
  endTime: string | null
  isFullDay: boolean
  notes: string | null
  source: string
}

type ScheduleWorker = {
  id: number
  name: string
  jobs: ScheduleJob[]
  availabilityBlocks: ScheduleAvailabilityBlock[]
}

type ScheduleDayResponse = {
  date: string
  workers: ScheduleWorker[]
}

function getDayRange(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number)

  const start = new Date(year, month - 1, day, 0, 0, 0, 0)
  const end = new Date(year, month - 1, day, 23, 59, 59, 999)

  return { start, end }
}

function normaliseStartTimeForSort(value: string | null): string {
  if (!value) return "99:99"

  const trimmed = value.trim()
  const parts = trimmed.split(":")

  if (parts.length !== 2) return "99:99"

  const hours = parts[0].padStart(2, "0")
  const minutes = parts[1].padStart(2, "0")

  return `${hours}:${minutes}`
}

export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date")

    if (!dateParam) {
      return NextResponse.json(
        { error: "Missing required query parameter: date" },
        { status: 400 }
      )
    }

    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    if (!isValidDate) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      )
    }

    const { start, end } = getDayRange(dateParam)

    const [activeWorkers, jobsForDay, blocksForDay] = await Promise.all([
      prisma.worker.findMany({
        where: {
          active: true,
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      }),

      prisma.job.findMany({
        where: {
          visitDate: {
            gte: start,
            lte: end,
          },
          assignments: {
            some: {},
          },
          status: {
            notIn: ["cancelled"],
          },
        },
        orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          jobType: true,
          address: true,
          startTime: true,
          durationMinutes: true,
          status: true,
          customer: {
            select: {
              name: true,
              postcode: true,
            },
          },
          assignments: {
            select: {
              workerId: true,
            },
          },
        },
      }),

      prisma.workerAvailabilityBlock.findMany({
        where: {
          active: true,
          startDate: {
            lte: end,
          },
          endDate: {
            gte: start,
          },
        },
        orderBy: [{ workerId: "asc" }, { startDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          workerId: true,
          title: true,
          startTime: true,
          endTime: true,
          isFullDay: true,
          notes: true,
          source: true,
        },
      }),
    ])

    const workersMap = new Map<number, ScheduleWorker>()

    for (const worker of activeWorkers) {
      workersMap.set(worker.id, {
        id: worker.id,
        name: `${worker.firstName ?? ""} ${worker.lastName ?? ""}`.trim(),
        jobs: [],
        availabilityBlocks: [],
      })
    }

    for (const job of jobsForDay) {
      const scheduleJob: ScheduleJob = {
        id: job.id,
        title: job.title || "General",
        jobType: job.jobType || "General",
        customerName: job.customer?.name || "No customer",
        postcode: job.customer?.postcode ?? null,
        address: job.address || "",
        startTime: job.startTime,
        durationMinutes: job.durationMinutes,
        status: job.status || "todo",
      }

      for (const assignment of job.assignments) {
        const workerBucket = workersMap.get(assignment.workerId)

        if (!workerBucket) {
          continue
        }

        workerBucket.jobs.push(scheduleJob)
      }
    }

    for (const block of blocksForDay) {
      const workerBucket = workersMap.get(block.workerId)

      if (!workerBucket) {
        continue
      }

      workerBucket.availabilityBlocks.push({
        id: block.id,
        workerId: block.workerId,
        title: block.title || "Unavailable",
        startTime: block.startTime,
        endTime: block.endTime,
        isFullDay: block.isFullDay,
        notes: block.notes ?? null,
        source: block.source || "time_off_request",
      })
    }

    const workers: ScheduleWorker[] = Array.from(workersMap.values()).map(
      (worker) => ({
        ...worker,
        jobs: [...worker.jobs].sort((a, b) => {
          const timeA = normaliseStartTimeForSort(a.startTime)
          const timeB = normaliseStartTimeForSort(b.startTime)

          if (timeA < timeB) return -1
          if (timeA > timeB) return 1

          return a.id - b.id
        }),
        availabilityBlocks: [...worker.availabilityBlocks].sort((a, b) => {
          const aStart = a.isFullDay ? "00:00" : normaliseStartTimeForSort(a.startTime)
          const bStart = b.isFullDay ? "00:00" : normaliseStartTimeForSort(b.startTime)

          if (aStart < bStart) return -1
          if (aStart > bStart) return 1

          return a.id - b.id
        }),
      })
    )

    const response: ScheduleDayResponse = {
      date: dateParam,
      workers,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("GET /api/schedule/day failed", error)

    return NextResponse.json(
      { error: "Failed to load schedule day data" },
      { status: 500 }
    )
  }
}