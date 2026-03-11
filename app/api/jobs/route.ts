import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(jobs)
}

export async function POST() {
  const job = await prisma.job.create({
    data: {
      title: 'Test Garden Job',
      address: 'Market Drayton',
      notes: 'First test job',
      status: 'Scheduled',
      customerId: 1
    }
  })

  return NextResponse.json(job)
}