import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET() {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        job: true,
      },
    })

    return NextResponse.json({ ok: true, quotes })
  } catch (error) {
    console.error('GET QUOTES ERROR', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to load quotes.' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const scope = cleanString(body.scope)
    if (!scope) {
      return NextResponse.json(
        { ok: false, error: 'Quote scope is required.' },
        { status: 400 }
      )
    }

    const priceExVat = cleanNumber(body.priceExVat)
    const vatRate = cleanNumber(body.vatRate, 20)
    const vatAmount = cleanNumber(
      body.vatAmount,
      Number(((priceExVat * vatRate) / 100).toFixed(2))
    )
    const totalIncVat = cleanNumber(
      body.totalIncVat,
      Number((priceExVat + vatAmount).toFixed(2))
    )
    const depositPercent = cleanNumber(body.depositPercent, 25)
    const depositAmount = cleanNumber(
      body.depositAmount,
      Number(((totalIncVat * depositPercent) / 100).toFixed(2))
    )

    const quote = await prisma.quote.create({
      data: {
        customerId:
          typeof body.customerId === 'number' ? body.customerId : null,
        jobId: typeof body.jobId === 'number' ? body.jobId : null,
        conversationId: cleanString(body.conversationId) || null,
        customerName: cleanString(body.customerName) || null,
        customerPhone: cleanString(body.customerPhone) || null,
        customerEmail: cleanString(body.customerEmail) || null,
        customerAddress: cleanString(body.customerAddress) || null,
        customerPostcode: cleanString(body.customerPostcode) || null,
        scope,
        customerMessage: cleanString(body.customerMessage) || null,
        internalNotes: cleanString(body.internalNotes) || null,
        quoteWorking: cleanString(body.quoteWorking) || null,
        priceExVat,
        vatRate,
        vatAmount,
        totalIncVat,
        depositPercent,
        depositAmount,
        estimatedDays:
          body.estimatedDays == null ? null : cleanNumber(body.estimatedDays),
        estimatedTeamSize:
          body.estimatedTeamSize == null
            ? null
            : Math.max(1, Math.round(cleanNumber(body.estimatedTeamSize, 1))),
        status: cleanString(body.status) || 'needs_review',
      },
    })

    return NextResponse.json({ ok: true, quote })
  } catch (error) {
    console.error('CREATE QUOTE ERROR', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to create quote.' },
      { status: 500 }
    )
  }
}
