import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const message = await prisma.inboxMessage.create({
      data: {
        source: 'threecounties-email',
        senderName: 'Test Customer',
        senderEmail: 'test@example.com',
        subject: 'Inbox Test',
        preview: 'Inbox system working correctly',
        body: 'This is a test message created from the API route.',
        status: 'unread',
      },
    })

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    console.error('POST /api/inbox/test error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create inbox message',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}