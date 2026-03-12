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

    const items = messages.flatMap((message) => {
      const userItem = {
        id: `user-${message.id}`,
        role: 'user' as const,
        text: message.question,
        createdAt: message.createdAt,
        imageDataUrl: message.imageDataUrl || '',
        jobId: message.jobId ?? null
      }

      const assistantItem = {
        id: `assistant-${message.id}`,
        role: 'assistant' as const,
        text: message.answer,
        createdAt: message.createdAt,
        jobId: message.jobId ?? null
      }

      return [userItem, assistantItem]
    })

    return NextResponse.json({
      ok: true,
      items
    })
  } catch (error: any) {
    console.error('GET /api/chas/thread failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to load Chas thread.',
        detail: String(error?.message || error)
      },
      { status: 500 }
    )
  }
}