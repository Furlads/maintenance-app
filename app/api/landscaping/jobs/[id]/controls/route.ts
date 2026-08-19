import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  getLatestLandscapingControls,
  saveLandscapingControls,
} from '@/lib/landscaping-controls'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: {
    id: string
  }
}

function validId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

async function getJob(id: number) {
  return prisma.job.findUnique({
    where: { id },
    select: { id: true, jobType: true },
  })
}

function isLandscaping(jobType: string | null | undefined) {
  return String(jobType || '').toLowerCase().includes('land')
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })

    const job = await getJob(id)
    if (!job) return NextResponse.json({ ok: false, error: 'Job not found.' }, { status: 404 })
    if (!isLandscaping(job.jobType)) {
      return NextResponse.json({ ok: false, error: 'This is not a landscaping job.' }, { status: 400 })
    }

    const controls = await getLatestLandscapingControls(id)
    return NextResponse.json({ ok: true, controls })
  } catch (error) {
    console.error('GET LANDSCAPING CONTROLS ERROR', error)
    return NextResponse.json({ ok: false, error: 'Failed to load landscaping controls.' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })

    const job = await getJob(id)
    if (!job) return NextResponse.json({ ok: false, error: 'Job not found.' }, { status: 404 })
    if (!isLandscaping(job.jobType)) {
      return NextResponse.json({ ok: false, error: 'This is not a landscaping job.' }, { status: 400 })
    }

    const session = await getSession()
    const workerId = session?.workerId ? Number(session.workerId) : null
    const body = await request.json().catch(() => ({}))
    const controls = await saveLandscapingControls(
      id,
      {
        materials: body.materials,
        customerExtras: body.customerExtras,
        extraItems: body.extraItems,
      },
      Number.isInteger(workerId) ? workerId : null
    )

    return NextResponse.json({ ok: true, controls })
  } catch (error) {
    console.error('SAVE LANDSCAPING CONTROLS ERROR', error)
    return NextResponse.json({ ok: false, error: 'Failed to save landscaping controls.' }, { status: 500 })
  }
}
