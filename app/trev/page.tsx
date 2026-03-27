import Link from "next/link"
import { redirect } from "next/navigation"
import * as prismaModule from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type SessionData = {
  workerId?: number
  workerName?: string
  workerAccessLevel?: string
}

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
  arrivedAt: Date | null
  pausedAt: Date | null
  finishedAt: Date | null
  customer: {
    id: number
    name: string
    phone: string | null
    email: string | null
    address: string | null
    postcode: string | null
  } | null
  assignments?: Array<{
    id: number
    workerId: number
    worker: {
      id: number
      firstName: string
      lastName: string
    }
  }>
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

type TeamLiveCard = {
  workerId: number
  workerName: string
  job: JobCard | null
  statusLabel: string
  statusTone: "green" | "yellow" | "blue" | "zinc"
  withWorkers: string[]
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—"
  return value
}

function formatClock(value: Date | null | undefined) {
  if (!value) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
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
  return new Date()
}

function getLondonDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  const weekday = parts.find((part) => part.type === "weekday")?.value

  if (!year || !month || !day || !weekday) {
    throw new Error("Failed to build London date parts")
  }

  return { year, month, day, weekday }
}

function startOfLondonDayUtc(date: Date) {
  const { year, month, day } = getLondonDateParts(date)
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`)
}

function nextLondonDayUtc(date: Date) {
  const start = startOfLondonDayUtc(date)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

function startOfLondonWeekUtc(date: Date) {
  const weekday = getLondonDateParts(date).weekday
  const start = startOfLondonDayUtc(date)

  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  }

  const offset = map[weekday] ?? 0
  return new Date(start.getTime() - offset * 24 * 60 * 60 * 1000)
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

function getStatusClasses(tone: TeamLiveCard["statusTone"]) {
  if (tone === "green") {
    return "bg-green-50 text-green-700 ring-green-200"
  }

  if (tone === "yellow") {
    return "bg-yellow-50 text-yellow-800 ring-yellow-200"
  }

  if (tone === "blue") {
    return "bg-blue-50 text-blue-700 ring-blue-200"
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200"
}

function buildTeamLiveCards(workers: any[]): TeamLiveCard[] {
  const cards: TeamLiveCard[] = []

  for (const worker of workers) {
    const jobs: JobCard[] = Array.isArray(worker.assignedJobs)
      ? worker.assignedJobs
          .map((assignment: any) => assignment.job)
          .filter(Boolean)
          .sort((a: JobCard, b: JobCard) => {
            const aStarted = a.arrivedAt && !a.finishedAt ? 0 : 1
            const bStarted = b.arrivedAt && !b.finishedAt ? 0 : 1

            if (aStarted !== bStarted) return aStarted - bStarted

            const aFinished = a.finishedAt ? 1 : 0
            const bFinished = b.finishedAt ? 1 : 0

            if (aFinished !== bFinished) return aFinished - bFinished

            const aTime = cleanString(a.startTime)
            const bTime = cleanString(b.startTime)

            return aTime.localeCompare(bTime)
          })
      : []

    const currentJob = jobs[0] || null

    if (!currentJob) {
      cards.push({
        workerId: worker.id,
        workerName:
          `${worker.firstName || ""} ${worker.lastName || ""}`.trim() || `Worker #${worker.id}`,
        job: null,
        statusLabel: "Free / no job showing",
        statusTone: "zinc",
        withWorkers: [],
      })
      continue
    }

    let statusLabel: TeamLiveCard["statusLabel"] = "Travelling"
    let statusTone: TeamLiveCard["statusTone"] = "blue"

    if (currentJob.finishedAt) {
      statusLabel = "Finished"
      statusTone = "zinc"
    } else if (currentJob.arrivedAt && currentJob.pausedAt && !currentJob.finishedAt) {
      statusLabel = "Paused"
      statusTone = "yellow"
    } else if (currentJob.arrivedAt && !currentJob.finishedAt) {
      statusLabel = "On site"
      statusTone = "green"
    } else {
      statusLabel = "Travelling"
      statusTone = "blue"
    }

    const withWorkers =
      currentJob.assignments
        ?.map((assignment) => assignment.worker)
        .filter((assignedWorker) => assignedWorker.id !== worker.id)
        .map((assignedWorker) => `${assignedWorker.firstName} ${assignedWorker.lastName}`.trim())
        .filter(Boolean) || []

    cards.push({
      workerId: worker.id,
      workerName:
        `${worker.firstName || ""} ${worker.lastName || ""}`.trim() || `Worker #${worker.id}`,
      job: currentJob,
      statusLabel,
      statusTone,
      withWorkers,
    })
  }

  return cards.sort((a, b) => a.workerName.localeCompare(b.workerName))
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
            {jobs.map((job) => {
              const withWorkers =
                job.assignments
                  ?.map((assignment) => `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim())
                  .filter(Boolean) || []

              return (
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

                        {withWorkers.length > 0 ? (
                          <div className="sm:col-span-2">
                            <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                              Team on this job
                            </div>
                            <div>{withWorkers.join(", ")}</div>
                          </div>
                        ) : null}

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
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

async function readSession(): Promise<SessionData | null> {
  const session = await getSession()

  if (!session?.workerId) {
    return null
  }

  return {
    workerId: Number(session.workerId),
    workerName: session.workerName,
    workerAccessLevel: session.role,
  }
}

export default async function TrevPage() {
  const session = await readSession()

  if (!session?.workerId) {
    redirect("/login")
  }

  const now = londonNow()
  const dayStart = startOfLondonDayUtc(now)
  const dayEnd = nextLondonDayUtc(now)
  const weekStart = startOfLondonWeekUtc(now)

  const myJobsRaw = await prisma.job.findMany({
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
          workerId: session.workerId,
        },
      },
    },
    select: {
      id: true,
      title: true,
      jobType: true,
      status: true,
      visitDate: true,
      startTime: true,
      durationMinutes: true,
      address: true,
      notes: true,
      createdAt: true,
      arrivedAt: true,
      pausedAt: true,
      finishedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          postcode: true,
        },
      },
      assignments: {
        select: {
          id: true,
          workerId: true,
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
  })

  const myJobs: JobCard[] = myJobsRaw
  const myQuoteVisits = myJobs.filter((job) => isQuoteJob(job))
  const myAssignedJobs = myJobs.filter((job) => !isQuoteJob(job))

  const teamWorkersRaw = await prisma.worker.findMany({
    where: {
      active: true,
    },
    include: {
      assignedJobs: {
        where: {
          job: {
            visitDate: {
              gte: dayStart,
              lt: dayEnd,
            },
            status: {
              notIn: ["archived", "cancelled"],
            },
          },
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              jobType: true,
              status: true,
              visitDate: true,
              startTime: true,
              durationMinutes: true,
              address: true,
              notes: true,
              createdAt: true,
              arrivedAt: true,
              pausedAt: true,
              finishedAt: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  email: true,
                  address: true,
                  postcode: true,
                },
              },
              assignments: {
                select: {
                  id: true,
                  workerId: true,
                  worker: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  })

  const teamLive = buildTeamLiveCards(teamWorkersRaw)
  const activeTeamCount = teamLive.filter((card) => card.job && card.statusLabel !== "Finished").length
  const needsAttention = teamLive.filter((card) => card.statusLabel === "Paused").length

  const inboxMessages = (await prisma.inboxMessage.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 250,
    include: {
      conversation: true,
    },
    where: {
      OR: [{ conversation: { archived: false } }, { conversation: null }],
    },
  })) as InboxMessageRow[]

  const allThreads = buildThreads(inboxMessages)
  const unreadThreads = allThreads.filter((thread) => statusIsUnread(thread.latestStatus))
  const workerQuoteThreads = allThreads.filter(
    (thread) => normaliseSource(thread.source) === "worker-quote"
  )
  const trevInboxThreads = allThreads
    .filter(
      (thread) =>
        statusIsUnread(thread.latestStatus) ||
        normaliseSource(thread.source) === "worker-quote"
    )
    .slice(0, 8)

  const jobsCompletedToday = await prisma.job.count({
    where: {
      finishedAt: {
        gte: dayStart,
        lt: dayEnd,
      },
      status: {
        notIn: ["archived", "cancelled"],
      },
    },
  })

  const jobsCompletedThisWeek = await prisma.job.count({
    where: {
      finishedAt: {
        gte: weekStart,
        lt: dayEnd,
      },
      status: {
        notIn: ["archived", "cancelled"],
      },
    },
  })

  const quotesThisWeek = await prisma.job.count({
    where: {
      visitDate: {
        gte: weekStart,
        lt: dayEnd,
      },
      status: {
        notIn: ["archived", "cancelled"],
      },
      OR: [{ jobType: "Quote" }, { title: "Quote" }],
    },
  })

  const enquiriesThisWeek = await prisma.inboxMessage.count({
    where: {
      createdAt: {
        gte: weekStart,
        lt: dayEnd,
      },
    },
  })

  return (
    <main className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-950 to-zinc-800 px-5 py-5 text-white shadow-xl sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-300">
                Trev dashboard
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Owner overview</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                Your day, the team live board, quotes, inbox, and business pulse in one place.
              </p>
              <div className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200 ring-1 ring-inset ring-white/10">
                Logged in as: {session.workerName || `Worker #${session.workerId}`}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/jobs"
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                All jobs
              </Link>
              <Link
                href="/admin/inbox"
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Inbox
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
                Team active
              </div>
              <div className="mt-1 text-2xl font-black">{activeTeamCount}</div>
              <div className="mt-1 text-xs text-zinc-300">Live on today’s work</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Jobs today
              </div>
              <div className="mt-1 text-2xl font-black">{myAssignedJobs.length}</div>
              <div className="mt-1 text-xs text-zinc-300">Assigned to you</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Quotes today
              </div>
              <div className="mt-1 text-2xl font-black">{myQuoteVisits.length}</div>
              <div className="mt-1 text-xs text-zinc-300">Your quote visits</div>
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
                Needs attention
              </div>
              <div className="mt-1 text-2xl font-black">{needsAttention}</div>
              <div className="mt-1 text-xs text-zinc-300">Paused team jobs</div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <JobSection
              title="Your jobs today"
              empty="No jobs assigned to your login for today."
              jobs={myAssignedJobs}
              accent="yellow"
            />

            <JobSection
              title="Your quote visits"
              empty="No quote visits assigned to your login for today."
              jobs={myQuoteVisits}
              accent="blue"
            />
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-4 py-4">
                <h2 className="text-lg font-bold text-zinc-950">Team live board</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  See where everyone is and who’s together on the same job.
                </p>
              </div>

              <div className="space-y-3 p-4">
                {teamLive.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                    No team activity showing for today yet.
                  </div>
                ) : (
                  teamLive.map((card) => (
                    <div
                      key={card.workerId}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-bold text-zinc-950">
                              {card.workerName}
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${getStatusClasses(
                                card.statusTone
                              )}`}
                            >
                              {card.statusLabel}
                            </span>
                          </div>

                          {card.job ? (
                            <>
                              <div className="mt-2 text-sm font-semibold text-zinc-900">
                                {card.job.customer?.name || card.job.title || `Job #${card.job.id}`}
                              </div>

                              <div className="mt-1 text-sm text-zinc-600">
                                {card.job.address || card.job.customer?.address || "—"}
                              </div>

                              <div className="mt-2 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
                                <div>
                                  Start: {formatTime(card.job.startTime)}
                                </div>
                                <div>
                                  Arrived: {formatClock(card.job.arrivedAt)}
                                </div>
                              </div>

                              {card.withWorkers.length > 0 ? (
                                <div className="mt-2 text-sm text-zinc-700">
                                  <span className="font-semibold">With:</span>{" "}
                                  {card.withWorkers.join(", ")}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="mt-2 text-sm text-zinc-600">
                              No current job assigned today.
                            </div>
                          )}
                        </div>

                        {card.job ? (
                          <Link
                            href={`/jobs/${card.job.id}`}
                            className="shrink-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
                          >
                            Open
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-4 py-4">
                <h2 className="text-lg font-bold text-zinc-950">Quotes & inbox</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Filtered for the things Trev is most likely to care about.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4">
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
              </div>

              <div className="space-y-3 px-4 pb-4">
                {trevInboxThreads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                    Nothing urgent in inbox right now.
                  </div>
                ) : (
                  trevInboxThreads.map((thread) => {
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
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-4 py-4">
                <h2 className="text-lg font-bold text-zinc-950">Performance snapshot</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4">
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-green-700">
                    Completed today
                  </div>
                  <div className="mt-1 text-2xl font-black text-green-950">
                    {jobsCompletedToday}
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                    Completed this week
                  </div>
                  <div className="mt-1 text-2xl font-black text-blue-950">
                    {jobsCompletedThisWeek}
                  </div>
                </div>

                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-yellow-700">
                    Quotes this week
                  </div>
                  <div className="mt-1 text-2xl font-black text-yellow-950">
                    {quotesThisWeek}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-600">
                    Enquiries this week
                  </div>
                  <div className="mt-1 text-2xl font-black text-zinc-950">
                    {enquiriesThisWeek}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}