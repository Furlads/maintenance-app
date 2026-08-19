import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type LayoutProps = {
  children: ReactNode
  params: {
    id: string
  }
}

export default async function AdminJobDetailLayout({ children, params }: LayoutProps) {
  const jobId = Number(params.id)

  if (Number.isInteger(jobId) && jobId > 0) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        jobType: true,
        status: true,
      },
    })

    if (
      job &&
      String(job.jobType || '').toLowerCase().includes('land') &&
      !['archived', 'cancelled'].includes(String(job.status || '').toLowerCase())
    ) {
      redirect(`/admin/landscaping/jobs/${job.id}`)
    }
  }

  return children
}
