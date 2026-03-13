const assignedToRaw = (body as any).assignedTo

const cleanedWorkerIds: number[] = Array.isArray(assignedToRaw)
  ? assignedToRaw
      .map((value): number | null => {
        if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
          return value
        }

        if (typeof value === 'string') {
          const parsed = Number(value.trim())
          if (Number.isInteger(parsed) && parsed > 0) {
            return parsed
          }
        }

        return null
      })
      .filter((value): value is number => value !== null)
  : []

const uniqueWorkerIds: number[] = [...new Set(cleanedWorkerIds)]

if ((body as any).assignedTo !== undefined) {
  const existingWorkers = uniqueWorkerIds.length
    ? await prisma.worker.findMany({
        where: {
          id: {
            in: uniqueWorkerIds,
          },
        },
        select: { id: true },
      })
    : []

  const existingWorkerIds = new Set(existingWorkers.map((worker) => worker.id))

  const missingWorkerIds = uniqueWorkerIds.filter(
    (workerId) => !existingWorkerIds.has(workerId)
  )

  if (missingWorkerIds.length > 0) {
    return NextResponse.json(
      {
        error: 'Some assigned workers do not exist',
        missingWorkerIds,
      },
      { status: 400 }
    )
  }

  await prisma.jobAssignment.deleteMany({
    where: { jobId },
  })

  if (uniqueWorkerIds.length > 0) {
    await prisma.jobAssignment.createMany({
      data: uniqueWorkerIds.map((workerId) => ({
        jobId,
        workerId,
      })),
      skipDuplicates: true,
    })
  }
}