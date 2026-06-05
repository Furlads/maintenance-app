import Link from 'next/link'
import * as prismaModule from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type SearchParams = {
  range?: string
  from?: string
  to?: string
}

type ParsedNoteSection = {
  label: string
  value: string
}

type JobNoteRow = {
  id: number
  note: string
  createdAt: Date
  createdByWorkerId: number | null
  worker?: {
    firstName: string | null
    lastName: string | null
  } | null
  job: {
    id: number
    title: string
    address: string
    notes: string | null
    visitDate: Date | null
    startTime: string | null
    status: string
    jobType: string
    customer?: {
      name: string | null
      phone: string | null
      email: string | null
      postcode: string | null
    } | null
  }
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

function endOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
}

function startOfYesterday() {
  const today = startOfToday()
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 0, 0, 0, 0)
}

function endOfYesterday() {
  const today = startOfToday()
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23, 59, 59, 999)
}

function startOfWeek() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1

  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0)
}

function startOfLastWeek() {
  const weekStart = startOfWeek()

  return new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() - 7,
    0,
    0,
    0,
    0
  )
}

function endOfLastWeek() {
  const weekStart = startOfWeek()

  return new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() - 1,
    23,
    59,
    59,
    999
  )
}

function startOfMonth() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

function parseDateInput(value?: string) {
  if (!value) return null

  const parts = value.split('-').map(Number)
  if (parts.length !== 3) return null

  const [year, month, day] = parts
  if (!year || !month || !day) return null

  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

function endOfDateInput(value?: string) {
  const start = parseDateInput(value)
  if (!start) return null

  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    23,
    59,
    59,
    999
  )
}

function getDateRange(searchParams: SearchParams) {
  const range = searchParams.range || 'today'

  if (range === 'yesterday') {
    return {
      range,
      label: 'Yesterday',
      from: startOfYesterday(),
      to: endOfYesterday(),
    }
  }

  if (range === 'this-week') {
    return {
      range,
      label: 'This week',
      from: startOfWeek(),
      to: endOfToday(),
    }
  }

  if (range === 'last-week') {
    return {
      range,
      label: 'Last week',
      from: startOfLastWeek(),
      to: endOfLastWeek(),
    }
  }

  if (range === 'this-month') {
    return {
      range,
      label: 'This month',
      from: startOfMonth(),
      to: endOfToday(),
    }
  }

  if (range === 'custom') {
    const customFrom = parseDateInput(searchParams.from)
    const customTo = endOfDateInput(searchParams.to)

    return {
      range,
      label: 'Custom range',
      from: customFrom || startOfToday(),
      to: customTo || endOfToday(),
    }
  }

  return {
    range: 'today',
    label: 'Today',
    from: startOfToday(),
    to: endOfToday(),
  }
}

function formatDate(value: Date | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function fullWorkerName(note: JobNoteRow) {
  const relationName = `${note.worker?.firstName || ''} ${note.worker?.lastName || ''}`.trim()

  return relationName || 'Unknown / office note'
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

function normaliseStatus(value?: string | null) {
  const raw = String(value || '').toLowerCase()

  if (raw.includes('progress')) return 'In progress'
  if (raw.includes('done') || raw.includes('finish') || raw.includes('completed')) return 'Done'
  if (raw.includes('sched')) return 'Scheduled'
  if (raw.includes('cancel')) return 'Cancelled'
  if (raw.includes('archive')) return 'Archived'
  return value || 'Unscheduled'
}

function cleanSectionLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function parseStructuredNote(note: string): ParsedNoteSection[] {
  const cleaned = String(note || '').trim()

  if (!cleaned) {
    return []
  }

  const parts = cleaned
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length <= 1) {
    return [
      {
        label: 'Note',
        value: cleaned,
      },
    ]
  }

  return parts.map((part, index) => {
    const colonIndex = part.indexOf(':')

    if (colonIndex === -1) {
      return {
        label: index === 0 ? 'Summary' : `Note ${index + 1}`,
        value: part,
      }
    }

    const label = part.slice(0, colonIndex).trim()
    const value = part.slice(colonIndex + 1).trim()

    return {
      label: cleanSectionLabel(label),
      value: value || '—',
    }
  })
}

function rangeHref(range: string) {
  return `/kelly/notes-summary?range=${encodeURIComponent(range)}`
}

function RangeButton({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition ${
        active
          ? 'bg-zinc-900 text-white hover:bg-black'
          : 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
      }`}
    >
      {children}
    </Link>
  )
}

export default async function KellyNotesSummaryPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const selectedRange = getDateRange(searchParams || {})

  const notes = (await prisma.jobNote.findMany({
    where: {
      createdAt: {
        gte: selectedRange.from,
        lte: selectedRange.to,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 500,
    include: {
      worker: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      job: {
        select: {
          id: true,
          title: true,
          address: true,
          notes: true,
          visitDate: true,
          startTime: true,
          status: true,
          jobType: true,
          customer: {
            select: {
              name: true,
              phone: true,
              email: true,
              postcode: true,
            },
          },
        },
      },
    },
  })) as JobNoteRow[]

  const uniqueJobs = new Set(notes.map((note) => note.job.id)).size
  const uniqueWorkers = new Set(notes.map((note) => fullWorkerName(note))).size

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-300">
              Kelly notes summary
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Notes added across jobs
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              Review notes added by the team over a chosen time period, then open the job if
              anything needs checking, editing or following up.
            </p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100"
            >
              Back to admin
            </Link>

            <Link
              href="/jobs"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              View all jobs
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
            Time period
          </div>

          <div className="mt-2 text-xl font-bold tracking-tight text-zinc-900">
            {selectedRange.label}
          </div>

          <div className="mt-1 text-xs text-zinc-500">
            {formatDate(selectedRange.from)} to {formatDate(selectedRange.to)}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
            Notes
          </div>

          <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
            {notes.length}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
            Jobs mentioned
          </div>

          <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
            {uniqueJobs}
          </div>
        </div>

        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
            Note authors
          </div>

          <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
            {uniqueWorkers}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-4">
          <h2 className="text-base font-bold text-zinc-900">Choose time period</h2>
          <p className="text-xs text-zinc-500">Newest notes will always show first.</p>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-5">
          <RangeButton href={rangeHref('today')} active={selectedRange.range === 'today'}>
            Today
          </RangeButton>

          <RangeButton href={rangeHref('yesterday')} active={selectedRange.range === 'yesterday'}>
            Yesterday
          </RangeButton>

          <RangeButton href={rangeHref('this-week')} active={selectedRange.range === 'this-week'}>
            This week
          </RangeButton>

          <RangeButton href={rangeHref('last-week')} active={selectedRange.range === 'last-week'}>
            Last week
          </RangeButton>

          <RangeButton href={rangeHref('this-month')} active={selectedRange.range === 'this-month'}>
            This month
          </RangeButton>
        </div>

        <form
          action="/kelly/notes-summary"
          className="grid gap-3 border-t border-zinc-100 p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input type="hidden" name="range" value="custom" />

          <label className="space-y-1">
            <span className="text-xs font-bold text-zinc-600">From</span>
            <input
              type="date"
              name="from"
              defaultValue={searchParams?.from || ''}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-bold text-zinc-600">To</span>
            <input
              type="date"
              name="to"
              defaultValue={searchParams?.to || ''}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />
          </label>

          <button
            type="submit"
            className="self-end rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-black"
          >
            Apply custom range
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Notes found</h2>
            <p className="text-xs text-zinc-500">
              Showing up to 500 notes for the selected period.
            </p>
          </div>

          <Link href="/admin/activity" className="text-sm font-semibold text-zinc-700">
            View full activity dashboard
          </Link>
        </div>

        <div className="divide-y divide-zinc-100">
          {notes.length === 0 ? (
            <div className="p-5 text-sm text-zinc-600">
              No job notes were added during this time period.
            </div>
          ) : (
            notes.map((note) => {
              const jobType = normaliseJobType(note.job.jobType)
              const customerName = note.job.customer?.name || note.job.title || 'Unknown customer'
              const postcode = note.job.customer?.postcode || null
              const phone = note.job.customer?.phone || null
              const email = note.job.customer?.email || null
              const parsedSections = parseStructuredNote(note.note)

              return (
                <article key={note.id} className="p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${jobType.className}`}
                        >
                          {jobType.label}
                        </span>

                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                          {normaliseStatus(note.job.status)}
                        </span>

                        <span className="text-xs text-zinc-500">
                          Added {formatDateTime(note.createdAt)}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold leading-tight text-zinc-900">
                        {customerName}
                      </h3>

                      <div className="mt-1 text-sm leading-6 text-zinc-500">
                        Job #{note.job.id} • {note.job.address || 'No address'}
                        {postcode ? ` • ${postcode}` : ''}
                      </div>

                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="space-y-4">
                          {parsedSections.map((section, index) => (
                            <div key={`${note.id}-${section.label}-${index}`}>
                              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-800">
                                {section.label}
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-800">
                                {section.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {note.job.notes ? (
                        <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-800">
                            Current job description / notes
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-800">
                            {note.job.notes}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-3 grid gap-2 rounded-2xl bg-zinc-50 p-3 text-xs text-zinc-600 sm:grid-cols-2">
                        <div>
                          <span className="font-semibold">Added by:</span> {fullWorkerName(note)}
                        </div>

                        <div>
                          <span className="font-semibold">Job date:</span>{' '}
                          {formatDate(note.job.visitDate)}
                        </div>

                        <div>
                          <span className="font-semibold">Start time:</span>{' '}
                          {note.job.startTime || 'Time TBC'}
                        </div>

                        <div>
                          <span className="font-semibold">Contact:</span>{' '}
                          {[phone, email].filter(Boolean).join(' / ') || 'No contact saved'}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:w-64 xl:grid-cols-1">
                      <Link
                        href={`/jobs/${note.job.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-black"
                      >
                        Open job
                      </Link>

                      <Link
                        href={`/jobs/edit/${note.job.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                      >
                        Edit job
                      </Link>

                      <Link
                        href={`/jobs/edit/${note.job.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-800 transition hover:bg-amber-100"
                      >
                        Add/change job description or next-time notes
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}