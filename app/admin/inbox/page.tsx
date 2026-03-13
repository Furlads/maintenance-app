import Link from 'next/link'

type InboxSource =
  | 'facebook-page-1'
  | 'facebook-page-2'
  | 'whatsapp'
  | 'wix'
  | 'outlook-1'
  | 'outlook-2'
  | 'quote-request'

type InboxStatus = 'unread' | 'open' | 'replied'

type InboxItem = {
  id: string
  source: InboxSource
  customerName: string
  contact: string
  preview: string
  receivedAt: string
  unread: boolean
  assignedTo: 'Kelly' | 'Trevor' | 'Unassigned'
  status: InboxStatus
}

const demoItems: InboxItem[] = [
  {
    id: '1',
    source: 'facebook-page-1',
    customerName: 'Sarah Jones',
    contact: 'Facebook message',
    preview:
      'Hi, could somebody come out and quote for a new patio and some fencing please?',
    receivedAt: 'Today • 08:24',
    unread: true,
    assignedTo: 'Kelly',
    status: 'unread',
  },
  {
    id: '2',
    source: 'whatsapp',
    customerName: 'Martin Evans',
    contact: '07900 123456',
    preview:
      'Morning, just checking whether you can fit us in next week for the hedge and tidy-up.',
    receivedAt: 'Today • 09:10',
    unread: true,
    assignedTo: 'Unassigned',
    status: 'unread',
  },
  {
    id: '3',
    source: 'outlook-1',
    customerName: 'Helen Barker',
    contact: 'helen@example.com',
    preview:
      'Thanks for the visit yesterday. Please can you send over the quote when ready?',
    receivedAt: 'Today • 09:42',
    unread: false,
    assignedTo: 'Kelly',
    status: 'open',
  },
  {
    id: '4',
    source: 'wix',
    customerName: 'David Morris',
    contact: 'Website enquiry',
    preview:
      'Interested in artificial grass for the back garden. Approx 45m2. Please advise on next steps.',
    receivedAt: 'Today • 10:18',
    unread: false,
    assignedTo: 'Trevor',
    status: 'open',
  },
  {
    id: '5',
    source: 'quote-request',
    customerName: 'Mrs Cartwright',
    contact: 'Worker quote request',
    preview:
      'Worker submitted a quote request for fencing repairs with attached photo and notes.',
    receivedAt: 'Today • 11:03',
    unread: true,
    assignedTo: 'Trevor',
    status: 'unread',
  },
  {
    id: '6',
    source: 'outlook-2',
    customerName: 'Paul Griffin',
    contact: 'paul@example.com',
    preview:
      'Brilliant, thanks for confirming. Please book us in for the first available date.',
    receivedAt: 'Yesterday • 16:47',
    unread: false,
    assignedTo: 'Kelly',
    status: 'replied',
  },
]

function sourceLabel(source: InboxSource) {
  switch (source) {
    case 'facebook-page-1':
      return 'Facebook Page 1'
    case 'facebook-page-2':
      return 'Facebook Page 2'
    case 'whatsapp':
      return 'WhatsApp'
    case 'wix':
      return 'Wix'
    case 'outlook-1':
      return 'Outlook 1'
    case 'outlook-2':
      return 'Outlook 2'
    case 'quote-request':
      return 'Quote Request'
    default:
      return 'Inbox'
  }
}

function sourceBadgeClasses(source: InboxSource) {
  switch (source) {
    case 'facebook-page-1':
    case 'facebook-page-2':
      return 'bg-blue-50 text-blue-700 ring-blue-200'
    case 'whatsapp':
      return 'bg-green-50 text-green-700 ring-green-200'
    case 'wix':
      return 'bg-purple-50 text-purple-700 ring-purple-200'
    case 'outlook-1':
    case 'outlook-2':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-200'
    case 'quote-request':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    default:
      return 'bg-zinc-100 text-zinc-700 ring-zinc-200'
  }
}

function statusBadgeClasses(status: InboxStatus) {
  switch (status) {
    case 'unread':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'open':
      return 'bg-blue-50 text-blue-700 ring-blue-200'
    case 'replied':
      return 'bg-green-50 text-green-700 ring-green-200'
    default:
      return 'bg-zinc-100 text-zinc-700 ring-zinc-200'
  }
}

export default function AdminInboxPage() {
  const unreadCount = demoItems.filter((item) => item.unread).length
  const openCount = demoItems.filter((item) => item.status === 'open').length
  const assignedToKelly = demoItems.filter(
    (item) => item.assignedTo === 'Kelly'
  ).length
  const assignedToTrevor = demoItems.filter(
    (item) => item.assignedTo === 'Trevor'
  ).length

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Furlads Admin
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Unified Inbox
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                One clean place for messages, enquiries, emails and worker quote
                requests.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/quotes"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                Quotes
              </Link>
              <Link
                href="/admin/jobs"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                Jobs
              </Link>
              <Link
                href="/admin/customers"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                Customers
              </Link>
            </div>
          </div>
        </div>

        <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Total items
            </div>
            <div className="mt-2 text-3xl font-bold">{demoItems.length}</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Unread
            </div>
            <div className="mt-2 text-3xl font-bold">{unreadCount}</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Open
            </div>
            <div className="mt-2 text-3xl font-bold">{openCount}</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Assigned
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-700">
              Kelly: {assignedToKelly}
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-700">
              Trevor: {assignedToTrevor}
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-12">
          <section className="lg:col-span-3">
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-4 py-3">
                <h2 className="text-base font-bold">Filters</h2>
                <p className="text-xs text-zinc-500">
                  Visual shell for now — integrations come next
                </p>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    View
                  </div>
                  <div className="space-y-2">
                    <button className="w-full rounded-xl bg-zinc-900 px-3 py-2 text-left text-sm font-semibold text-white">
                      All messages
                    </button>
                    <button className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                      Unread only
                    </button>
                    <button className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                      Assigned to Kelly
                    </button>
                    <button className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                      Assigned to Trevor
                    </button>
                    <button className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                      Unassigned
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Sources
                  </div>
                  <div className="grid gap-2">
                    <button className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50">
                      Facebook Page 1
                    </button>
                    <button className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50">
                      Facebook Page 2
                    </button>
                    <button className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50">
                      WhatsApp
                    </button>
                    <button className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50">
                      Wix
                    </button>
                    <button className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50">
                      Outlook 1
                    </button>
                    <button className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50">
                      Outlook 2
                    </button>
                    <button className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50">
                      Quote Requests
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="lg:col-span-9">
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold">Inbox items</h2>
                  <p className="text-xs text-zinc-500">
                    This page is ready for live integrations next
                  </p>
                </div>

                <div className="w-full sm:w-80">
                  <input
                    type="text"
                    placeholder="Search customer, contact or message..."
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400"
                  />
                </div>
              </div>

              <div className="p-3">
                <div className="space-y-3">
                  {demoItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${sourceBadgeClasses(
                                item.source
                              )}`}
                            >
                              {sourceLabel(item.source)}
                            </span>

                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusBadgeClasses(
                                item.status
                              )}`}
                            >
                              {item.status}
                            </span>

                            {item.unread ? (
                              <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                                New
                              </span>
                            ) : null}
                          </div>

                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-bold text-zinc-900">
                                {item.customerName}
                              </h3>
                              <div className="text-sm text-zinc-500">
                                {item.contact}
                              </div>
                            </div>

                            <div className="text-sm font-medium text-zinc-500">
                              {item.receivedAt}
                            </div>
                          </div>

                          <p className="mt-3 text-sm leading-6 text-zinc-700">
                            {item.preview}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700">
                              Assigned: {item.assignedTo}
                            </span>
                          </div>
                        </div>

                        <div className="flex w-full shrink-0 flex-wrap gap-2 lg:w-auto lg:flex-col">
                          <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
                            Open thread
                          </button>
                          <button className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                            Assign
                          </button>
                          <button className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                            Mark done
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}