import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

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

      let scheduled = false

      for (const worker of workers) {
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

        let scheduledDate = new Date(today)

        for (let dayOffset = 0; dayOffset < 30 && !scheduled; dayOffset++) {
          scheduledDate = new Date(today)
          scheduledDate.setDate(today.getDate() + dayOffset)

          const dayJobs = existingJobs
            .filter((existingJob) => {
              if (!existingJob.visitDate) return false

              const visitDate = new Date(existingJob.visitDate)
              return (
                visitDate.getFullYear() === scheduledDate.getFullYear() &&
                visitDate.getMonth() === scheduledDate.getMonth() &&
                visitDate.getDate() === scheduledDate.getDate()
              )
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

              const alreadyAssigned = job.assignments.some(
                (assignment) => assignment.workerId === worker.id
              )

              if (!alreadyAssigned) {
                await prisma.jobAssignment.create({
                  data: {
                    jobId: job.id,
                    workerId: worker.id,
                  },
                })
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

            const alreadyAssigned = job.assignments.some(
              (assignment) => assignment.workerId === worker.id
            )

            if (!alreadyAssigned) {
              await prisma.jobAssignment.create({
                data: {
                  jobId: job.id,
                  workerId: worker.id,
                },
              })
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