export async function handleTimeOffClashes({
  workerId,
  blockWindow,
  requestType,
  requestedByName
}: {
  workerId: number
  blockWindow: { start: Date; end: Date }
  requestType: string
  requestedByName: string
}) {
  const workerJobs = await listWorkerJobs(workerId)

  const conflictingJobs = workerJobs.filter((job) => {
    const jobWindow = getJobWindow(job)
    if (!jobWindow) return false

    return intervalsOverlap(
      blockWindow.start,
      blockWindow.end,
      jobWindow.start,
      jobWindow.end
    )
  })

  const results = []

  for (const job of conflictingJobs) {
    const jobWindow = getJobWindow(job)
    if (!jobWindow) continue

    const customer = await prisma.customer.findUnique({
      where: { id: job.customerId },
      select: { name: true }
    })

    const customerName = customer?.name || `Job #${job.id}`

    // --- SAME LOGIC AS BEFORE ---
    // (quote move, reassignment, or Kelly alert)

    // ⛔ Keep your existing logic here exactly as-is
  }

  return {
    conflictsFound: conflictingJobs.length,
    results
  }
}