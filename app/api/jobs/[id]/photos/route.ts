export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function parseJobId(value: string) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = parseJobId(params.id)

    if (!jobId) {
      return NextResponse.json(
        { error: 'Invalid job id' },
        { status: 400 }
      )
    }

    const photos = await prisma.jobPhoto.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(photos)
  } catch (error) {
    console.error('GET /api/jobs/[id]/photos failed:', error)

    return NextResponse.json(
      { error: 'Failed to load photos' },
      { status: 500 }
    )
  }
}