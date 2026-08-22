import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateLandscapingPlan } from '@/lib/landscaping-plan'
import { applyAndSaveMaterialPolicy } from '@/lib/landscaping-material-policy'

export const runtime = 'nodejs'

type RouteContext = {
  params: {
    id: string
  }
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function extractSurveyPhotos(quoteWorking: string | null | undefined) {
  const working = clean(quoteWorking)
  if (!working) return [] as Array<{ url: string; fileName: string }>

  const marker = 'SURVEY PHOTOS JSON\n'
  const markerIndex = working.lastIndexOf(marker)
  if (markerIndex < 0) return []

  const jsonText = working.slice(markerIndex + marker.length).trim()

  try {
    const parsed = JSON.parse(jsonText)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const row = item as Record<string, unknown>
        const url = clean(row.url)
        const fileName = clean(row.fileName) || 'Site photo'
        return url.startsWith('https://') ? { url, fileName } : null
      })
      .filter(
        (photo): photo is { url: string; fileName: string } => photo !== null
      )
      .slice(0, 12)
  } catch {
    return []
  }
}

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const id = Number(params.id)

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid quote id.' },
        { status: 400 }
      )
    }

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { customer: true, job: true },
    })

    if (!quote) {
      return NextResponse.json(
        { ok: false, error: 'Quote not found.' },
        { status: 404 }
      )
    }

    if (quote.job) {
      return NextResponse.json({ ok: true, quote, job: quote.job })
    }

    const customerName = clean(quote.customerName) || clean(quote.customer?.name)
    const customerPostcode = clean(quote.customerPostcode) || clean(quote.customer?.postcode)
    const surveyPhotos = extractSurveyPhotos(quote.quoteWorking)

    if (!customerName || !customerPostcode) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Add the customer name and postcode before accepting and creating the job.',
        },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      let customer = quote.customer

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            name: customerName,
            phone: clean(quote.customerPhone) || null,
            email: clean(quote.customerEmail) || null,
            address: clean(quote.customerAddress) || null,
            postcode: customerPostcode,
          },
        })
      } else {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            name: customerName,
            phone: clean(quote.customerPhone) || customer.phone,
            email: clean(quote.customerEmail) || customer.email,
            address: clean(quote.customerAddress) || customer.address,
            postcode: customerPostcode,
          },
        })
      }

      const address = [clean(quote.customerAddress), customerPostcode]
        .filter(Boolean)
        .join(', ')

      const durationMinutes = quote.estimatedDays
        ? Math.max(60, Math.round(quote.estimatedDays * 450))
        : null

      const job = await tx.job.create({
        data: {
          title: quote.scope.slice(0, 180),
          customerId: customer.id,
          address,
          notes: [
            `Accepted quote #${quote.id}`,
            `Quoted total: £${quote.totalIncVat.toFixed(2)} inc VAT`,
            quote.estimatedDays
              ? `Estimated install: ${quote.estimatedDays} day(s) with ${quote.estimatedTeamSize || 1} person/people`
              : null,
            surveyPhotos.length
              ? `${surveyPhotos.length} quote survey photo(s) attached to this job.`
              : null,
            quote.internalNotes || null,
          ]
            .filter(Boolean)
            .join('\n'),
          status: 'unscheduled',
          jobType: 'Landscaping',
          durationMinutes,
          fixedSchedule: false,
        },
      })

      if (surveyPhotos.length) {
        await tx.jobPhoto.createMany({
          data: surveyPhotos.map((photo, index) => ({
            jobId: job.id,
            uploadedByWorkerId: null,
            label: `Survey ${index + 1}`,
            imageUrl: photo.url,
          })),
        })
      }

      const updatedQuote = await tx.quote.update({
        where: { id: quote.id },
        data: {
          customerId: customer.id,
          jobId: job.id,
          status: 'accepted',
          acceptedAt: new Date(),
          archivedAt: null,
        },
      })

      return { customer, job, quote: updatedQuote }
    })

    let landscapingPlan = null
    let planningWarning: string | null = null

    try {
      const generatedPlan = await generateLandscapingPlan(result.job.id)
      landscapingPlan = await applyAndSaveMaterialPolicy(generatedPlan)
    } catch (planningError) {
      console.error('LANDSCAPING PLAN GENERATION ERROR', planningError)
      planningWarning =
        'The job was created successfully, but the landscaping job pack still needs generating.'
    }

    return NextResponse.json({
      ok: true,
      ...result,
      landscapingPlan,
      planningWarning,
      surveyPhotoCount: surveyPhotos.length,
    })
  } catch (error) {
    console.error('ACCEPT QUOTE ERROR', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to accept quote and create job.' },
      { status: 500 }
    )
  }
}
