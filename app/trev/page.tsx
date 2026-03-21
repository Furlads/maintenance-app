import Link from "next/link"
import * as prismaModule from "@/lib/prisma"

export const dynamic = "force-dynamic"

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type JobCard = {
  id: number
  title: string
  jobType: string
  status: string
  visitDate: Date | null
  startTime: string | null
  durationMinutes: number | null
  address: string
  notes: string | null
  createdAt: Date
  customer: {
    id: number
    name: string
    phone: string | null
    email: string | null
    address: string | null
    postcode: string | null
  } | null
}

type InboxMessageRow = {
  id: number
  conversationId: string | null
  source: string
  senderName: string | null
  senderEmail: string | null
  senderPhone: string | null
  subject: string | null
  preview: string | null
  body: string | null
  status: string
  customerId: number | null
  jobId: number | null
  createdAt: Date
  conversation: {
    id: string
    source: string
    contactName: string | null
    contactRef: string | null
    archived: boolean
    createdAt: Date
  } | null
}

type ThreadCard = {
  threadKey: string
  conversationId: string
  displayName: string
  displayContact: string
  latestPreview: string
  latestStatus: string
  latestTime: Date
  source: string
  businessLabel: string
  messageCount: number
  hasConversation: boolean
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—"
  return value
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatDuration(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return "—"

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
  if (hours > 0) return `${hours}h`
  return `${mins}m`
}

function londonNow() {
  const now = new Date()
  return new Date(now)
}

function startOfLondonDayUtc(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) {
    throw new Error("Failed to build London date parts")
  }

  return new Date(`${year}-${month}-${day}T00:00:00.000Z`)
}

function nextLondonDayUtc(date: Date) {
  const start = startOfLondonDayUtc(date)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

function isQuoteJob(job: { jobType?: string | null; title?: string | null }) {
  const type = cleanString(job.jobType).toLowerCase()
  const title = cleanString(job.title).toLowerCase()
  return type === "quote" || title === "quote"
}

function normaliseSource(value: string) {
  const source = String(value || "").toLowerCase()

  if (source.includes("threecounties")) return "threecounties-email"
  if (source.includes("furlads")) return "furlads-email"
  if (source.includes("whatsapp")) return "whatsapp"
  if (source.includes("facebook")) return "facebook"
  if (source.includes("wix")) return "wix"
  return "worker-quote"
}

function getReadableSourceName(source: string) {
  const normalised = normaliseSource(source)

  if (normalised === "threecounties-email") return "Three Counties Email"
  if (normalised === "furlads-email") return "Furlads Email"
  if (normalised === "whatsapp") return "WhatsApp"
  if (normalised === "facebook") return "Facebook"
  if (normalised === "wix") return "Wix"
  return "Worker Quote"
}

function buildPreview(message: InboxMessageRow) {
  if (message.preview && message.preview.trim()) {
    return message.preview.trim().replace(/\s+/g, " ")
  }

  if (message.subject && message.subject.trim()) {
    return message.subject.trim().replace(/\s+/g, " ")
  }

  if (message.body && message.body.trim()) {
    return message.body.trim().replace(/\s+/g, " ")
  }

  return "No message preview yet."
}

function buildDisplayName(message: InboxMessageRow) {
  if (message.conversation?.contactName?.trim()) return message.conversation.contactName.trim()
  if (message.senderName?.trim()) return message.senderName.trim()
  if (message.senderEmail?.trim()) return message.senderEmail.trim()
  if (message.senderPhone?.trim()) return message.senderPhone.trim()
  if (message.conversation?.contactRef?.trim()) return message.conversation.contactRef.trim()
  return "Unknown sender"
}

function buildDisplayContact(message: InboxMessageRow) {
  if (message.senderPhone?.trim()) return message.senderPhone.trim()
  if (message.senderEmail?.trim()) return message.senderEmail.trim()
  if (message.conversation?.contactRef?.trim()) return message.conversation.contactRef.trim()
  return "No contact details yet"
}

function buildThreadKey(message: InboxMessageRow) {
  const senderPhone = cleanString(message.senderPhone)
  const senderEmail = cleanString(message.senderEmail)
  const contactRef = cleanString(message.conversation?.contactRef)

  if (senderPhone) return `phone:${senderPhone.replace(/\s+/g, "")}`
  if (senderEmail) return `email:${senderEmail.toLowerCase()}`
  if (contactRef) return `ref:${contactRef.toLowerCase()}`
  if (message.conversationId) return message.conversationId

  return `message-${message.id}`
}

function detectBusinessLabel(message: InboxMessageRow) {
  const source = normaliseSource(message.source)
  const contactName = String(message.conversation?.contactName || "").toLowerCase()
  const senderName = String(message.senderName || "").toLowerCase()
  const contactRef = String(message.conversation?.contactRef || "").toLowerCase()
  const joined = `${contactName} ${senderName} ${contactRef}`

  if (source === "threecounties-email") return "Three Counties"
  if (source === "worker-quote") return "Internal"

  if (joined.includes("three counties") || joined.includes("threecounties")) {
    return "Three Counties"
  }

  return "Furlads"
}

function buildThreads(messages: InboxMessageRow[]): ThreadCard[] {
  const grouped = new Map<string, InboxMessageRow[]>()

  for (const message of messages) {
    const key = buildThreadKey(message)

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }

    grouped.get(key)!.push(message)
  }

  const threads: ThreadCard[] = []

  for (const [threadKey, items] of grouped.entries()) {
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    const latest = sorted[0]

    threads.push({
      threadKey,
      conversationId: latest.conversationId || threadKey,
      displayName: buildDisplayName(latest),
      displayContact: buildDisplayContact(latest),
      latestPreview: buildPreview(latest),
      latestStatus: latest.status,
      latestTime: latest.createdAt,
      source: latest.source,
      businessLabel: detectBusinessLabel(latest),
      messageCount: sorted.length,
      hasConversation: Boolean(latest.conversationId),
    })
  }

  return threads.sort(
    (a, b) => new Date(b.latestTime).getTime() - new Date(a.latestTime).getTime()
  )
}

function statusIsUnread(status: string) {
  return String(status || "").toLowerCase() === "unread"
}

function getThreadHref(thread: ThreadCard) {
  if (thread.hasConversation && thread.conversationId) {
    return `/admin/inbox/${thread.conversationId}`
  }

  return "/admin/inbox"
}

async function findTrevWorkerIds() {
  const workers = await prisma.worker.findMany({
    where: {
      OR: [
        {
          AND: [
            { firstName: { equals: "Trevor", mode: "insensitive" } },
            { lastName: { contains: "Fudger", mode: "insensitive" } },
          ],
        },
        {
          AND: [
            { firstName: { equals: "Trev", mode: "insensitive" } },
            { lastName: { contains: "Fudger", mode: "insensitive" } },
          ],
        },
        {
          email: { contains: "trevor.fudger", mode: "insensitive" },
        },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  })

  return workers.map((worker: any) => worker.id)
}

function JobSection({
  title,
  empty,
  jobs,
  accent,
}: {
  title: string
  empty: string
  jobs: JobCard[]
  accent: "yellow" | "blue"
}) {
  const accentClasses =
    accent === "yellow"
      ? "border-yellow-200 bg-yellow-50 text-yellow-900"
      : "border-blue-200 bg-blue-50 text-blue-900"

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-4 py-4">
        <h2 className="text-lg font-bold text-zinc-950">{title}</h2>
      </div>

      <div className="p-4">
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
            {empty}
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`rounded-2xl border p-4 ${accentClasses}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold">
                        {job.customer?.name || job.title || `Job #${job.id}`}
                      </h3>
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-black/10">
                        {cleanString(job.jobType) || "Job"}
                      </span>
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-black/10">
                        {cleanString(job.status) || "Open"}
                      </span>
                    </div>

                    {job.title && job.customer?.name !== job.title ? (
                      <p className="mt-1 text-sm opacity-90">{job.title}</p>
                    ) : null}

                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                          Date
                        </div>
                        <div>{formatDate(job.visitDate)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                          Time
                        </div>
                        <div>
                          {formatTime(job.startTime)}
                          {job.durationMinutes ? ` • ${formatDuration(job.durationMinutes)}` : ""}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                          Address
                        </div>
                        <div>{job.address || job.customer?.address || "—"}</div>
                      </div>

                      {job.notes ? (
                        <div className="sm:col-span-2">
                          <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                            Notes
                          </div>
                          <div className="whitespace-pre-wrap">{job.notes}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                    >
                      Open
                    </Link>

                    {job.customer?.phone ? (
                      <a
                        href={`tel:${job.customer.phone}`}
                        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                      >
                        Call
                      </a>
                    ) : null}

                    {job.customer?.postcode || job.address || job.customer?.address ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          job.customer?.postcode || job.address || job.customer?.address || ""
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                      >
                        Navigate
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default async function TrevPage() {
  const now = londonNow()
  const dayStart = startOfLondonDayUtc(now)
  const dayEnd = nextLondonDayUtc(now)

  const trevWorkerIds = await findTrevWorkerIds()

  const jobsRaw = trevWorkerIds.length
    ? await prisma.job.findMany({
        where: {
          visitDate: {
            gte: dayStart,
            lt: dayEnd,
          },
          status: {
            notIn: ["archived", "cancelled"],
          },
          assignments: {
            some: {
              workerId: {
                in: trevWorkerIds,
              },
            },
          },
        },
        include: {
          customer: true,
        },
        orderBy: [
          {
            startTime: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      })
    : []

  const jobs: JobCard[] = jobsRaw
  const quoteVisits = jobs.filter((job) => isQuoteJob(job))
  const installJobs = jobs.filter((job) => !isQuoteJob(job))

  const inboxMessages = (await prisma.inboxMessage.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
    include: {
      conversation: true,
    },
    where: {
      OR: [{ conversation: { archived: false } }, { conversation: null }],
    },
  })) as InboxMessageRow[]

  const allThreads = buildThreads(inboxMessages)
  const unreadThreads = allThreads.filter((thread) => statusIsUnread(thread.latestStatus))
  const recentThreads = allThreads.slice(0, 8)
  const workerQuoteThreads = allThreads.filter(
    (thread) => normaliseSource(thread.source) === "worker-quote"
  )
  const internalNeedsAction = workerQuoteThreads.filter((thread) =>
    statusIsUnread(thread.latestStatus)
  )

  return (
    <main className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-950 to-zinc-800 px-5 py-5 text-white shadow-xl sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-300">
                Trev dashboard
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Today + Admin</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                One place for Trev’s jobs, quote visits, inbox threads, and the bits that need attention.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/inbox"
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Open inbox
              </Link>
              <Link
                href="/jobs"
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                All jobs
              </Link>
              <Link
                href="/today"
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Worker today
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Time now
              </div>
              <div className="mt-1 text-2xl font-black">
                {new Intl.DateTimeFormat("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(now)}
              </div>
              <div className="mt-1 text-xs text-zinc-300">{formatDate(now)}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Jobs today
              </div>
              <div className="mt-1 text-2xl font-black">{installJobs.length}</div>
              <div className="mt-1 text-xs text-zinc-300">Non-quote work</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Quotes today
              </div>
              <div className="mt-1 text-2xl font-black">{quoteVisits.length}</div>
              <div className="mt-1 text-xs text-zinc-300">Visits for Trev</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Inbox unread
              </div>
              <div className="mt-1 text-2xl font-black">{unreadThreads.length}</div>
              <div className="mt-1 text-xs text-zinc-300">Needs reply</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Internal actions
              </div>
              <div className="mt-1 text-2xl font-black">{internalNeedsAction.length}</div>
              <div className="mt-1 text-xs text-zinc-300">Worker quote threads</div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6">
            <JobSection
              title="Today's jobs"
              empty="No Trev jobs booked for today."
              jobs={installJobs}
              accent="yellow"
            />

            <JobSection
              title="Today's quote visits"
              empty="No Trev quote visits booked for today."
              jobs={quoteVisits}
              accent="blue"
            />
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-4 py-4">
                <h2 className="text-lg font-bold text-zinc-950">Admin snapshot</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4">
                <Link
                  href="/admin/inbox?view=needs-reply"
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                    Needs reply
                  </div>
                  <div className="mt-1 text-2xl font-black text-amber-950">
                    {unreadThreads.length}
                  </div>
                </Link>

                <Link
                  href="/admin/inbox?source=worker-quote"
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 hover:bg-zinc-100"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-600">
                    Worker quotes
                  </div>
                  <div className="mt-1 text-2xl font-black text-zinc-950">
                    {workerQuoteThreads.length}
                  </div>
                </Link>

                <Link
                  href="/admin/inbox?source=furlads-email"
                  className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 hover:bg-yellow-100"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-yellow-700">
                    Furlads inbox
                  </div>
                  <div className="mt-1 text-2xl font-black text-yellow-950">
                    {
                      allThreads.filter(
                        (thread) => normaliseSource(thread.source) === "furlads-email"
                      ).length
                    }
                  </div>
                </Link>

                <Link
                  href="/admin/inbox?view=three-counties"
                  className="rounded-2xl border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                    Three Counties
                  </div>
                  <div className="mt-1 text-2xl font-black text-blue-950">
                    {
                      allThreads.filter((thread) => thread.businessLabel === "Three Counties")
                        .length
                    }
                  </div>
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4">
                <div>
                  <h2 className="text-lg font-bold text-zinc-950">Inbox</h2>
                  <p className="text-sm text-zinc-500">Latest threads across the business</p>
                </div>

                <Link
                  href="/admin/inbox"
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  View all
                </Link>
              </div>

              <div className="p-4">
                {recentThreads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                    No inbox threads yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentThreads.map((thread) => {
                      const isUnread = statusIsUnread(thread.latestStatus)

                      return (
                        <Link
                          key={thread.threadKey}
                          href={getThreadHref(thread)}
                          className="block rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-zinc-300 hover:bg-zinc-100"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div
                                  className={`truncate text-sm ${
                                    isUnread
                                      ? "font-bold text-zinc-950"
                                      : "font-semibold text-zinc-900"
                                  }`}
                                >
                                  {thread.displayName}
                                </div>

                                {isUnread ? (
                                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                                ) : null}

                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                                  {getReadableSourceName(thread.source)}
                                </span>

                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                                  {thread.messageCount} msg
                                </span>
                              </div>

                              <div className="mt-1 truncate text-xs text-zinc-500">
                                {thread.displayContact}
                              </div>

                              <p
                                className={`mt-2 line-clamp-2 text-sm ${
                                  isUnread ? "font-medium text-zinc-900" : "text-zinc-600"
                                }`}
                              >
                                {thread.latestPreview}
                              </p>
                            </div>

                            <div className="shrink-0 text-right text-[11px] text-zinc-500">
                              {formatDateTime(thread.latestTime)}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-4 py-4">
                <h2 className="text-lg font-bold text-zinc-950">Quick actions</h2>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <Link
                  href="/admin/inbox?source=worker-quote"
                  className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Open worker quotes
                </Link>

                <Link
                  href="/admin/inbox?view=needs-reply"
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  Open needs reply
                </Link>

                <Link
                  href="/jobs"
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  Open all jobs
                </Link>

                <Link
                  href="/admin/inbox"
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  Full admin inbox
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}