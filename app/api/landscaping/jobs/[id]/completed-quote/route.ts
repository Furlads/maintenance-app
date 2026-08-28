import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateLandscapingPlan } from '@/lib/landscaping-plan'
import { applyAndSaveMaterialPolicy } from '@/lib/landscaping-material-policy'

export const runtime = 'nodejs'

type RouteContext = { params: { id: string } }

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function positiveNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const jobId = Number(params.id)
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })
    }

    const body = await req.json()
    const scope = clean(body.scope)
    const priceExVat = positiveNumber(body.priceExVat)
    const estimatedDays = positiveNumber(body.estimatedDays)
    const estimatedTeamSize = positiveNumber(body.estimatedTeamSize)

    if (!scope || !priceExVat || !estimatedDays || !estimatedTeamSize) {
      return NextResponse.json({ ok: false, error: 'Add the agreed work, price, working days and number of workers.' }, { status: 400 })
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true, quotes: { select: { id: true }, take: 1 } },
    })

    if (!job || !String(job.jobType || '').toLowerCase().includes('land')) {
      return NextResponse.json({ ok: false, error: 'Landscaping job not found.' }, { status: 404 })
    }

    if (job.quotes.length) {
      return NextResponse.json({ ok: false, error: 'This job already has a quote attached.' }, { status: 409 })
    }

    const vatAmount = Number((priceExVat * 0.2).toFixed(2))
    const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))
    const depositAmount = Number((totalIncVat * 0.25).toFixed(2))

    const quote = await prisma.quote.create({
      data: {
        customerId: job.customerId,
        jobId: job.id,
        customerName: job.customer.name,
        customerPhone: job.customer.phone,
        customerEmail: job.customer.email,
        customerAddress: job.customer.address || job.address,
        customerPostcode: job.customer.postcode,
        scope,
        internalNotes: 'Completed quote added to an existing landscaping job.',
        priceExVat,
        vatRate: 20,
        vatAmount,
        totalIncVat,
        depositPercent: 25,
        depositAmount,
        estimatedDays,
        estimatedTeamSize: Math.max(1, Math.round(estimatedTeamSize)),
        status: 'accepted',
        acceptedAt: new Date(),
      },
    })

    let planningWarning: string | null = null
    try {
      const generatedPlan = await generateLandscapingPlan(job.id)
      await applyAndSaveMaterialPolicy(generatedPlan)
    } catch (planningError) {
      console.error('COMPLETED QUOTE PLAN GENERATION ERROR', planningError)
      planningWarning = 'The quote was linked successfully. Use “Regenerate job pack” to finish creating the worker job sheet.'
    }

    return NextResponse.json({ ok: true, quote, planningWarning })
  } catch (error) {
    console.error('ADD COMPLETED LANDSCAPING QUOTE ERROR', error)
    return NextResponse.json({ ok: false, error: 'Failed to add the completed quote.' }, { status: 500 })
  }
}
