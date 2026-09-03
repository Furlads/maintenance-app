import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { splitCustomerAddress } from '@/lib/customerAddress'

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

    const suppliedAddress = splitCustomerAddress(body.customerAddress, body.customerPostcode)

    let customer = null
    const requestedCustomerId = Number(body.customerId)

    if (Number.isInteger(requestedCustomerId) && requestedCustomerId > 0) {
      customer = await prisma.customer.findUnique({
        where: { id: requestedCustomerId },
      })
    }

    if (!customer) {
      const requestedName = cleanString(body.customerName)
      const requestedPostcode = suppliedAddress.postcode

      if (requestedName && requestedPostcode) {
        customer = await prisma.customer.findFirst({
          where: {
            archived: false,
            name: requestedName,
            postcode: requestedPostcode,
          },
          orderBy: { createdAt: 'desc' },
        })
      }
    }

    const customerAddress = suppliedAddress.address || customer?.address || ''
    const customerPostcode = suppliedAddress.postcode || customer?.postcode || ''

    if (customer) {
      const customerData: Record<string, unknown> = {}
      if (cleanString(body.customerName)) customerData.name = cleanString(body.customerName)
      if (cleanString(body.customerPhone)) customerData.phone = cleanString(body.customerPhone)
      if (cleanString(body.customerEmail)) customerData.email = cleanString(body.customerEmail)
      if ('customerAddress' in body || 'customerPostcode' in body) {
        customerData.address = customerAddress || null
        customerData.postcode = customerPostcode || null
      }

      if (Object.keys(customerData).length) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: customerData,
        })
      }
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
        customerId: customer?.id ?? null,
        jobId: typeof body.jobId === 'number' ? body.jobId : null,
        conversationId: cleanString(body.conversationId) || null,
        customerName: cleanString(body.customerName) || customer?.name || null,
        customerPhone: cleanString(body.customerPhone) || customer?.phone || null,
        customerEmail: cleanString(body.customerEmail) || customer?.email || null,
        customerAddress: customerAddress || null,
        customerPostcode: customerPostcode || null,
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
