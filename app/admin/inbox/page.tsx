import SourceBadge from '@/components/admin/SourceBadge'
import * as prismaModule from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type InternalInboxItem = {
  id: number
  createdAt: Date
  worker: string
  customerName: string | null
  customerPhone: string | null
  customerAddress: string | null
  customerPostcode: string | null
  workSummary: string | null
  estimatedHours: number | null
  enquirySummary: string | null
  roughPriceText: string | null
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

function StatCard({
  title,
  value,
}: {
  title: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  )
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
      {label}
    </span>
  )
}

export default async function AdminInboxPage() {
  const quoteRequests = (await prisma.chasMessage.findMany({
    where: {
      enquiryReadyForKelly: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 25,
    select: {
      id: true,
      createdAt: true,
      worker: true,
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      customerPostcode: true,
      workSummary: true,
      estimatedHours: true,
      enquirySummary: true,
      roughPriceText: true,
    },
  })) as InternalInboxItem[]

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
              Unified inbox
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              One place for messages and office follow-up
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">
              This page is now styled and ready for source-based messaging. Internal worker
              quote requests are live below, and the colour/icon system is already ready for
              WhatsApp Business plus your two Outlook inboxes.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Worker quote requests" value={quoteRequests.length} />
        <StatCard title="WhatsApp business" value="Ready" />
        <StatCard title="Furlads email" value="Ready" />
        <StatCard title="Three Counties email" value="Ready" />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-base font-bold">Source key</h3>
          <p className="text-xs text-zinc-500">
            Icons and colours to make scanning easier for Kelly and Trevor
          </p>
        </div>

        <div className="flex flex-wrap gap-2 p-4">
          <SourceBadge source="whatsapp" />
          <SourceBadge source="furlads-email" />
          <SourceBadge source="threecounties-email" />
          <SourceBadge source="facebook" />
          <SourceBadge source="wix" />
          <SourceBadge source="worker-quote" />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="xl:col-span-8">
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-base font-bold">Inbox items</h3>
                <p className="text-xs text-zinc-500">
                  Live internal quote requests today, with external sources ready to wire in
                </p>
              </div>
              <div className="hidden gap-2 md:flex">
                <button className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">
                  All
                </button>
                <button className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800">
                  WhatsApp
                </button>
                <button className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800">
                  Furlads Email
                </button>
                <button className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800">
                  Three Counties Email
                </button>
                <button className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800">
                  Worker Quotes
                </button>
              </div>
            </div>

            <div className="p-3">
              {quoteRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  No worker quote requests are waiting right now.
                </div>
              ) : (
                <div className="space-y-3">
                  {quoteRequests.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <SourceBadge source="worker-quote" compact />
                            <StatusBadge label="Unread" />
                            <StatusBadge label="Kelly follow-up" />
                          </div>

                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <h4 className="truncate text-base font-bold text-zinc-900">
                                {item.customerName || 'Unnamed customer'}
                              </h4>
                              <div className="text-sm text-zinc-500">
                                Submitted by {item.worker || 'Unknown worker'}
                              </div>
                            </div>

                            <div className="text-sm font-medium text-zinc-500">
                              {formatDateTime(item.createdAt)}
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                            <div>
                              <span className="font-semibold">Phone:</span>{' '}
                              {item.customerPhone || '—'}
                            </div>
                            <div>
                              <span className="font-semibold">Estimated hours:</span>{' '}
                              {item.estimatedHours ?? '—'}
                            </div>
                            <div className="sm:col-span-2">
                              <span className="font-semibold">Address:</span>{' '}
                              {item.customerAddress || '—'}
                              {item.customerPostcode ? `, ${item.customerPostcode}` : ''}
                            </div>
                            <div className="sm:col-span-2">
                              <span className="font-semibold">Summary:</span>{' '}
                              {item.enquirySummary || item.workSummary || '—'}
                            </div>
                            {item.roughPriceText ? (
                              <div className="sm:col-span-2">
                                <span className="font-semibold">Rough price:</span>{' '}
                                {item.roughPriceText}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex w-full shrink-0 flex-wrap gap-2 lg:w-auto lg:flex-col">
                          <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
                            Open
                          </button>
                          <button className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800">
                            Assign
                          </button>
                          <button className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800">
                            Mark done
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="xl:col-span-4 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h3 className="text-base font-bold">External connectors next</h3>
              <p className="text-xs text-zinc-500">
                Ready in the UI for your real channels
              </p>
            </div>

            <div className="space-y-3 p-4">
              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <SourceBadge source="whatsapp" />
                  <StatusBadge label="Pending connection" />
                </div>
                <p className="mt-3 text-sm text-zinc-600">
                  One WhatsApp Business number.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <SourceBadge source="furlads-email" />
                  <StatusBadge label="Pending connection" />
                </div>
                <p className="mt-3 text-sm text-zinc-600">
                  Outlook inbox for landscaping and project enquiries.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <SourceBadge source="threecounties-email" />
                  <StatusBadge label="Pending connection" />
                </div>
                <p className="mt-3 text-sm text-zinc-600">
                  Outlook inbox for maintenance and recurring service enquiries.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}