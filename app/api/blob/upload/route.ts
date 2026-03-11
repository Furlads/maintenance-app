export const runtime = 'nodejs'

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type UploadPayload = {
  jobId: number
  workerId: number | null
  label: string | null
}

function safeParsePayload(value: string | null | undefined): UploadPayload | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value)

    const jobId =
      typeof parsed?.jobId === 'number'
        ? parsed.jobId
        : Number(parsed?.jobId)

    const workerId =
      parsed?.workerId === null || parsed?.workerId === undefined || parsed?.workerId === ''
        ? null
        : typeof parsed.workerId === 'number'
          ? parsed.workerId
          : Number(parsed.workerId)

    const label =
      typeof parsed?.label === 'string' && parsed.label.trim()
        ? parsed.label.trim()
        : null

    if (!Number.isInteger(jobId) || jobId <= 0) {
      return null
    }

    if (workerId !== null && (!Number.isInteger(workerId) || workerId <= 0)) {
      return null
    }

    return {
      jobId,
      workerId,
      label
    }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = safeParsePayload(clientPayload)

        if (!payload) {
          throw new Error('Invalid upload payload')
        }

        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload)
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = safeParsePayload(tokenPayload)

        if (!payload) {
          throw new Error('Invalid token payload')
        }

        await prisma.jobPhoto.create({
          data: {
            jobId: payload.jobId,
            uploadedByWorkerId: payload.workerId,
            label: payload.label,
            imageUrl: blob.url
          }
        })
      }
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('POST /api/blob/upload failed:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed'
      },
      { status: 400 }
    )
  }
}