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

export default async function JobDetailLayout({ children, params }: LayoutProps) {
  const session = await getSession()
  const workerId = Number(session?.workerId)
  const jobId = Number(params.id)

  if (
    session &&
    Number.isInteger(workerId) &&
    workerId > 0 &&
    Number.isInteger(jobId) &&
    jobId > 0 &&
    isTrevName(session.workerName)
  ) {
    const trevQuoteVisit = await prisma.job.findFirst({
      where: {
        id: jobId,
        OR: [{ jobType: 'Quote' }, { title: 'Quote' }],
        status: {
          notIn: ['archived', 'cancelled'],
        },
        assignments: {
          some: {
            workerId,
          },
        },
      },
      select: {
        id: true,
      },
    })

    if (trevQuoteVisit) {
      redirect(`/quote-test?jobId=${trevQuoteVisit.id}`)
    }
  }

  return children
}
