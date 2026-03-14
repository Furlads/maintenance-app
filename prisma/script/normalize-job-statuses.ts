import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function normalizeStatus(rawStatus: string | null | undefined): string {
  const value = String(rawStatus || '').trim().toLowerCase()

  if (!value) {
    return 'unscheduled'
  }

  if (
    value === 'scheduled' ||
    value === 'schedule' ||
    value === 'todo' ||
    value === 'to do'
  ) {
    return 'todo'
  }

  if (
    value === 'in_progress' ||
    value === 'in progress' ||
    value === 'inprogress' ||
    value === 'started' ||
    value === 'active'
  ) {
    return 'in_progress'
  }

  if (value === 'paused' || value === 'on hold') {
    return 'paused'
  }

  if (
    value === 'done' ||
    value === 'completed' ||
    value === 'complete' ||
    value === 'finished'
  ) {
    return 'done'
  }

  if (value === 'quoted' || value === 'quote') {
    return 'quoted'
  }

  if (value === 'unscheduled' || value === 'unassigned') {
    return 'unscheduled'
  }

  return 'unscheduled'
}

async function main() {
  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      status: true,
      visitDate: true,
      title: true,
    },
  })

  let updatedCount = 0

  for (const job of jobs) {
    const normalized = normalizeStatus(job.status)

    if (job.status !== normalized) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: normalized },
      })

      updatedCount += 1

      console.log(
        `Updated job #${job.id} (${job.title}) from "${job.status}" to "${normalized}"`
      )
    }
  }

  const summary = await prisma.job.groupBy({
    by: ['status'],
    _count: {
      status: true,
    },
    orderBy: {
      status: 'asc',
    },
  })

  console.log('\nNormalization complete.')
  console.log(`Jobs updated: ${updatedCount}`)
  console.log('\nCurrent status counts:')

  for (const row of summary) {
    console.log(`- ${row.status}: ${row._count.status}`)
  }
}

main()
  .catch((error) => {
    console.error('Failed to normalize job statuses:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })