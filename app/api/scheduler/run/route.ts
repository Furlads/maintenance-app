import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

const TREV_QUOTE_DEFAULT_SLOTS = ["11:00", "12:00", "13:00"]

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isQuoteJobType(jobType: string | null | undefined) {
  const value = cleanString(jobType).toLowerCase()
  return value === "quote" || value === "quoted"
}

function isTrevWorker(worker: {
  firstName: string | null
  lastName: string | null
  email?: string | null
}) {
  const first = cleanString(worker.firstName).toLowerCase()
  const last = cleanString(worker.lastName).toLowerCase()
  const email = cleanString(worker.email).toLowerCase()

  const firstMatches = first === "trevor" || first === "trev"
  const lastMatches = last.includes("fudger")
  const emailMatches = email.includes("trevor.fudger")

  return (firstMatches && lastMatches) || emailMatches
}

function sameUtcDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

async function assignJobToWorkerIfNeeded(jobId: number, workerId: number) {
  const existingAssignment = await prisma.jobAssignment.findFirst({
    where: {
      jobId,
      workerId,
    },
    select: {
      id: true,
    },
  })

  if (existingAssignment) {
    return
  }

  await prisma.jobAssignment.create({
    data: {
      jobId,
      workerId,
    },
  })
}

async function tryScheduleTrevQuoteJob(params: {
  jobId: number
  duration: number
  worker: {
    id: number
    firstName: string | null
    lastName: string | null
    email?: string | null
  }
  existingAssignedWorkerIds: number[]
  today: Date
}) {
  const { jobId, duration, worker, existingAssignedWorkerIds, today } = params

  if (!isTrevWorker(worker)) {
    return false
  }

  if (duration > 60) {
    return false
  }

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const scheduledDate = new Date(today)
    scheduledDate.setDate(today.getDate() + dayOffset)

    const dayStart = new Date(scheduledDate)
    dayStart.setHours(0, 0, 0, 0)

    const dayEnd = new Date(scheduledDate)
    dayEnd.setHours(23, 59, 59, 999)

    const trevQuoteJobsForDay = await prisma.job.findMany({
      where: {
        id: {
          not: jobId,
        },
        visitDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        jobType: {
          equals: "Quote",
          mode: "insensitive",
        },
        assignments: {
          some: {
            workerId: worker.id,
          },
        },
      },
      select: {
        id: true,
        startTime: true,
      },
    })

    if (trevQuoteJobsForDay.length >= 3) {
      continue
    }

    const takenSlots = new Set(
      trevQuoteJobsForDay
        .map((job) => cleanString(job.startTime))
        .filter(Boolean)
    )

    const nextFreeSlot = TREV_QUOTE_DEFAULT_SLOTS.find(
      (slot) => !takenSlots.has(slot)
    )

    if (!nextFreeSlot) {
      continue
    }

    await prisma.job.update({
      where: { id: jobId },
      data: {
        visitDate: new Date(scheduledDate),
        startTime: nextFreeSlot,
        status: "todo",
      },
    })

    if (!existingAssignedWorkerIds.includes(worker.id)) {
      await assignJobToWorkerIfNeeded(jobId, worker.id)
    }

    return true
  }

  return false
}

export async function POST() {
  try {
    const workers = await prisma.worker.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    })

    const unscheduledJobs = await prisma.job.findMany({
      where: {
        OR: [
          { status: "unscheduled" },
          { visitDate: null },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        assignments: true,
      },
    })

    if (workers.length === 0) {
      return NextResponse.json({ ok: false, error: "No workers found" }, { status: 400 })
    }

    if (unscheduledJobs.length === 0) {
      return NextResponse.json({
        ok: true,
        scheduled: 0,
        message: "No unscheduled jobs found",
      })
    }

    const today = startOfToday()
    const startOfDay = 8 * 60
    const endOfDay = 17 * 60

    let scheduledCount = 0

    for (const job of unscheduledJobs) {
      const duration =
        typeof job.durationMinutes === "number" && job.durationMinutes > 0
          ? job.durationMinutes
          : 120

      const existingAssignedWorkerIds = job.assignments.map(
        (assignment) => assignment.workerId
      )

      let scheduled = false

      for (const worker of workers) {
        if (isQuoteJobType(job.jobType) && isTrevWorker(worker)) {
          const trevQuoteScheduled = await tryScheduleTrevQuoteJob({
            jobId: job.id,
            duration,
            worker,
            existingAssignedWorkerIds,
            today,
          })

          if (trevQuoteScheduled) {
            scheduled = true
            scheduledCount += 1
            break
          }

          continue
        }

        const existingJobs = await prisma.job.findMany({
          where: {
            assignments: {
              some: {
                workerId: worker.id,
              },
            },
            visitDate: {
              gte: today,
            },
            NOT: {
              id: job.id,
            },
          },
          orderBy: [
            { visitDate: "asc" },
            { startTime: "asc" },
            { createdAt: "asc" },
          ],
        })

        for (let dayOffset = 0; dayOffset < 30 && !scheduled; dayOffset++) {
          const scheduledDate = new Date(today)
          scheduledDate.setDate(today.getDate() + dayOffset)

          const dayJobs = existingJobs
            .filter((existingJob) => {
              if (!existingJob.visitDate) return false
              return sameUtcDay(new Date(existingJob.visitDate), scheduledDate)
            })
            .sort((a, b) => {
              const aStart = a.startTime ?? "99:99"
              const bStart = b.startTime ?? "99:99"
              return aStart.localeCompare(bStart)
            })

          let pointer = startOfDay

          for (const existingJob of dayJobs) {
            if (!existingJob.startTime) continue

            const existingStart = timeToMinutes(existingJob.startTime)
            const existingEnd =
              existingStart +
              (typeof existingJob.durationMinutes === "number" && existingJob.durationMinutes > 0
                ? existingJob.durationMinutes
                : 120)

            if (pointer + duration <= existingStart) {
              await prisma.job.update({
                where: { id: job.id },
                data: {
                  visitDate: new Date(scheduledDate),
                  startTime: minutesToTime(pointer),
                  status: "todo",
                },
              })

              if (!existingAssignedWorkerIds.includes(worker.id)) {
                await assignJobToWorkerIfNeeded(job.id, worker.id)
              }

              scheduled = true
              scheduledCount += 1
              break
            }

            if (existingEnd > pointer) {
              pointer = existingEnd
            }
          }

          if (!scheduled && pointer + duration <= endOfDay) {
            await prisma.job.update({
              where: { id: job.id },
              data: {
                visitDate: new Date(scheduledDate),
                startTime: minutesToTime(pointer),
                status: "todo",
              },
            })

            if (!existingAssignedWorkerIds.includes(worker.id)) {
              await assignJobToWorkerIfNeeded(job.id, worker.id)
            }

            scheduled = true
            scheduledCount += 1
          }
        }

        if (scheduled) break
      }
    }

    return NextResponse.json({
      ok: true,
      scheduled: scheduledCount,
    })
  } catch (error) {
    console.error("POST /api/scheduler/run failed:", error)

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to run scheduler",
      },
      { status: 500 }
    )
  }
}