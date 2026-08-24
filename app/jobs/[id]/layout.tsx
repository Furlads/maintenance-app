import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type LayoutProps = {
  children: ReactNode
  params: {
    id: string
  }
}

function isTrevName(value: string | null | undefined) {
  const name = String(value || '').trim().toLowerCase()

  return (
    name === 'trev' ||
    name === 'trevor' ||
    name.startsWith('trev ') ||
    name.startsWith('trevor ')
  )
}

function isAdminLikeRole(value: string | null | undefined) {
  const role = String(value || '').trim().toLowerCase()
  return ['admin', 'office', 'manager', 'owner'].includes(role)
}

function isJacobName(firstName: string | null | undefined, lastName: string | null | undefined) {
  const fullName = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`
    .trim()
    .toLowerCase()

  return fullName === 'jacob walters' || fullName === 'jacob'
}

export default async function JobDetailLayout({ children, params }: LayoutProps) {
  const session = await getSession()
  const workerId = Number(session?.workerId)
  const jobId = Number(params.id)

  if (!Number.isInteger(jobId) || jobId <= 0) {
    return children
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      jobType: true,
      status: true,
      assignments: {
        select: {
          workerId: true,
          worker: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  })

  if (!job || ['archived', 'cancelled'].includes(String(job.status || '').toLowerCase())) {
    return children
  }

  if (
    session &&
    Number.isInteger(workerId) &&
    workerId > 0 &&
    isTrevName(session.workerName)
  ) {
    const isTrevAssigned = job.assignments.some(
      (assignment) => assignment.workerId === workerId
    )
    const isQuoteVisit =
      String(job.jobType || '').toLowerCase() === 'quote' ||
      String(job.title || '').trim().toLowerCase() === 'quote'

    if (isTrevAssigned && isQuoteVisit) {
      redirect(`/trev/quote/${job.id}`)
    }
  }

  if (String(job.jobType || '').toLowerCase().includes('land')) {
    if (isAdminLikeRole(session?.role)) {
      redirect(`/admin/landscaping/jobs/${job.id}`)
    }

    redirect(`/landscaping/jobs/${job.id}`)
  }

  const isMaintenanceJob =
    String(job.jobType || '').trim().toLowerCase() === 'maintenance' ||
    job.assignments.some((assignment) =>
      isJacobName(assignment.worker?.firstName, assignment.worker?.lastName)
    )

  if (isMaintenanceJob) {
    redirect(`/maintenance/jobs/${job.id}`)
  }

  return children
}
