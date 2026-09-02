import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const STANDARD_VAT_RATE = 20

type RouteContext = {
  params: {
    id: string
  }
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid quote id.' }, { status: 400 })
    }

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { customer: true, job: true },
    })

    if (!quote) {
      return NextResponse.json({ ok: false, error: 'Quote not found.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, quote })
  } catch (error) {
    console.error('GET QUOTE ERROR', error)
    return NextResponse.json({ ok: false, error: 'Failed to load quote.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid quote id.' },
        { status: 400 }
      )
    }

    const body = await req.json()

    const currentQuote = await prisma.quote.findUnique({
      where: { id },
      select: {
        status: true,
        jobId: true,
        priceExVat: true,
        depositPercent: true,
      },
    })

    if (!currentQuote) {
      return NextResponse.json(
        { ok: false, error: 'Quote not found.' },
        { status: 404 }
      )
    }

    const amendmentMode = body.amendmentMode === true
    const protectedAcceptedQuote = currentQuote.status === 'accepted' || Boolean(currentQuote.jobId)
    const commercialFields = [
      'customerName',
      'customerPhone',
      'customerEmail',
      'customerAddress',
      'customerPostcode',
      'scope',
      'customerMessage',
      'internalNotes',
      'quoteWorking',
      'priceExVat',
      'depositPercent',
      'estimatedDays',
      'estimatedTeamSize',
    ]
    const isCommercialEdit = commercialFields.some((field) => field in body)

    if (protectedAcceptedQuote && isCommercialEdit && !amendmentMode) {
      return NextResponse.json(
        {
          ok: false,
          error: 'This accepted quote is locked. Reopen it for amendment before changing the commercial baseline.',
        },
        { status: 409 }
      )
    }

    const data: Record<string, unknown> = {}

    if ('customerName' in body) data.customerName = cleanString(body.customerName) || null
    if ('customerPhone' in body) data.customerPhone = cleanString(body.customerPhone) || null
    if ('customerEmail' in body) data.customerEmail = cleanString(body.customerEmail) || null
    if ('customerAddress' in body) data.customerAddress = cleanString(body.customerAddress) || null
    if ('customerPostcode' in body) data.customerPostcode = cleanString(body.customerPostcode) || null
    if ('scope' in body) data.scope = cleanString(body.scope)
    if ('customerMessage' in body) data.customerMessage = cleanString(body.customerMessage) || null
    if ('internalNotes' in body) data.internalNotes = cleanString(body.internalNotes) || null
    if ('quoteWorking' in body) data.quoteWorking = cleanString(body.quoteWorking) || null

    const priceExVat =
      'priceExVat' in body
        ? cleanNumber(body.priceExVat)
        : currentQuote.priceExVat
    const depositPercent =
      'depositPercent' in body
        ? cleanNumber(body.depositPercent, 25)
        : currentQuote.depositPercent

    const vatAmount = Number(
      ((priceExVat * STANDARD_VAT_RATE) / 100).toFixed(2)
    )
    const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))
    const depositAmount = Number(
      ((totalIncVat * depositPercent) / 100).toFixed(2)
    )

    data.priceExVat = priceExVat
    data.vatRate = STANDARD_VAT_RATE
    data.vatAmount = vatAmount
    data.totalIncVat = totalIncVat
    data.depositPercent = depositPercent
    data.depositAmount = depositAmount

    if ('estimatedDays' in body) {
      data.estimatedDays = body.estimatedDays == null ? null : cleanNumber(body.estimatedDays)
    }
    if ('estimatedTeamSize' in body) {
      data.estimatedTeamSize =
        body.estimatedTeamSize == null
          ? null
          : Math.max(1, Math.round(cleanNumber(body.estimatedTeamSize, 1)))
    }

    if ('status' in body) {
      const status = cleanString(body.status)
      const allowed = [
        'in_progress',
        'needs_review',
        'ready_to_send',
        'sent',
        'accepted',
        'declined',
        'archived',
      ]

      if (!allowed.includes(status)) {
        return NextResponse.json(
          { ok: false, error: 'Invalid quote status.' },
          { status: 400 }
        )
      }

      if (protectedAcceptedQuote && status !== 'accepted' && !amendmentMode) {
        return NextResponse.json(
          {
            ok: false,
            error: 'This accepted quote is locked. Reopen it for amendment before changing its status.',
          },
          { status: 409 }
        )
      }

      data.status = status
      data.sentAt = status === 'sent' ? new Date() : undefined
      data.acceptedAt = status === 'accepted' ? new Date() : undefined
      data.declinedAt = status === 'declined' ? new Date() : undefined
      data.archivedAt = status === 'archived' ? new Date() : null
    }

    const quote = await prisma.quote.update({
      where: { id },
      data,
    })

    return NextResponse.json({ ok: true, quote })
  } catch (error) {
    console.error('UPDATE QUOTE ERROR', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to update quote.' },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid quote id.' }, { status: 400 })
    }

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: { id: true, status: true, jobId: true },
    })

    if (!quote) {
      return NextResponse.json({ ok: false, error: 'Quote not found.' }, { status: 404 })
    }

    if (quote.jobId || quote.status === 'accepted') {
      return NextResponse.json(
        { ok: false, error: 'Accepted quotes or quotes already linked to a job cannot be deleted.' },
        { status: 409 }
      )
    }

    await prisma.quote.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE QUOTE ERROR', error)
    return NextResponse.json({ ok: false, error: 'Failed to delete quote.' }, { status: 500 })
  }
}
