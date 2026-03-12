import prisma from '@/lib/prisma'

function cleanLine(label: string, value: unknown) {
  const text =
    typeof value === 'string'
      ? value.trim()
      : value == null
        ? ''
        : String(value)

  return text ? `${label}: ${text}` : ''
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toISOString().split('T')[0]
}

export async function buildChasPropertyContext(jobId: number | null | undefined) {
  if (!jobId || !Number.isInteger(jobId)) {
    return {
      currentJobText: 'No specific job selected.',
      relatedHistoryText: 'No property history available because no current job was supplied.'
    }
  }

  const currentJob = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true
    }
  })

  if (!currentJob) {
    return {
      currentJobText: 'Selected job was not found.',
      relatedHistoryText: 'No property history available because the selected job was not found.'
    }
  }

  const currentJobTextLines = [
    cleanLine('Job ID', currentJob.id),
    cleanLine('Title', (currentJob as { title?: string | null }).title),
    cleanLine('Status', (currentJob as { status?: string | null }).status),
    cleanLine('Job type', (currentJob as { jobType?: string | null }).jobType),
    cleanLine('Address', (currentJob as { address?: string | null }).address),
    cleanLine('Customer', currentJob.customer?.name),
    cleanLine('Customer phone', currentJob.customer?.phone),
    cleanLine('Customer postcode', currentJob.customer?.postcode),
    cleanLine('Job notes', (currentJob as { notes?: string | null }).notes)
  ].filter(Boolean)

  const currentJobAddress = (currentJob as { address?: string | null }).address?.trim() || ''
  const currentCustomerId =
    typeof (currentJob as { customerId?: number | null }).customerId === 'number'
      ? (currentJob as { customerId?: number | null }).customerId
      : null
  const currentPostcode = currentJob.customer?.postcode?.trim() || ''

  const orFilters: Array<Record<string, unknown>> = []

  if (currentJobAddress) {
    orFilters.push({ address: currentJobAddress })
  }

  if (currentCustomerId) {
    orFilters.push({ customerId: currentCustomerId })
  }

  if (currentPostcode) {
    orFilters.push({
      customer: {
        postcode: currentPostcode
      }
    })
  }

  if (!orFilters.length) {
    return {
      currentJobText: currentJobTextLines.join('\n') || 'No current job details found.',
      relatedHistoryText:
        'No related job history found because there is not enough property/customer information.'
    }
  }

  const relatedJobs = await prisma.job.findMany({
    where: {
      id: { not: currentJob.id },
      OR: orFilters
    },
    include: {
      customer: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 8
  })

  if (!relatedJobs.length) {
    return {
      currentJobText: currentJobTextLines.join('\n') || 'No current job details found.',
      relatedHistoryText: 'No recent related jobs or quotes were found for this customer/property.'
    }
  }

  const relatedHistoryText = relatedJobs
    .map((job, index) => {
      const lines = [
        `Related item ${index + 1}`,
        cleanLine('Date', formatDate((job as { createdAt?: Date | string | null }).createdAt)),
        cleanLine('Job ID', job.id),
        cleanLine('Title', (job as { title?: string | null }).title),
        cleanLine('Job type', (job as { jobType?: string | null }).jobType),
        cleanLine('Status', (job as { status?: string | null }).status),
        cleanLine('Address', (job as { address?: string | null }).address),
        cleanLine('Customer', job.customer?.name),
        cleanLine('Notes', (job as { notes?: string | null }).notes)
      ].filter(Boolean)

      return lines.join('\n')
    })
    .join('\n\n')

  return {
    currentJobText: currentJobTextLines.join('\n') || 'No current job details found.',
    relatedHistoryText
  }
}