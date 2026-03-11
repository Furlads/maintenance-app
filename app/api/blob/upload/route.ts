import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody

    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {}

        const jobId = Number(payload.jobId)
        const workerId = payload.workerId ? Number(payload.workerId) : null
        const label = payload.label ? String(payload.label) : null

        if (!jobId) {
          throw new Error('jobId is required')
        }

        const job = await prisma.job.findUnique({
          where: { id: jobId },
          select: { id: true }
        })

        if (!job) {
          throw new Error('Job not found')
        }

        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            jobId,
            workerId,
            label
          })
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload =
          typeof tokenPayload === 'string'
            ? JSON.parse(tokenPayload)
            : tokenPayload

        const jobId = Number(payload.jobId)
        const workerId = payload.workerId ? Number(payload.workerId) : null
        const label = payload.label ? String(payload.label) : null

        await prisma.jobPhoto.create({
          data: {
            jobId,
            uploadedByWorkerId: workerId,
            label,
            imageUrl: blob.url
          }
        })
      }
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('POST /api/blob/upload error:', error)

    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    )
  }
}