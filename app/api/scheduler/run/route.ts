import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`
}

export async function POST() {

  const workers = await prisma.worker.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" }
  })

  const unscheduledJobs = await prisma.job.findMany({
    where: {
      OR: [
        { status: "unscheduled" },
        { visitDate: null }
      ]
    },
    orderBy: { createdAt: "asc" }
  })

  if (workers.length === 0) {
    return NextResponse.json({ message: "No workers found" })
  }

  const today = new Date()
  const startOfDay = 8 * 60
  const endOfDay = 17 * 60

  for (const job of unscheduledJobs) {

    const duration = job.durationMins || 120

    let scheduled = false

    for (const worker of workers) {

      const existing = await prisma.job.findMany({
        where: {
          assignedTo: worker.key,
          visitDate: { gte: today }
        }
      })

      let pointer = startOfDay

      for (const e of existing) {

        if (!e.startTime) continue

        const start = timeToMinutes(e.startTime)
        const end = start + (e.durationMins || 120)

        if (pointer + duration <= start) {

          await prisma.job.update({
            where: { id: job.id },
            data: {
              visitDate: new Date(),
              startTime: minutesToTime(pointer),
              assignedTo: worker.key,
              status: "scheduled"
            }
          })

          scheduled = true
          break
        }

        pointer = end
      }

      if (!scheduled && pointer + duration <= endOfDay) {

        await prisma.job.update({
          where: { id: job.id },
          data: {
            visitDate: new Date(),
            startTime: minutesToTime(pointer),
            assignedTo: worker.key,
            status: "scheduled"
          }
        })

        scheduled = true
      }

      if (scheduled) break
    }
  }

  return NextResponse.json({ success: true })
}