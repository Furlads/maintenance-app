export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const jobId = parseInt(id, 10)

    if (!jobId || Number.isNaN(jobId)) {
      return NextResponse.json(
        { error: 'Invalid job id', received: id },
        { status: 400 }
      )
    }

    const existing = await prisma.job.findUnique({
      where: { id: jobId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'archived',
        visitDate: null,
        startTime: null,
        arrivedAt: null,
        finishedAt: null,
        pausedAt: null,
        pausedMinutes: 0,
      },
    })

    return NextResponse.json({
      ok: true,
      id: updated.id,
      status: updated.status,
    })
  } catch (error) {
    console.error('POST /api/jobs/[id]/archive failed:', error)

    return NextResponse.json(
      { error: 'Failed to archive job' },
      { status: 500 }
    )
  }
}