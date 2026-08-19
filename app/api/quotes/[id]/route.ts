import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

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
    if ('priceExVat' in body) data.priceExVat = cleanNumber(body.priceExVat)
    if ('vatRate' in body) data.vatRate = cleanNumber(body.vatRate, 20)
    if ('vatAmount' in body) data.vatAmount = cleanNumber(body.vatAmount)
    if ('totalIncVat' in body) data.totalIncVat = cleanNumber(body.totalIncVat)
    if ('depositPercent' in body) data.depositPercent = cleanNumber(body.depositPercent, 25)
    if ('depositAmount' in body) data.depositAmount = cleanNumber(body.depositAmount)
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
