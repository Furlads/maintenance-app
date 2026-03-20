import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

const TREV_QUOTE_DEFAULT_SLOTS = ["11:00", "12:00", "13:00"]
const FARM_POSTCODE = "TF9 4BQ"

const PREP_START_MINUTES = 8 * 60 + 30
const JOBS_START_MINUTES = 9 * 60
const END_OF_DAY_MINUTES = 16 * 60 + 30
const BREAK_THRESHOLD_MINUTES = 6 * 60
const BREAK_DURATION_MINUTES = 20

type WorkerLite = {
  id: number
  firstName: string | null
  lastName: string | null
  email?: string | null
}

type JobWithRelations = {
  id: number
  title: string | null
  jobType: string | null
  postcode?: string | null
  address?: string | null
  visitDate: Date | null
  startTime: string | null
  durationMinutes: number | null
  status: string | null
  createdAt: Date
  customer: {
    postcode: string | null
  } | null
  assignments: Array<{
    workerId: number
  }>
}

type ScheduledWindow = {
  start: number
  end: number
  duration: number
}

type DayJobLike = {
  id: number
  startTime?: string | null
  durationMinutes?: number | null
  postcode?: string | null
  address?: string | null
  customer?: { postcode?: string | null } | null
}

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

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
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

function isTrevWorker(worker: WorkerLite) {
  const first = cleanString(worker.firstName).toLowerCase()
  const last = cleanString(worker.lastName).toLowerCase()
  const email = cleanString(worker.email).toLowerCase()

  const firstMatches = first === "trevor" || first === "trev"
  const lastMatches = last.includes("fudger")
  const emailMatches = email.includes("trevor.fudger")

  return (firstMatches && lastMatches) || emailMatches
}

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
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
  worker: WorkerLite
  existingAssignedWorkerIds: number[]
  today: Date
  preferredDate: Date | null
}) {
  const { jobId, duration, worker, existingAssignedWorkerIds, today, preferredDate } = params

  if (!isTrevWorker(worker)) {
    return false
  }

  if (duration > 60) {
    return false
  }

  const datesToTry = preferredDate
    ? [startOfLocalDay(preferredDate)]
    : Array.from({ length: 30 }, (_, i) => startOfLocalDay(addDays(today, i)))

  for (const scheduledDate of datesToTry) {
    const dayStart = startOfLocalDay(scheduledDate)
    const dayEnd = endOfLocalDay(scheduledDate)

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
        visitDate: dayStart,
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
}): ScheduledWindow | null {
  if (!job.startTime) return null

  const start = timeToMinutes(job.startTime)
  const duration = getJobDurationMinutes(job)
  const end = start + duration

  return { start, end, duration }
}

function sortDayJobs<T extends { startTime?: string | null; id: number }>(jobs: T[]) {
  return [...jobs].sort((a, b) => {
    const aStart = a.startTime ?? "99:99"
    const bStart = b.startTime ?? "99:99"
    if (aStart !== bStart) return aStart.localeCompare(bStart)
    return a.id - b.id
  })
}

function getScheduledDayJobs(dayJobs: DayJobLike[]) {
  return sortDayJobs(dayJobs).filter((job) => !!job.startTime)
}

function getTotalWorkMinutes(dayJobs: DayJobLike[]) {
  return getScheduledDayJobs(dayJobs).reduce((total, job) => {
    return total + getJobDurationMinutes(job)
  }, 0)
}

function getWorkMinutesBeforeIndex(dayJobs: DayJobLike[], exclusiveIndex: number) {
  return dayJobs.slice(0, exclusiveIndex).reduce((total, job) => {
    return total + getJobDurationMinutes(job)
  }, 0)
}

function scoreCandidateJob(params: {
  currentPostcode: string
  worker: WorkerLite
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

function findBestSlotForJob(params: {
  dayJobs: DayJobLike[]
  candidateJob: JobWithRelations
}) {
  const { dayJobs, candidateJob } = params

  const scheduledJobs = getScheduledDayJobs(dayJobs)
  const duration = getJobDurationMinutes(candidateJob)
  const candidatePostcode = getJobPostcode(candidateJob)
  const totalWorkMinutes = getTotalWorkMinutes(scheduledJobs)
  const breakAlreadyAdded = totalWorkMinutes >= BREAK_THRESHOLD_MINUTES

  let bestSlot:
    | {
        startMinutes: number
        endMinutes: number
      }
    | null = null

  for (let insertIndex = 0; insertIndex <= scheduledJobs.length; insertIndex++) {
    const previousJob = insertIndex > 0 ? scheduledJobs[insertIndex - 1] : null
    const nextJob = insertIndex < scheduledJobs.length ? scheduledJobs[insertIndex] : null

    const previousWindow = previousJob ? getScheduledJobWindow(previousJob) : null
    const nextWindow = nextJob ? getScheduledJobWindow(nextJob) : null

    const previousPostcode = previousJob ? getJobPostcode(previousJob) : FARM_POSTCODE
    const nextPostcode = nextJob ? getJobPostcode(nextJob) : ""

    const travelFromPrevious = getTravelMinutes(previousPostcode, candidatePostcode)
    const travelToNext = nextJob
      ? getTravelMinutes(candidatePostcode, nextPostcode)
      : 0

    const earliestBaseStart = previousWindow
      ? previousWindow.end + travelFromPrevious
      : Math.max(PREP_START_MINUTES + travelFromPrevious, JOBS_START_MINUTES)

    const workMinutesBefore = getWorkMinutesBeforeIndex(scheduledJobs, insertIndex)
    const breakNeededOnThisPlacement =
      !breakAlreadyAdded &&
      workMinutesBefore < BREAK_THRESHOLD_MINUTES &&
      workMinutesBefore + duration >= BREAK_THRESHOLD_MINUTES

    const extraBreakMinutes = breakNeededOnThisPlacement ? BREAK_DURATION_MINUTES : 0
    const candidateStart = Math.max(earliestBaseStart, JOBS_START_MINUTES)
    const candidateEnd = candidateStart + duration + extraBreakMinutes

    if (nextWindow) {
      if (candidateEnd + travelToNext > nextWindow.start) {
        continue
      }
    } else {
      if (candidateEnd > END_OF_DAY_MINUTES) {
        continue
      }
    }

    if (
      !bestSlot ||
      candidateStart < bestSlot.startMinutes ||
      (candidateStart === bestSlot.startMinutes && candidateEnd < bestSlot.endMinutes)
    ) {
      bestSlot = {
        startMinutes: candidateStart,
        endMinutes: candidateEnd,
      }
    }
  }

  return bestSlot
}

export async function POST() {
  try {
    const workers = await prisma.worker.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    })

    const unscheduledJobs = await prisma.job.findMany({
      where: {
        status: {
          notIn: ["done", "cancelled"],
        },
        OR: [
          { status: "unscheduled" },
          { visitDate: null },
          { startTime: null },
        ],
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
          status: {
            notIn: ["done", "cancelled"],
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
        const scheduledDate = startOfLocalDay(addDays(today, dayOffset))

        let mutableDayJobs = sortDayJobs(
          workerExistingJobs.filter((existingJob) => {
            if (!existingJob.visitDate) return false
            return sameLocalDay(existingJob.visitDate, scheduledDate)
          })
        )

        while (true) {
          const availableJobs = unscheduledJobs.filter((job) => {
            if (scheduledJobIds.has(job.id)) return false

            if (job.visitDate) {
              return sameLocalDay(job.visitDate, scheduledDate)
            }

            return true
          })

          if (availableJobs.length === 0) {
            break
          }

          const currentPostcode =
            mutableDayJobs.length > 0
              ? getJobPostcode(mutableDayJobs[mutableDayJobs.length - 1])
              : FARM_POSTCODE

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
                preferredDate: job.visitDate,
              })

              if (trevQuoteScheduled) {
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

                if (refreshedJob && refreshedJob.visitDate && sameLocalDay(refreshedJob.visitDate, scheduledDate)) {
                  mutableDayJobs = sortDayJobs([...mutableDayJobs, refreshedJob])
                  workerExistingJobs.push(refreshedJob)
                }

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

            const slot = findBestSlotForJob({
              dayJobs: mutableDayJobs,
              candidateJob: job,
            })

            if (!slot) {
              continue
            }

            const storedDate = startOfLocalDay(
              job.visitDate ? job.visitDate : scheduledDate
            )

            await prisma.job.update({
              where: { id: job.id },
              data: {
                visitDate: storedDate,
                startTime: minutesToTime(slot.startMinutes),
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
              mutableDayJobs = sortDayJobs([...mutableDayJobs, refreshedJob])
              workerExistingJobs.push(refreshedJob)
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