import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const conversationId = text(body.conversationId)
    const customerName = text(body.customerName)
    const customerPostcode = text(body.customerPostcode)
    const scope =
      text(body.scope) ||
      (customerName ? `Quote in progress for ${customerName}` : 'Quote in progress')

    if (!conversationId || !customerName) {
      return NextResponse.json(
        { ok: false, error: 'Draft key and customer are required.' },
        { status: 400 }
      )
    }

    let customer = null
    const customerId = Number(body.customerId)

    if (Number.isInteger(customerId) && customerId > 0) {
      customer = await prisma.customer.findUnique({ where: { id: customerId } })
    }

    if (!customer && customerPostcode) {
      customer = await prisma.customer.findFirst({
        where: {
          archived: false,
          name: customerName,
          postcode: customerPostcode,
        },
        orderBy: { createdAt: 'desc' },
      })
    }

    // Quote.conversationId is a real foreign key to Conversation.id.
    // CHAS draft IDs are generated in the browser, so make sure the parent
    // Conversation exists before creating/updating the draft quote.
    await prisma.conversation.upsert({
      where: { id: conversationId },
      update: {
        contactName: customerName,
        contactRef: customerPostcode || customer?.postcode || null,
        archived: false,
      },
      create: {
        id: conversationId,
        source: 'chas_quote_draft',
        contactName: customerName,
        contactRef: customerPostcode || customer?.postcode || null,
        archived: false,
      },
    })

    const existing = await prisma.quote.findFirst({
      where: {
        conversationId,
        status: 'in_progress',
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    })

    const data = {
      customerId: customer?.id ?? null,
      conversationId,
      customerName: customerName || customer?.name || null,
      customerPhone: text(body.customerPhone) || customer?.phone || null,
      customerEmail: text(body.customerEmail) || customer?.email || null,
      customerAddress: text(body.customerAddress) || customer?.address || null,
      customerPostcode: customerPostcode || customer?.postcode || null,
      scope,
      quoteWorking: text(body.quoteWorking) || null,
      status: 'in_progress',
      archivedAt: null,
    }

    const quote = existing
      ? await prisma.quote.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.quote.create({
          data: {
            ...data,
            priceExVat: 0,
            vatRate: 20,
            vatAmount: 0,
            totalIncVat: 0,
            depositPercent: 25,
            depositAmount: 0,
          },
        })

    return NextResponse.json({ ok: true, quote })
  } catch (error) {
    console.error('QUOTE AUTOSAVE ERROR', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'Could not autosave quote.',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
