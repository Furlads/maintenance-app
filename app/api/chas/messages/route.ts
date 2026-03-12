export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const company = clean(searchParams.get('company')) || 'furlads'
    const worker = clean(searchParams.get('worker'))

    if (!worker) {
      return NextResponse.json(
        { error: 'Missing worker.' },
        { status: 400 }
      )
    }

    const messages = await prisma.chasMessage.findMany({
      where: {
        company,
        worker,
        createdAt: {
          gte: startOfToday(),
          lte: endOfToday()
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    const items = messages.map((message) => ({
      id: message.id,
      question: message.question,
      answer: message.answer,
      imageDataUrl: message.imageDataUrl || '',
      jobId: message.jobId ?? null,
      createdAt: message.createdAt,

      intent: message.intent || '',
      confidence: message.confidence ?? null,
      escalateTo: message.escalateTo || '',
      safetyFlag: message.safetyFlag,

      customerName: message.customerName || '',
      customerPhone: message.customerPhone || '',
      customerEmail: message.customerEmail || '',
      customerAddress: message.customerAddress || '',
      customerPostcode: message.customerPostcode || '',

      workSummary: message.workSummary || '',
      estimatedHours: message.estimatedHours ?? null,
      roughPriceText: message.roughPriceText || '',
      enquirySummary: message.enquirySummary || '',
      enquiryReadyForKelly: message.enquiryReadyForKelly
    }))

    return NextResponse.json({
      ok: true,
      items
    })
  } catch (error: any) {
    console.error('GET /api/chas/messages failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to load Chas messages.',
        detail: String(error?.message || error)
      },
      { status: 500 }
    )
  }
}