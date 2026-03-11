import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const jobs = await prisma.job.findMany()

    return NextResponse.json(jobs)
  } catch (error) {
    console.error('GET /api/jobs error:', error)

    return NextResponse.json(
      { error: 'Failed to load jobs' },
      { status: 500 }
    )
  }
}