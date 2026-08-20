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

function isLandscaping(value: string | null | undefined) {
  return String(value || '').toLowerCase().includes('land')
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })

    const [job, controls, afterPhotoCount, session] = await Promise.all([
      prisma.job.findUnique({
        where: { id },
        select: { id: true, jobType: true, status: true },
      }),
      getLatestLandscapingControls(id),
      prisma.jobPhoto.count({
        where: {
          jobId: id,
          label: { equals: 'After', mode: 'insensitive' },
        },
      }),
      getSession(),
    ])

    if (!job) return NextResponse.json({ ok: false, error: 'Job not found.' }, { status: 404 })
    if (!isLandscaping(job.jobType)) {
      return NextResponse.json({ ok: false, error: 'This is not a landscaping job.' }, { status: 400 })
    }

    if (afterPhotoCount < 3) {
      return NextResponse.json({ ok: false, error: 'Upload at least 3 after photos before completing the job.' }, { status: 400 })
    }

    if (!controls.completion.qualityChecked) {
      return NextResponse.json({ ok: false, error: 'Complete the final quality check before signing the job off.' }, { status: 400 })
    }

    if (!controls.completion.workerSignedOff) {
      return NextResponse.json({ ok: false, error: 'Worker sign-off is required before completing the job.' }, { status: 400 })
    }

    if (controls.completion.customerStatus === 'issue') {
      return NextResponse.json({ ok: false, error: 'The customer has raised an issue. Resolve or record the next action before completing the job.' }, { status: 400 })
    }

    if (!controls.completion.customerStatus) {
      return NextResponse.json({ ok: false, error: 'Record the customer handover outcome before completing the job.' }, { status: 400 })
    }

    if (controls.completion.customerStatus === 'happy') {
      if (!controls.completion.customerName || !controls.completion.customerConfirmed) {
        return NextResponse.json({ ok: false, error: 'Record the customer name and confirmation before completing the job.' }, { status: 400 })
      }
    }

    const openIssueCount = controls.siteIssues.filter((issue) => !issue.resolved).length
    if (openIssueCount > 0) {
      return NextResponse.json({ ok: false, error: `${openIssueCount} site issue${openIssueCount === 1 ? ' is' : 's are'} still open.` }, { status: 400 })
    }

    const pendingVariations = controls.variations.filter((variation) => variation.status === 'pending')
    if (pendingVariations.length > 0) {
      return NextResponse.json({ ok: false, error: `${pendingVariations.length} customer extra${pendingVariations.length === 1 ? ' is' : 's are'} still awaiting a decision.` }, { status: 400 })
    }

    const completedAt = new Date().toISOString()
    const workerId = session?.workerId ? Number(session.workerId) : null

    await prisma.job.update({
      where: { id },
      data: {
        status: 'done',
        finishedAt: new Date(completedAt),
      },
    })

    const saved = await saveLandscapingControls(
      id,
      {
        completion: {
          ...controls.completion,
          completedAt,
        },
      },
      Number.isInteger(workerId) ? workerId : null
    )

    return NextResponse.json({
      ok: true,
      completedAt,
      completion: saved.completion,
      afterPhotoCount,
    })
  } catch (error) {
    console.error('COMPLETE LANDSCAPING JOB ERROR', error)
    return NextResponse.json({ ok: false, error: 'Could not complete the landscaping job.' }, { status: 500 })
  }
}
