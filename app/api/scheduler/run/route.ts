import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST() {

  const workers = await prisma.worker.findMany({
    where: { active: true }
  })

  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { status: "unscheduled" },
        { visitDate: null }
      ]
    },
    orderBy: {
      createdAt: "asc"
    }
  })

  if (workers.length === 0) {
    return NextResponse.json({ message: "No workers available" })
  }

  const startHour = 8
  const endHour = 17

  let workerIndex = 0
  let currentDate = new Date()

  for (const job of jobs) {

    const worker = workers[workerIndex % workers.length]

    const visitDate = new Date(currentDate)

    const startTime = `${String(startHour).padStart(2, "0")}:00`

    await prisma.job.update({
      where: { id: job.id },
      data: {
        visitDate,
        startTime,
        assignedTo: worker.key,
        status: "scheduled"
      }
    })

    workerIndex++
  }

  return NextResponse.json({
    scheduled: jobs.length
  })
}