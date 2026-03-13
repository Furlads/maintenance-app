import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function runSync() {
  const enquiries = await prisma.chasMessage.findMany({
    where: {
      enquiryReadyForKelly: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 100,
  })

  let created = 0

  for (const enquiry of enquiries) {
    const previewText =
      enquiry.enquirySummary?.trim() ||
      enquiry.workSummary?.trim() ||
      'Worker quote request'

    const bodyText = [
      enquiry.workSummary ? `Work summary: ${enquiry.workSummary}` : null,
      enquiry.customerName ? `Customer: ${enquiry.customerName}` : null,
      enquiry.customerPhone ? `Phone: ${enquiry.customerPhone}` : null,
      enquiry.customerEmail ? `Email: ${enquiry.customerEmail}` : null,
      enquiry.customerAddress ? `Address: ${enquiry.customerAddress}` : null,
      enquiry.customerPostcode ? `Postcode: ${enquiry.customerPostcode}` : null,
      enquiry.roughPriceText ? `Rough price: ${enquiry.roughPriceText}` : null,
      enquiry.estimatedHours != null
        ? `Estimated hours: ${String(enquiry.estimatedHours)}`
        : null,
      enquiry.question ? `Question: ${enquiry.question}` : null,
      enquiry.answer ? `Answer: ${enquiry.answer}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const existing = await prisma.inboxMessage.findFirst({
      where: {
        source: 'worker-quote',
        body: bodyText,
        createdAt: {
          gte: enquiry.createdAt,
          lte: enquiry.createdAt,
        },
      },
    })

    if (!existing) {
      await prisma.inboxMessage.create({
        data: {
          source: 'worker-quote',
          senderName: enquiry.worker || 'Worker',
          senderEmail: null,
          subject: enquiry.customerName || 'Worker Quote Request',
          preview: previewText,
          body: bodyText,
          status: 'unread',
          assignedTo: 'Kelly',
          createdAt: enquiry.createdAt,
        },
      })

      created++
    }
  }

  return {
    success: true,
    enquiriesFound: enquiries.length,
    created,
  }
}

export async function GET() {
  try {
    const result = await runSync()

    return NextResponse.json(result)
  } catch (error) {
    console.error('SYNC WORKER QUOTES GET ERROR:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown sync error',
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    const result = await runSync()

    return NextResponse.json(result)
  } catch (error) {
    console.error('SYNC WORKER QUOTES POST ERROR:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown sync error',
      },
      { status: 500 }
    )
  }
}