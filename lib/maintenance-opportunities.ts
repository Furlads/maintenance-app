import prisma from '@/lib/prisma'
import {
  getMaintenanceControls,
  saveMaintenanceControls,
  type MaintenanceExtraWork,
  type MaintenanceOpportunitySource,
} from '@/lib/maintenance-controls'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function createMaintenanceOpportunity(
  jobId: number,
  input: {
    description: string
    source: MaintenanceOpportunitySource
    reportedBy: string
    photoUrl?: string
  },
  workerId?: number | null
) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { customer: true },
  })

  if (!job || String(job.jobType || '').trim().toLowerCase() !== 'maintenance') {
    throw new Error('Maintenance job not found.')
  }

  const description = cleanText(input.description)
  if (!description) throw new Error('Describe the extra work first.')

  const controls = await getMaintenanceControls(jobId)
  const opportunity: MaintenanceExtraWork = {
    id: `maintenance-opportunity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description,
    source: input.source === 'customer_requested' ? 'customer_requested' : 'worker_spotted',
    status: 'open',
    reportedBy: cleanText(input.reportedBy) || 'Worker',
    reportedAt: new Date().toISOString(),
    quoteId: null,
    photoUrl: cleanText(input.photoUrl),
  }

  let nextControls = await saveMaintenanceControls(
    jobId,
    { extraWork: [...controls.extraWork, opportunity] },
    workerId
  )

  let quoteId: number | null = null

  if (opportunity.source === 'customer_requested') {
    const quote = await prisma.quote.create({
      data: {
        customerId: job.customerId,
        customerName: job.customer.name,
        customerPhone: job.customer.phone,
        customerEmail: job.customer.email,
        customerAddress: job.address || job.customer.address,
        customerPostcode: job.customer.postcode,
        scope: description,
        customerMessage: `Customer requested this during maintenance visit #${job.id}: ${description}`,
        internalNotes: `MAINTENANCE QUOTE OPPORTUNITY\nCustomer asked for this during maintenance visit #${job.id}.\nReported by: ${opportunity.reportedBy}.\nPrice has NOT been agreed. Trev/Kelly to review before anything is promised or sent.`,
        priceExVat: 0,
        vatRate: 20,
        vatAmount: 0,
        totalIncVat: 0,
        depositPercent: 25,
        depositAmount: 0,
        status: 'needs_review',
      },
    })

    quoteId = quote.id
    const updated = nextControls.extraWork.map((item) =>
      item.id === opportunity.id
        ? { ...item, status: 'quote_created' as const, quoteId: quote.id }
        : item
    )

    nextControls = await saveMaintenanceControls(jobId, { extraWork: updated }, workerId)
  }

  const subject = opportunity.source === 'customer_requested'
    ? `${job.customer.name} — customer requested a quote`
    : `${job.customer.name} — maintenance opportunity spotted`

  const body = [
    `Maintenance job: #${job.id}`,
    `Customer: ${job.customer.name}`,
    job.customer.phone ? `Phone: ${job.customer.phone}` : null,
    job.address || job.customer.address ? `Address: ${job.address || job.customer.address}` : null,
    job.customer.postcode ? `Postcode: ${job.customer.postcode}` : null,
    `Opportunity: ${description}`,
    `Source: ${opportunity.source === 'customer_requested' ? 'Customer asked for it' : 'Worker spotted it'}`,
    `Reported by: ${opportunity.reportedBy}`,
    quoteId ? `Quote draft created: #${quoteId}` : 'Quote draft: not created yet — office to review opportunity',
    opportunity.photoUrl ? `Photo: ${opportunity.photoUrl}` : null,
  ].filter(Boolean).join('\n')

  await prisma.inboxMessage.create({
    data: {
      source: 'worker-quote',
      senderName: opportunity.reportedBy,
      subject,
      preview: description,
      body,
      status: 'unread',
      assignedTo: 'Kelly',
      customerId: job.customerId,
      jobId: job.id,
    },
  })

  return {
    controls: nextControls,
    opportunity: nextControls.extraWork.find((item) => item.id === opportunity.id) || opportunity,
    quoteId,
  }
}

export async function createQuoteFromMaintenanceOpportunity(
  jobId: number,
  opportunityId: string,
  workerId?: number | null
) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { customer: true },
  })

  if (!job || String(job.jobType || '').trim().toLowerCase() !== 'maintenance') {
    throw new Error('Maintenance job not found.')
  }

  const controls = await getMaintenanceControls(jobId)
  const item = controls.extraWork.find((opportunity) => opportunity.id === opportunityId)
  if (!item) throw new Error('Opportunity not found.')

  if (item.quoteId) {
    return { controls, quoteId: item.quoteId }
  }

  const quote = await prisma.quote.create({
    data: {
      customerId: job.customerId,
      customerName: job.customer.name,
      customerPhone: job.customer.phone,
      customerEmail: job.customer.email,
      customerAddress: job.address || job.customer.address,
      customerPostcode: job.customer.postcode,
      scope: item.description,
      customerMessage: item.source === 'customer_requested'
        ? `Customer requested this during maintenance visit #${job.id}: ${item.description}`
        : null,
      internalNotes: `MAINTENANCE OPPORTUNITY\nSource: ${item.source === 'customer_requested' ? 'Customer requested' : 'Worker spotted'} during maintenance job #${job.id}.\nReported by: ${item.reportedBy}.\nPrice has NOT been agreed. Trev/Kelly to review.`,
      priceExVat: 0,
      vatRate: 20,
      vatAmount: 0,
      totalIncVat: 0,
      depositPercent: 25,
      depositAmount: 0,
      status: 'needs_review',
    },
  })

  const updated = controls.extraWork.map((opportunity) =>
    opportunity.id === opportunityId
      ? { ...opportunity, status: 'quote_created' as const, quoteId: quote.id }
      : opportunity
  )

  const saved = await saveMaintenanceControls(jobId, { extraWork: updated }, workerId)
  return { controls: saved, quoteId: quote.id }
}

export async function setMaintenanceOpportunityStatus(
  jobId: number,
  opportunityId: string,
  status: 'open' | 'dismissed',
  workerId?: number | null
) {
  const controls = await getMaintenanceControls(jobId)
  if (!controls.extraWork.some((item) => item.id === opportunityId)) {
    throw new Error('Opportunity not found.')
  }

  const updated = controls.extraWork.map((item) =>
    item.id === opportunityId
      ? { ...item, status: status === 'dismissed' ? 'dismissed' as const : item.quoteId ? 'quote_created' as const : 'open' as const }
      : item
  )

  return saveMaintenanceControls(jobId, { extraWork: updated }, workerId)
}
