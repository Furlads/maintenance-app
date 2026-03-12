export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Ctx = {
  params: Promise<{ id: string }>
}

type HistoryItem =
  | {
      id: string
      type: 'job'
      createdAt: string
      title: string
      jobId: number
      jobTitle: string
      status: string
      notes: string | null
    }
  | {
      id: string
      type: 'note'
      createdAt: string
      title: string
      jobId: number
      jobTitle: string
      note: string
      createdByWorkerName: string | null
    }
  | {
      id: string
      type: 'photo'
      createdAt: string
      title: string
      jobId: number
      jobTitle: string
      imageUrl: string
      label: string | null
      uploadedByWorkerName: string | null
    }

function workerFullName(worker?: { firstName?: string | null; lastName?: string | null } | null) {
  if (!worker) return null

  const first = typeof worker.firstName === 'string' ? worker.firstName.trim() : ''
  const last = typeof worker.lastName === 'string' ? worker.lastName.trim() : ''
  const full = `${first} ${last}`.trim()

  return full || null
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const customerId = Number(id)

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json({ error: 'Invalid customer id' }, { status: 400 })
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const jobs = await prisma.job.findMany({
      where: { customerId },
      include: {
        jobNotes: {
          include: {
            worker: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        photos: {
          include: {
            uploadedByWorker: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: [
        { visitDate: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    const history: HistoryItem[] = []

    for (const job of jobs) {
      history.push({
        id: `job-${job.id}`,
        type: 'job',
        createdAt: (job.visitDate ?? job.createdAt).toISOString(),
        title: job.finishedAt
          ? 'Job completed'
          : String(job.status || '').toLowerCase() === 'done'
            ? 'Job completed'
            : 'Job visit',
        jobId: job.id,
        jobTitle: job.title,
        status: job.status,
        notes: job.notes
      })

      for (const note of job.jobNotes) {
        history.push({
          id: `note-${note.id}`,
          type: 'note',
          createdAt: note.createdAt.toISOString(),
          title: 'Note added',
          jobId: job.id,
          jobTitle: job.title,
          note: note.note,
          createdByWorkerName: workerFullName(note.worker)
        })
      }

      for (const photo of job.photos) {
        history.push({
          id: `photo-${photo.id}`,
          type: 'photo',
          createdAt: photo.createdAt.toISOString(),
          title: 'Photo uploaded',
          jobId: job.id,
          jobTitle: job.title,
          imageUrl: photo.imageUrl,
          label: photo.label,
          uploadedByWorkerName: workerFullName(photo.uploadedByWorker)
        })
      }
    }

    history.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name
      },
      history
    })
  } catch (error) {
    console.error('GET /api/customers/[id]/history failed:', error)

    return NextResponse.json(
      { error: 'Failed to load customer history' },
      { status: 500 }
    )
  }
}