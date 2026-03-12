export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function cleanString(value: unknown) {
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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)

    const company = cleanString(url.searchParams.get('company')) || 'furlads'
    const worker = cleanString(url.searchParams.get('worker'))
    const jobIdRaw = cleanString(url.searchParams.get('jobId'))
    const limitRaw = cleanString(url.searchParams.get('limit'))

    const jobId = jobIdRaw ? Number(jobIdRaw) : null
    const limit = limitRaw ? Number(limitRaw) : 50

    if (!worker) {
      return NextResponse.json({ error: 'Missing worker.' }, { status: 400 })
    }

    const items = await prisma.chasMessage.findMany({
      where: {
        company,
        worker,
        ...(Number.isInteger(jobId) && jobId ? { jobId } : {}),
        createdAt: {
          gte: startOfToday(),
          lte: endOfToday()
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take:
        Number.isFinite(limit) && limit > 0
          ? Math.min(Math.round(limit), 200)
          : 50
    })

    return NextResponse.json({
      ok: true,
      items
    })
  } catch (error) {
    console.error('GET /api/chas/thread failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to load CHAS thread.'
      },
      { status: 500 }
    )
  }
}