import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  findNextAvailableInstallWindow,
  generateLandscapingPlan,
  getLatestLandscapingPlan,
  saveLandscapingActualCosts,
} from '@/lib/landscaping-plan'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: {
    id: string
  }
}

async function getLandscapingJob(id: number) {
  return prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      jobType: true,
      status: true,
    },
  })
}

function isLandscaping(jobType: string | null | undefined) {
  return String(jobType || '').toLowerCase().includes('land')
}

function validId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })
    }

    const job = await getLandscapingJob(id)
    if (!job) {
      return NextResponse.json({ ok: false, error: 'Job not found.' }, { status: 404 })
    }
    if (!isLandscaping(job.jobType)) {
      return NextResponse.json({ ok: false, error: 'This is not a landscaping job.' }, { status: 400 })
    }

    const plan = await getLatestLandscapingPlan(id)
    const availability = plan
      ? await findNextAvailableInstallWindow({
          jobId: id,
          totalDays: plan.totalDays,
          teamSize: plan.teamSize,
        })
      : null

    return NextResponse.json({ ok: true, plan, availability })
  } catch (error) {
    console.error('GET LANDSCAPING PLAN ERROR', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to load landscaping plan.' },
      { status: 500 }
    )
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })
    }

    const job = await getLandscapingJob(id)
    if (!job) {
      return NextResponse.json({ ok: false, error: 'Job not found.' }, { status: 404 })
    }
    if (!isLandscaping(job.jobType)) {
      return NextResponse.json({ ok: false, error: 'This is not a landscaping job.' }, { status: 400 })
    }

    const plan = await generateLandscapingPlan(id)
    const availability = await findNextAvailableInstallWindow({
      jobId: id,
      totalDays: plan.totalDays,
      teamSize: plan.teamSize,
    })

    return NextResponse.json({ ok: true, plan, availability })
  } catch (error) {
    console.error('GENERATE LANDSCAPING PLAN ERROR', error)
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate landscaping plan.',
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })
    }

    const job = await getLandscapingJob(id)
    if (!job) {
      return NextResponse.json({ ok: false, error: 'Job not found.' }, { status: 404 })
    }
    if (!isLandscaping(job.jobType)) {
      return NextResponse.json({ ok: false, error: 'This is not a landscaping job.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const plan = await saveLandscapingActualCosts(id, {
      materialProjectedCosts: Array.isArray(body.materialProjectedCosts)
        ? body.materialProjectedCosts
        : undefined,
      materialActualCosts: Array.isArray(body.materialActualCosts)
        ? body.materialActualCosts
        : undefined,
      labourExVat: body.labourExVat,
      plantWasteExVat: body.plantWasteExVat,
      otherExVat: body.otherExVat,
    })

    return NextResponse.json({ ok: true, plan })
  } catch (error) {
    console.error('SAVE LANDSCAPING COSTS ERROR', error)
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to save landscaping costs.',
      },
      { status: 500 }
    )
  }
}
