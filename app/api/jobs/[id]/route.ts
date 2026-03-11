export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Ctx = {
  params: Promise<{ id: string }>
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const jobId = Number(id)

    if (!Number.isInteger(jobId) || jobId <= 0) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('GET job failed:', error)

    return NextResponse.json(
      { error: 'Failed to load job' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const jobId = Number(id)

    if (!Number.isInteger(jobId) || jobId <= 0) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))

    const existing = await prisma.job.findUnique({
      where: { id: jobId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const action = clean((body as any).action).toLowerCase()

    let statusUpdate: string | undefined = undefined
    let arrivedUpdate: Date | null | undefined = undefined
    let finishedUpdate: Date | null | undefined = undefined

    // worker arrives on site
    if (action === 'start') {
      arrivedUpdate = new Date()
      statusUpdate = 'in_progress'
    }

    // worker finishes job
    if (action === 'finish') {
      finishedUpdate = new Date()
      statusUpdate = 'done'
    }

    // toggle done / undo
    if ((body as any).toggleStatus === true) {
      const isDone = String(existing.status).toLowerCase() === 'done'

      statusUpdate = isDone ? 'todo' : 'done'

      if (isDone) {
        finishedUpdate = null
      } else {
        finishedUpdate = new Date()
      }
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        title: typeof (body as any).title === 'string' ? (body as any).title : undefined,
        address: typeof (body as any).address === 'string' ? (body as any).address : undefined,
        notes: typeof (body as any).notes === 'string' ? (body as any).notes : undefined,
        status: statusUpdate,
        arrivedAt: arrivedUpdate,
        finishedAt: finishedUpdate
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH job failed:', error)

    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    )
  }
}