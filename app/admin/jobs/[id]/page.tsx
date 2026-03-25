import Link from 'next/link'
import { notFound } from 'next/navigation'
import * as prismaModule from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type PageProps = {
  params: {
    id: string
  }
}

function fullName(firstName?: string | null, lastName?: string | null) {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Unknown worker'
}

function formatDate(value?: Date | string | null) {
  if (!value) return '—'

  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function formatDateTime(value?: Date | string | null) {
  if (!value) return '—'

  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function normaliseStatus(value?: string | null) {
  const raw = String(value || '').toLowerCase()

  if (raw.includes('progress')) return 'In progress'
  if (raw.includes('done') || raw.includes('finish')) return 'Done'
  if (raw.includes('sched')) return 'Scheduled'
  if (raw.includes('cancel')) return 'Cancelled'
  if (raw.includes('archive')) return 'Archived'
  if (raw.includes('pause')) return 'Paused'
  return value || 'Unscheduled'
}

function normaliseJobType(value?: string | null) {
  const raw = String(value || '').toLowerCase()

  if (raw.includes('maint')) {
    return {
      label: 'Maintenance',
      className: 'bg-green-50 text-green-700 ring-green-200',
    }
  }

  if (raw.includes('land')) {
    return {
      label: 'Landscaping',
      className: 'bg-blue-50 text-blue-700 ring-blue-200',
    }
  }

  if (raw.includes('quote')) {
    return {
      label: 'Quote',
      className: 'bg-amber-50 text-amber-700 ring-amber-200',
    }
  }

  return {
    label: value || 'Other',
    className: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  }
}

type CannotCompleteInfo = {
  reason: string
  details: string
  reportedBy: string
  recordedAt: string
}

type ParsedEndOfJobReport = {
  workSummary: string
  followUpRequired: string
  followUpDetails: string
  payment: string
  paymentNotes: string
  notesForKelly: string
  reportedBy: string
  recordedAt: string
}

function extractCannotCompleteInfoFromText(value?: string | null): CannotCompleteInfo | null {
  if (!value) return null

  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const matchingLine = [...lines]
    .reverse()
    .find((line) => line.toLowerCase().startsWith('job could not be completed:'))

  if (!matchingLine) return null

  const parts = matchingLine.split(' | ').map((part) => part.trim())

  const reasonPart =
    parts.find((part) =>
      part.toLowerCase().startsWith('job could not be completed:')
    ) || ''

  const detailsPart =
    parts.find((part) => part.toLowerCase().startsWith('details:')) || ''

  const reportedByPart =
    parts.find((part) => part.toLowerCase().startsWith('reported by:')) || ''

  const recordedAtPart =
    parts.find((part) => part.toLowerCase().startsWith('recorded at:')) || ''

  return {
    reason: reasonPart.replace(/^job could not be completed:\s*/i, '').trim(),
    details: detailsPart.replace(/^details:\s*/i, '').trim(),
    reportedBy: reportedByPart.replace(/^reported by:\s*/i, '').trim(),
    recordedAt: recordedAtPart.replace(/^recorded at:\s*/i, '').trim(),
  }
}

function stripCannotCompleteLines(value?: string | null) {
  if (!value) return ''

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line && !line.toLowerCase().startsWith('job could not be completed:')
    )
    .join('\n')
}

function parseEndOfJobReport(value?: string | null): ParsedEndOfJobReport | null {
  if (!value) return null

  const parts = value
    .split(' | ')
    .map((part) => part.trim())
    .filter(Boolean)

  const hasEndOfJobPrefix = parts.some((part) =>
    part.toLowerCase().startsWith('end of job report:')
  )

  if (!hasEndOfJobPrefix) return null

  function getPart(prefix: string) {
    const match = parts.find((part) =>
      part.toLowerCase().startsWith(prefix.toLowerCase())
    )

    if (!match) return ''

    return match.slice(prefix.length).trim()
  }

  return {
    workSummary: getPart('Work summary:'),
    followUpRequired: getPart('Follow-up required:'),
    followUpDetails: getPart('Follow-up details:'),
    payment: getPart('Payment:'),
    paymentNotes: getPart('Payment notes:'),
    notesForKelly: getPart('Notes for Kelly:'),
    reportedBy: getPart('Reported by:'),
    recordedAt: getPart('Recorded at:'),
  }
}

export default async function AdminJobPage({ params }: PageProps) {
  const jobId = Number(params.id)

  if (!Number.isInteger(jobId) || jobId <= 0) {
    notFound()
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      assignments: {
        include: {
          worker: true,
        },
      },
      jobNotes: {
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          worker: true,
        },
      },
      photos: {
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          uploadedByWorker: true,
        },
      },
    },
  })

  if (!job) {
    notFound()
  }

  const assignedNames = (job.assignments || []).map((assignment: any) =>
    fullName(assignment.worker?.firstName, assignment.worker?.lastName)
  )

  const jobType = normaliseJobType(job.jobType)
  const cleanedMainNotes = stripCannotCompleteLines(job.notes)
  const noteTextBlob = (job.jobNotes || []).map((note: any) => note.note).join('\n')
  const cannotCompleteInfo =
    extractCannotCompleteInfoFromText(job.notes) ||
    extractCannotCompleteInfoFromText(noteTextBlob)

  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 p-5 text-white shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-300">
                Job details
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {job.customer?.name || 'Unknown customer'}
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
                Full job view with customer info, notes, end of job reports and photos.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${jobType.className}`}
                >
                  {jobType.label}
                </span>

                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/10">
                  {normaliseStatus(job.status)}
                </span>

                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/10">
                  Job #{job.id}
                </span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:w-auto">
              <Link
                href="/jobs"
                className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100"
              >
                Back to jobs
              </Link>

              <Link
                href={`/jobs/edit/${job.id}`}
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Edit job
              </Link>

              <Link
                href={`/customers/${job.customerId}`}
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 sm:col-span-2"
              >
                Open customer profile
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
              Visit date
            </div>
            <div className="mt-2 text-lg font-bold text-zinc-900">
              {formatDate(job.visitDate)}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
              Start time
            </div>
            <div className="mt-2 text-lg font-bold text-zinc-900">
              {job.startTime || 'Time TBC'}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
              Finished
            </div>
            <div className="mt-2 text-lg font-bold text-zinc-900">
              {formatDateTime(job.finishedAt)}
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-12">
          <section className="space-y-4 xl:col-span-7">
            <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-zinc-900">Job information</h2>
                <p className="text-sm text-zinc-500">
                  Core details for whoever is looking at or working this job next.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Customer
                  </div>
                  <div className="mt-2 text-sm font-bold text-zinc-900">
                    {job.customer?.name || 'Unknown customer'}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Assigned workers
                  </div>
                  <div className="mt-2 text-sm font-bold text-zinc-900">
                    {assignedNames.length > 0 ? assignedNames.join(', ') : 'Unassigned'}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Address
                  </div>
                  <div className="mt-2 whitespace-pre-line text-sm text-zinc-700">
                    {job.address || job.customer?.address || 'No address saved'}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Customer phone
                  </div>
                  <div className="mt-2 text-sm text-zinc-700">
                    {job.customer?.phone || 'Not saved'}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Customer email
                  </div>
                  <div className="mt-2 text-sm text-zinc-700">
                    {job.customer?.email || 'Not saved'}
                  </div>
                </div>
              </div>
            </div>

            {cannotCompleteInfo && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <h2 className="text-lg font-bold text-amber-900">
                  Job could not be completed
                </h2>

                <div className="mt-3 space-y-2 text-sm text-amber-900">
                  <div>
                    <span className="font-semibold">Reason:</span>{' '}
                    {cannotCompleteInfo.reason || 'Not provided'}
                  </div>

                  {cannotCompleteInfo.details && (
                    <div>
                      <span className="font-semibold">Details:</span>{' '}
                      {cannotCompleteInfo.details}
                    </div>
                  )}

                  {cannotCompleteInfo.reportedBy && (
                    <div>
                      <span className="font-semibold">Reported by:</span>{' '}
                      {cannotCompleteInfo.reportedBy}
                    </div>
                  )}

                  {cannotCompleteInfo.recordedAt && (
                    <div>
                      <span className="font-semibold">Recorded at:</span>{' '}
                      {cannotCompleteInfo.recordedAt}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-zinc-900">Main job notes</h2>

              <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="whitespace-pre-line text-sm text-zinc-700">
                  {cleanedMainNotes || 'No main job notes saved.'}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">End of job reports</h2>
                  <p className="text-sm text-zinc-500">
                    Saved updates from previous visits so the next person is not walking in blind.
                  </p>
                </div>

                <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">
                  {(job.jobNotes || []).length} note{(job.jobNotes || []).length === 1 ? '' : 's'}
                </div>
              </div>

              {(job.jobNotes || []).length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  No end of job report notes have been added yet.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {job.jobNotes.map((note: any) => {
                    const parsedReport = parseEndOfJobReport(note.note)
                    const cleanedNote = stripCannotCompleteLines(note.note)

                    return (
                      <div
                        key={note.id}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                      >
                        <div className="text-xs text-zinc-500">
                          {formatDateTime(note.createdAt)} •{' '}
                          {fullName(note.worker?.firstName, note.worker?.lastName)}
                        </div>

                        {parsedReport ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:col-span-2">
                              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                Work summary
                              </div>
                              <div className="mt-2 whitespace-pre-line text-sm text-zinc-700">
                                {parsedReport.workSummary || 'Not provided'}
                              </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-white p-3">
                              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                Follow-up required
                              </div>
                              <div className="mt-2 text-sm text-zinc-700">
                                {parsedReport.followUpRequired || 'Not provided'}
                              </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-white p-3">
                              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                Payment
                              </div>
                              <div className="mt-2 text-sm text-zinc-700">
                                {parsedReport.payment || 'Not provided'}
                              </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:col-span-2">
                              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                Follow-up details
                              </div>
                              <div className="mt-2 whitespace-pre-line text-sm text-zinc-700">
                                {parsedReport.followUpDetails || 'None'}
                              </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:col-span-2">
                              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                Notes for Kelly
                              </div>
                              <div className="mt-2 whitespace-pre-line text-sm text-zinc-700">
                                {parsedReport.notesForKelly || 'None'}
                              </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-white p-3">
                              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                Payment notes
                              </div>
                              <div className="mt-2 whitespace-pre-line text-sm text-zinc-700">
                                {parsedReport.paymentNotes || 'None'}
                              </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-white p-3">
                              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                Reported by
                              </div>
                              <div className="mt-2 text-sm text-zinc-700">
                                {parsedReport.reportedBy || 'Unknown worker'}
                              </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:col-span-2">
                              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                Recorded at
                              </div>
                              <div className="mt-2 text-sm text-zinc-700">
                                {parsedReport.recordedAt || formatDateTime(note.createdAt)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 whitespace-pre-line text-sm text-zinc-700">
                            {cleanedNote || 'No note text'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4 xl:col-span-5">
            <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-zinc-900">Customer links</h2>

              <div className="mt-4 grid gap-3">
                <Link
                  href={`/customers/${job.customerId}`}
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-black"
                >
                  Open customer profile
                </Link>

                <Link
                  href={`/customers/${job.customerId}/edit`}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                >
                  Edit customer
                </Link>

                <Link
                  href={`/jobs/edit/${job.id}`}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                >
                  Edit / reschedule job
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Photos</h2>
                  <p className="text-sm text-zinc-500">
                    Previous job photos for context before anyone goes back.
                  </p>
                </div>

                <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">
                  {(job.photos || []).length} photo{(job.photos || []).length === 1 ? '' : 's'}
                </div>
              </div>

              {(job.photos || []).length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  No photos uploaded yet.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {job.photos.map((photo: any) => (
                    <div
                      key={photo.id}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
                    >
                      <img
                        src={photo.imageUrl}
                        alt={photo.label || `Job photo ${photo.id}`}
                        className="h-48 w-full rounded-xl border border-zinc-200 object-cover"
                      />

                      <div className="mt-3 text-sm font-semibold text-zinc-900">
                        {photo.label || 'Job photo'}
                      </div>

                      <div className="mt-1 text-xs text-zinc-500">
                        {formatDateTime(photo.createdAt)}
                      </div>

                      <div className="mt-1 text-xs text-zinc-500">
                        Uploaded by{' '}
                        {fullName(
                          photo.uploadedByWorker?.firstName,
                          photo.uploadedByWorker?.lastName
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}