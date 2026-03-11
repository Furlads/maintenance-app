import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        assignments: {
          include: {
            worker: true
          }
        }
      }
    })

    return NextResponse.json(jobs)
  } catch (error) {
    console.error('GET /api/jobs error:', error)

    return NextResponse.json(
      { error: 'Failed to load jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const customerId = Number(body.customerId)
    const assignedTo = Array.isArray(body.assignedTo)
      ? body.assignedTo.map((id: unknown) => Number(id)).filter(Boolean)
      : []

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer is required' },
        { status: 400 }
      )
    }

    if (!body.title || !String(body.title).trim()) {
      return NextResponse.json(
        { error: 'Job title is required' },
        { status: 400 }
      )
    }

    if (!body.address || !String(body.address).trim()) {
      return NextResponse.json(
        { error: 'Job address is required' },
        { status: 400 }
      )
    }

    const job = await prisma.job.create({
      data: {
        customerId,
        title: String(body.title).trim(),
        address: String(body.address).trim(),
        notes: body.notes ? String(body.notes).trim() : null,
        status: body.status ? String(body.status).trim() : 'Scheduled',
        jobType: body.jobType ? String(body.jobType).trim() : 'Quote',
        assignments: {
          create: assignedTo.map((workerId: number) => ({
            workerId
          }))
        }
      },
      include: {
        customer: true,
        assignments: {
          include: {
            worker: true
          }
        }
      }
    })

    return NextResponse.json(job)
  } catch (error) {
    console.error('POST /api/jobs error:', error)

    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}