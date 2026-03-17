import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

const TREV_QUOTE_DEFAULT_SLOTS = ["11:00", "12:00", "13:00"]
const FARM_POSTCODE = "TF9 4BQ"

const PREP_START_MINUTES = 8 * 60 + 30
const JOBS_START_MINUTES = 9 * 60
const END_OF_DAY_MINUTES = 16 * 60 + 30
const BREAK_THRESHOLD_MINUTES = 6 * 60
const BREAK_DURATION_MINUTES = 20

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

function normalisePostcode(value: unknown) {
  return cleanString(value).toUpperCase()
}

function postcodeOutward(value: unknown) {
  const postcode = normalisePostcode(value)
  if (!postcode) return ""
  return postcode.split(" ")[0] || ""
}

function postcodeAreaLetters(value: unknown) {
  const outward = postcodeOutward(value)
  const match = outward.match(/^[A-Z]+/)
  return match ? match[0] : ""
}

function postcodeDistrict(value: unknown) {
  const outward = postcodeOutward(value)
  const match = outward.match(/^([A-Z]+)(\d+)/)
  if (!match) return null
  return {
    area: match[1],
    district: Number(match[2]),
  }
}

function getTravelMinutes(fromPostcode: unknown, toPostcode: unknown) {
  const from = normalisePostcode(fromPostcode)
  const to = normalisePostcode(toPostcode)

  if (!from || !to) return 30
  if (from === to) return 10

  const fromOutward = postcodeOutward(from)
  const toOutward = postcodeOutward(to)

  if (fromOutward && fromOutward === toOutward) return 12

  const fromDistrict = postcodeDistrict(from)
  const toDistrict = postcodeDistrict(to)

  if (
    fromDistrict &&
    toDistrict &&
    fromDistrict.area === toDistrict.area &&
    Number.isFinite(fromDistrict.district) &&
    Number.isFinite(toDistrict.district)
  ) {
    const diff = Math.abs(fromDistrict.district - toDistrict.district)
    if (diff <= 1) return 18
    if (diff <= 3) return 25
    return 35
  }

  const fromArea = postcodeAreaLetters(from)
  const toArea = postcodeAreaLetters(to)

  if (fromArea && toArea && fromArea === toArea) return 35

  if (
    (fromArea === "TF" && ["ST", "SY", "CW"].includes(toArea)) ||
    (toArea === "TF" && ["ST", "SY", "CW"].includes(fromArea))
  ) {
    return 40
  }

  if (
    ["TF", "ST", "SY", "CW"].includes(fromArea) &&
    ["TF", "ST", "SY", "CW"].includes(toArea)
  ) {
    return 50
  }

  return 60
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

function getJobPostcode(job: {
  postcode?: string | null
  address?: string | null
  customer?: { postcode?: string | null } | null
}) {
  return (
    normalisePostcode(job.postcode) ||
    normalisePostcode(job.customer?.postcode) ||
    ""
  )
}

function getJobDurationMinutes(job: { durationMinutes?: number | null }) {
  return typeof job.durationMinutes === "number" && job.durationMinutes > 0
    ? job.durationMinutes
    : 120
}

function getScheduledJobWindow(job: {
  startTime?: string | null
  durationMinutes?: number | null
}) {
  if (!job.startTime) return null

  const start = timeToMinutes(job.startTime)
  const duration = getJobDurationMinutes(job)
  const end = start + duration

  return { start, end, duration }
}

function buildDayRouteMetrics(
  dayJobs: Array<{
    startTime?: string | null
    durationMinutes?: number | null
    postcode?: string | null
    address?: string | null
    customer?: { postcode?: string | null } | null
  }>
) {
  const sorted = [...dayJobs]
    .filter((job) => !!job.startTime)
    .sort((a, b) => {
      const aStart = a.startTime ?? "99:99"
      const bStart = b.startTime ?? "99:99"
      return aStart.localeCompare(bStart)
    })

  let currentPostcode = FARM_POSTCODE
  let totalWorkMinutes = 0

  const enriched = sorted.map((job, index) => {
    const window = getScheduledJobWindow(job)
    const jobPostcode = getJobPostcode(job)
    const travelMinutes =
      index === 0
        ? getTravelMinutes(FARM_POSTCODE, jobPostcode)
        : getTravelMinutes(currentPostcode, jobPostcode)

    currentPostcode = jobPostcode || currentPostcode

    if (window) {
      totalWorkMinutes += window.duration
    }

    return {
      job,
      window,
      travelMinutes,
      postcode: jobPostcode,
    }
  })

  return {
    enriched,
    totalWorkMinutes,
  }
}

function scoreCandidateJob(params: {
  currentPostcode: string
  worker: {
    firstName: string | null
    lastName: string | null
    email?: string | null
  }
  job: {
    jobType?: string | null
    postcode?: string | null
    address?: string | null
    customer?: { postcode?: string | null } | null
  }
}) {
  const { currentPostcode, worker, job } = params
  const jobPostcode = getJobPostcode(job)
  const travelMinutes = getTravelMinutes(currentPostcode, jobPostcode)

  let score = travelMinutes

  if (isQuoteJobType(job.jobType)) {
    if (isTrevWorker(worker)) {
      score -= 15
    } else {
      score += 5000
    }
  }

  return {
    score,
    travelMinutes,
    jobPostcode,
  }
}

export async function POST() {
  try {
    const workers = await prisma.worker.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    })

    const unscheduledJobs = await prisma.job.findMany({
      where: {
        OR: [{ status: "unscheduled" }, { visitDate: null }],
      },
      orderBy: { createdAt: "asc" },
      include: {
        assignments: true,
        customer: {
          select: {
            postcode: true,
          },
        },
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
    let scheduledCount = 0
    const scheduledJobIds = new Set<number>()

    for (const worker of workers) {
      const workerExistingJobs = await prisma.job.findMany({
        where: {
          assignments: {
            some: {
              workerId: worker.id,
            },
          },
          visitDate: {
            gte: today,
          },
        },
        orderBy: [
          { visitDate: "asc" },
          { startTime: "asc" },
          { createdAt: "asc" },
        ],
        include: {
          customer: {
            select: {
              postcode: true,
            },
          },
        },
      })

      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const scheduledDate = new Date(today)
        scheduledDate.setDate(today.getDate() + dayOffset)

        const dayJobs = workerExistingJobs
          .filter((existingJob) => {
            if (!existingJob.visitDate) return false
            return sameUtcDay(new Date(existingJob.visitDate), scheduledDate)
          })
          .sort((a, b) => {
            const aStart = a.startTime ?? "99:99"
            const bStart = b.startTime ?? "99:99"
            return aStart.localeCompare(bStart)
          })

        let mutableDayJobs = [...dayJobs]

        while (true) {
          const routeMetrics = buildDayRouteMetrics(mutableDayJobs)
          const lastScheduled = routeMetrics.enriched[routeMetrics.enriched.length - 1]

          const currentPostcode = lastScheduled?.postcode || FARM_POSTCODE
          const currentTime = lastScheduled?.window?.end ?? JOBS_START_MINUTES

          let totalWorkMinutes = routeMetrics.totalWorkMinutes
          let breakAlreadyAdded = totalWorkMinutes >= BREAK_THRESHOLD_MINUTES

          const availableJobs = unscheduledJobs.filter((job) => {
            if (scheduledJobIds.has(job.id)) return false
            return true
          })

          if (availableJobs.length === 0) {
            break
          }

          const rankedJobs = availableJobs
            .map((job) => {
              const candidate = scoreCandidateJob({
                currentPostcode,
                worker,
                job,
              })

              return {
                job,
                ...candidate,
              }
            })
            .sort((a, b) => {
              if (a.score !== b.score) return a.score - b.score
              return a.job.createdAt.getTime() - b.job.createdAt.getTime()
            })

          let placedOne = false

          for (const candidate of rankedJobs) {
            const job = candidate.job
            const duration = getJobDurationMinutes(job)
            const existingAssignedWorkerIds = job.assignments.map(
              (assignment) => assignment.workerId
            )

            if (isQuoteJobType(job.jobType) && isTrevWorker(worker)) {
              const trevQuoteScheduled = await tryScheduleTrevQuoteJob({
                jobId: job.id,
                duration,
                worker,
                existingAssignedWorkerIds,
                today,
              })

              if (trevQuoteScheduled) {
                scheduledJobIds.add(job.id)
                scheduledCount += 1
                placedOne = true
                break
              }

              continue
            }

            if (isQuoteJobType(job.jobType) && !isTrevWorker(worker)) {
              continue
            }

            const proposedTravel = candidate.travelMinutes
            const proposedStart = Math.max(currentTime + proposedTravel, JOBS_START_MINUTES)

            let proposedEnd = proposedStart + duration
            let breakToAdd = 0

            if (!breakAlreadyAdded && totalWorkMinutes + duration >= BREAK_THRESHOLD_MINUTES) {
              breakToAdd = BREAK_DURATION_MINUTES
              proposedEnd += BREAK_DURATION_MINUTES
            }

            if (proposedEnd > END_OF_DAY_MINUTES) {
              continue
            }

            await prisma.job.update({
              where: { id: job.id },
              data: {
                visitDate: new Date(scheduledDate),
                startTime: minutesToTime(proposedStart),
                status: "todo",
              },
            })

            if (!existingAssignedWorkerIds.includes(worker.id)) {
              await assignJobToWorkerIfNeeded(job.id, worker.id)
            }

            const refreshedJob = await prisma.job.findUnique({
              where: { id: job.id },
              include: {
                customer: {
                  select: {
                    postcode: true,
                  },
                },
              },
            })

            if (refreshedJob) {
              mutableDayJobs.push(refreshedJob)
              mutableDayJobs = mutableDayJobs.sort((a, b) => {
                const aStart = a.startTime ?? "99:99"
                const bStart = b.startTime ?? "99:99"
                return aStart.localeCompare(bStart)
              })
            }

            totalWorkMinutes += duration
            if (breakToAdd > 0) {
              breakAlreadyAdded = true
            }

            scheduledJobIds.add(job.id)
            scheduledCount += 1
            placedOne = true
            break
          }

          if (!placedOne) {
            break
          }
        }
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