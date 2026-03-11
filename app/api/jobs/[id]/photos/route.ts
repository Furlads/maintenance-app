import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const jobId = Number(context.params.id)

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
    console.error('GET /api/jobs/[id]/photos error:', error)

    return NextResponse.json(
      { error: 'Failed to load job photos' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const jobId = Number(context.params.id)

    if (!jobId) {
      return NextResponse.json(
        { error: 'Invalid job id' },
        { status: 400 }
      )
    }

    const body = await request.json()

    if (!body.imageUrl || !String(body.imageUrl).trim()) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    const photo = await prisma.jobPhoto.create({
      data: {
        jobId,
        uploadedByWorkerId: body.uploadedByWorkerId
          ? Number(body.uploadedByWorkerId)
          : null,
        label: body.label ? String(body.label).trim() : null,
        imageUrl: String(body.imageUrl).trim()
      }
    })

    return NextResponse.json(photo)
  } catch (error) {
    console.error('POST /api/jobs/[id]/photos error:', error)

    return NextResponse.json(
      { error: 'Failed to save job photo' },
      { status: 500 }
    )
  }
}