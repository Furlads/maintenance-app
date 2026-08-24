import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function ensureConversationForMessage(message: any) {
  if (message.conversationId) return false

  const conversation = await prisma.conversation.create({
    data: {
      source: 'worker-quote',
      contactName:
        message.subject?.trim() ||
        message.senderName?.trim() ||
        'Worker quote',
      contactRef: `worker-quote-message-${message.id}`,
    },
  })

  await prisma.inboxMessage.update({
    where: { id: message.id },
    data: { conversationId: conversation.id },
  })

  return true
}

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
  let linked = 0

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

    if (existing) {
      if (await ensureConversationForMessage(existing)) linked++
      continue
    }

    const conversation = await prisma.conversation.create({
      data: {
        source: 'worker-quote',
        contactName:
          enquiry.customerName?.trim() ||
          enquiry.worker?.trim() ||
          'Worker quote',
        contactRef: `worker-quote-enquiry-${enquiry.id}`,
      },
    })

    await prisma.inboxMessage.create({
      data: {
        conversationId: conversation.id,
        customerId: enquiry.customerId ?? null,
        jobId: enquiry.jobId ?? null,
        source: 'worker-quote',
        senderName: enquiry.worker || 'Worker',
        senderEmail: enquiry.customerEmail ?? null,
        senderPhone: enquiry.customerPhone ?? null,
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

  const orphanMessages = await prisma.inboxMessage.findMany({
    where: {
      source: 'worker-quote',
      conversationId: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 200,
  })

  for (const message of orphanMessages) {
    if (await ensureConversationForMessage(message)) linked++
  }

  return {
    success: true,
    enquiriesFound: enquiries.length,
    created,
    linked,
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
