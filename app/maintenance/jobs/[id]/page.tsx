import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import {
  getMaintenanceControls,
  getPreviousMaintenanceNextVisitNote,
} from '@/lib/maintenance-controls'
import MaintenanceVisitActions from './MaintenanceVisitActions'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: {
    id: string
  }
}

function fullName(firstName?: string | null, lastName?: string | null) {
  return `${firstName || ''} ${lastName || ''}`.trim()
}

function formatDate(value?: Date | null) {
  if (!value) return 'Not booked yet'
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value)
}

export default async function MaintenanceWorkerJobPage({ params }: PageProps) {
  const jobId = Number(params.id)
  if (!Number.isInteger(jobId) || jobId <= 0) notFound()

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      assignments: {
        include: { worker: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!job || String(job.jobType || '').trim().toLowerCase() !== 'maintenance') notFound()

  const [controls, previousNextVisitNote] = await Promise.all([
    getMaintenanceControls(job.id),
    getPreviousMaintenanceNextVisitNote(job.customerId, job.id),
  ])

  const assigned = job.assignments
    .map((assignment) => fullName(assignment.worker.firstName, assignment.worker.lastName))
    .filter(Boolean)

  const workText = String(job.notes || '').trim() || String(job.title || '').trim() || 'Carry out the agreed maintenance visit.'
  const address = job.address || job.customer.address || job.customer.postcode || 'Address not saved'

  return (
    <main className="min-h-screen bg-zinc-100 px-3 py-4 text-zinc-950 sm:px-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-3xl bg-zinc-950 p-5 text-white shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">Maintenance visit</div>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{job.customer.name}</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{address}</p>
            </div>
            <Link href="/today" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-zinc-950">Back to today</Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Visit date</div>
              <div className="mt-1 text-lg font-black">{formatDate(job.visitDate)}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Assigned</div>
              <div className="mt-1 text-lg font-black">{assigned.length ? assigned.join(', ') : 'Not assigned'}</div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-yellow-300 bg-yellow-50 p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-800">What to do today</div>
          <h2 className="mt-1 text-xl font-black text-zinc-950">The maintenance brief</h2>
          <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-6 text-zinc-800 ring-1 ring-inset ring-yellow-200">
            {workText}
          </div>
        </section>

        {previousNextVisitNote ? (
          <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">From the last visit</div>
            <h2 className="mt-1 text-xl font-black text-blue-950">Remember this today</h2>
            <div className="mt-3 rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-zinc-800 ring-1 ring-inset ring-blue-200">
              {previousNextVisitNote}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Property / access</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-zinc-50 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Address</div>
              <div className="mt-1 text-sm font-semibold leading-6">{address}</div>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Customer contact</div>
              <div className="mt-1 text-sm font-semibold leading-6">{job.customer.phone || 'No phone saved'}</div>
            </div>
          </div>
        </section>

        <MaintenanceVisitActions jobId={job.id} initialControls={controls} />

        <div className="pb-5 text-center text-xs font-medium text-zinc-400">
          Job #{job.id} · Maintenance is intentionally quick: do the work, leave useful notes, flag opportunities, finish the visit.
        </div>
      </div>
    </main>
  )
}
