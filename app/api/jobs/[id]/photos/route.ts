export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import prisma from '@/lib/prisma'

function parseJobId(value: string) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

function parseWorkerId(value: FormDataEntryValue | null) {
  if (value === null || value === '') return null

  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null

  return id
}

function parseLabel(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function cleanFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '-')
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

export async function POST(
  request: Request,
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

    const formData = await request.formData()

    const fileEntry = formData.get('file')
    const workerId = parseWorkerId(formData.get('workerId'))
    const label = parseLabel(formData.get('label'))

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: 'Photo file is required' },
        { status: 400 }
      )
    }

    if (!fileEntry.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image uploads are allowed' },
        { status: 400 }
      )
    }

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true }
    })

    if (!existingJob) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    const fileName = cleanFileName(fileEntry.name || 'photo.jpg')
    const pathname = `jobs/${jobId}/${Date.now()}-${fileName}`

    const blob = await put(pathname, fileEntry, {
      access: 'public'
    })

    const photo = await prisma.jobPhoto.create({
      data: {
        jobId,
        uploadedByWorkerId: workerId,
        label,
        imageUrl: blob.url
      }
    })

    return NextResponse.json(photo, { status: 201 })
  } catch (error) {
    console.error('POST /api/jobs/[id]/photos failed:', error)

    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    )
  }
}