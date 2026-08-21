import type { ReactNode } from 'react'
import prisma from '@/lib/prisma'
import MaintenanceTodayBridge from './MaintenanceTodayBridge'
import TodayDashboardHome from './TodayDashboardHome'
import JacobBrandPolish from './JacobBrandPolish'
import FurladsBrandPolish from './FurladsBrandPolish'

export const dynamic = 'force-dynamic'

type Props = {
  children: ReactNode
}

export default async function TodayLayout({ children }: Props) {
  const maintenanceJobs = await prisma.job.findMany({
    where: {
      jobType: { equals: 'Maintenance', mode: 'insensitive' },
      status: { notIn: ['archived', 'cancelled'] },
    },
    select: { id: true },
  })

  return (
    <>
      <MaintenanceTodayBridge maintenanceJobIds={maintenanceJobs.map((job) => job.id)} />
      <TodayDashboardHome />
      <JacobBrandPolish />
      <FurladsBrandPolish />
      {children}
    </>
  )
}
