import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import {
  getMaintenanceControls,
  getMaintenancePhotoHistory,
  getMaintenancePropertyMemory,
  getPreviousMaintenanceNextVisitNote,
} from '@/lib/maintenance-controls'
import MaintenanceVisitActions from './MaintenanceVisitActions'
import MaintenanceChas from './MaintenanceChas'

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

function formatShortDate(value?: Date | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
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

  const [controls, previousNextVisitNote, previousPropertyMemory, photoHistory] = await Promise.all([
    getMaintenanceControls(job.id),
    getPreviousMaintenanceNextVisitNote(job.customerId, job.id),
    getMaintenancePropertyMemory(job.customerId, job.id),
    getMaintenancePhotoHistory(job.customerId, job.id),
  ])

  const assigned = job.assignments
    .map((assignment) => fullName(assignment.worker.firstName, assignment.worker.lastName))
    .filter(Boolean)

  const workText = String(job.notes || '').trim() || String(job.title || '').trim() || 'Carry out the agreed maintenance visit.'
  const address = job.address || job.customer.address || job.customer.postcode || 'Address not saved'
  const propertyMemory = controls.propertyMemory || previousPropertyMemory

  return (
    <main className="min-h-screen bg-zinc-100 px-2.5 py-3 text-zinc-950 sm:px-5 sm:py-4">
      <div className="mx-auto max-w-3xl space-y-3 sm:space-y-4">
        <section className="rounded-3xl bg-zinc-950 p-4 text-white shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">Maintenance visit</div>
              <h1 className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">{job.customer.name}</h1>
              <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{address}</p>
            </div>
            <Link href="/today" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-zinc-950 sm:w-auto">Back to today</Link>
          </div>

          <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Visit date</div>
              <div className="mt-1 text-base font-black sm:text-lg">{formatDate(job.visitDate)}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Assigned</div>
              <div className="mt-1 break-words text-base font-black sm:text-lg">{assigned.length ? assigned.join(', ') : 'Not assigned'}</div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-yellow-300 bg-yellow-50 p-4 shadow-sm sm:p-5">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-800">What to do today</div>
          <h2 className="mt-1 text-xl font-black text-zinc-950">The maintenance brief</h2>
          <div className="mt-4 whitespace-pre-wrap break-words rounded-2xl bg-white p-4 text-sm leading-6 text-zinc-800 ring-1 ring-inset ring-yellow-200">
            {workText}
          </div>
        </section>

        {propertyMemory ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Property memory</div>
            <h2 className="mt-1 text-xl font-black text-amber-950">Know this before you start</h2>
            <div className="mt-3 whitespace-pre-wrap break-words rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-zinc-800 ring-1 ring-inset ring-amber-200">
              {propertyMemory}
            </div>
          </section>
        ) : null}

        {previousNextVisitNote ? (
          <section className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm sm:p-5">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">From the last visit</div>
            <h2 className="mt-1 text-xl font-black text-blue-950">Remember this today</h2>
            <div className="mt-3 break-words rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-zinc-800 ring-1 ring-inset ring-blue-200">
              {previousNextVisitNote}
            </div>
          </section>
        ) : null}

        <MaintenanceChas jobId={job.id} />

        <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Property / access</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-zinc-50 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Address</div>
              <div className="mt-1 break-words text-sm font-semibold leading-6">{address}</div>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Customer contact</div>
              {job.customer.phone ? (
                <a href={`tel:${job.customer.phone.replace(/\s+/g, '')}`} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-black text-white sm:w-auto">
                  Call {job.customer.phone}
                </a>
              ) : (
                <div className="mt-1 text-sm font-semibold leading-6">No phone saved</div>
              )}
            </div>
          </div>
        </section>

        {photoHistory.length ? (
          <section className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm sm:p-5">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Previous maintenance photos</div>
            <h2 className="mt-1 text-xl font-black text-blue-950">Quick property history</h2>
            <p className="mt-1 text-sm leading-6 text-blue-900">Useful for seeing how hedges, borders, lawns, weeds or recurring issues have changed over time.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {photoHistory.slice(0, 9).map((photo) => (
                <a key={photo.id} href={photo.imageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-blue-200">
                  <img src={photo.imageUrl} alt="Previous maintenance visit" className="aspect-square w-full object-cover" />
                  <div className="px-3 py-2 text-[11px] font-bold text-zinc-600">{formatShortDate(photo.createdAt)} · Job #{photo.jobId}</div>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <MaintenanceVisitActions
          jobId={job.id}
          initialControls={controls}
          initialPropertyMemory={propertyMemory}
        />

        <div className="px-2 pb-5 text-center text-xs font-medium leading-5 text-zinc-400">
          Job #{job.id} · Maintenance is intentionally quick: do the work, leave useful notes, flag opportunities, finish the visit.
        </div>
      </div>
    </main>
  )
}
