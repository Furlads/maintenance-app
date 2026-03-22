import { NextResponse } from 'next/server'
import * as prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

function parseDateTime(date: string, time?: string | null) {
  const base = new Date(`${date}T00:00:00`)
  if (!time) return base

  const [h, m] = time.split(':').map(Number)
  base.setHours(h || 0, m || 0, 0, 0)
  return base
}

function addMinutes(date: Date, mins: number) {
  return new Date(date.getTime() + mins * 60000)
}

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      workerId,
      startDate,
      endDate,
      startTime,
      endTime,
      isFullDay
    } = body

    const blockStart = parseDateTime(startDate, isFullDay ? null : startTime)
    const blockEnd = parseDateTime(endDate, isFullDay ? null : endTime)

    if (isFullDay) {
      blockStart.setHours(0, 0, 0, 0)
      blockEnd.setHours(23, 59, 59, 999)
    }

    const jobs = await prisma.job.findMany({
      where: {
        assignments: {
          some: { workerId }
        },
        status: {
          notIn: ['archived', 'cancelled']
        }
      },
      include: {
        customer: true
      }
    })

    const clashes = []

    for (const job of jobs) {
      if (!job.visitDate) continue

      const jobStart = parseDateTime(
        job.visitDate.toISOString().slice(0, 10),
        job.startTime || '09:00'
      )

      const duration = job.durationMinutes || 60
      const jobEnd = addMinutes(jobStart, duration)

      if (overlap(blockStart, blockEnd, jobStart, jobEnd)) {
        clashes.push({
          jobId: job.id,
          customerName: job.customer?.name || 'Unknown',
          address: job.address,
          postcode: job.customer?.postcode || '',
          startTime: job.startTime,
          date: job.visitDate
        })
      }
    }

    return NextResponse.json({
      ok: true,
      clashes
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}