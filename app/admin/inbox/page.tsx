import Link from "next/link"
import ArchiveThreadButton from "@/components/admin/ArchiveThreadButton"
import * as prismaModule from "@/lib/prisma"
import { buildContactKey } from "@/lib/inbox/contactKey"

export const dynamic = "force-dynamic"

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type InboxSource =
  | "whatsapp"
  | "furlads-email"
  | "threecounties-email"
  | "facebook"
  | "wix"
  | "worker-quote"

type InboxView = "all" | "needs-reply" | "furlads" | "three-counties"

type PageProps = {
  searchParams?: {
    source?: string
    view?: string
    q?: string
  }
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
  source: string
  businessLabel: string
  displayName: string
  displayContact: string
  latestPreview: string
  latestTime: Date
  latestStatus: string
  messageCount: number
  latestMessageId: number
  customerId: number | null
  jobId: number | null
  hasConversation: boolean
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

function normaliseSource(value: string): InboxSource {
  const source = String(value || "").toLowerCase()

  if (source.includes("threecounties")) return "threecounties-email"
  if (source.includes("furlads")) return "furlads-email"
  if (source.includes("whatsapp")) return "whatsapp"
  if (source.includes("facebook")) return "facebook"
  if (source.includes("wix")) return "wix"
  return "worker-quote"
}

function getReadableSourceName(source: InboxSource) {
  if (source === "threecounties-email") return "Three Counties Email"
  if (source === "furlads-email") return "Furlads Email"
  if (source === "whatsapp") return "WhatsApp"
  if (source === "facebook") return "Facebook"
  if (source === "wix") return "Wix"
  return "Worker Quote"
}

function getReadableViewName(view: InboxView) {
  if (view === "needs-reply") return "Needs reply"
  if (view === "furlads") return "Furlads"
  if (view === "three-counties") return "Three Counties"
  return "Main threads"
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
  const contactKey = buildContactKey({
    senderPhone: message.senderPhone,
    senderEmail: message.senderEmail,
    contactRef: message.conversation?.contactRef ?? null,
    conversationId: message.conversationId ?? null,
  })

  if (contactKey) return contactKey

  return message.conversationId || `message-${message.id}`
}

function getThreadHref(thread: ThreadCard) {
  if (thread.hasConversation && thread.conversationId) {
    return `/admin/inbox/${thread.conversationId}`
  }

  return "/admin/inbox"
}

function statusIsUnread(status: string) {
  return String(status || "").toLowerCase() === "unread"
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
      source: latest.source,
      businessLabel: detectBusinessLabel(latest),
      displayName: buildDisplayName(latest),
      displayContact: buildDisplayContact(latest),
      latestPreview: buildPreview(latest),
      latestTime: latest.createdAt,
      latestStatus: latest.status,
      messageCount: sorted.length,
      latestMessageId: latest.id,
      customerId: latest.customerId,
      jobId: latest.jobId,
      hasConversation: Boolean(latest.conversationId),
    })
  }

  return threads.sort(
    (a, b) => new Date(b.latestTime).getTime() - new Date(a.latestTime).getTime()
  )
}

function parseSourceFilter(value: string | undefined): InboxSource | null {
  const raw = String(value || "").trim().toLowerCase()

  if (!raw) return null
  if (raw === "whatsapp") return "whatsapp"
  if (raw === "furlads-email") return "furlads-email"
  if (raw === "threecounties-email") return "threecounties-email"
  if (raw === "facebook") return "facebook"
  if (raw === "wix") return "wix"
  if (raw === "worker-quote") return "worker-quote"

  return null
}

function parseViewFilter(value: string | undefined): InboxView {
  const raw = String(value || "").trim().toLowerCase()

  if (raw === "needs-reply") return "needs-reply"
  if (raw === "furlads") return "furlads"
  if (raw === "three-counties") return "three-counties"
  return "all"
}

function normaliseSearch(value: string | undefined) {
  return String(value || "").trim()
}

function threadMatchesSearch(thread: ThreadCard, q: string) {
  const needle = q.toLowerCase()

  return [
    thread.displayName,
    thread.displayContact,
    thread.latestPreview,
    thread.businessLabel,
    getReadableSourceName(normaliseSource(thread.source)),
    thread.customerId ? `customer ${thread.customerId}` : "",
    thread.jobId ? `job ${thread.jobId}` : "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle)
}

function buildInboxHref({
  source,
  view,
  q,
}: {
  source?: InboxSource | null
  view?: InboxView
  q?: string
}) {
  const params = new URLSearchParams()

  if (source) {
    params.set("source", source)
  }

  if (view && view !== "all") {
    params.set("view", view)
  }

  if (q && q.trim()) {
    params.set("q", q.trim())
  }

  const query = params.toString()
  return query ? `/admin/inbox?${query}` : "/admin/inbox"
}

function SummaryCard({
  label,
  value,
  href,
  active,
}: {
  label: string
  value: number
  href: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border px-3 py-3 shadow-sm transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-950 hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <div
        className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
          active ? "text-zinc-200" : "text-zinc-500"
        }`}
      >
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{value}</div>
    </Link>
  )
}

function BusinessBadge({ label }: { label: string }) {
  const map: Record<string, string> = {
    Furlads: "bg-yellow-50 text-yellow-800 ring-yellow-200",
    "Three Counties": "bg-blue-50 text-blue-700 ring-blue-200",
    Internal: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  }

  const className = map[label] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200"

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  )
}

function ThreadStatusPill({ status }: { status: string }) {
  const normalised = String(status || "").toLowerCase()

  if (normalised === "unread") {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
        Needs reply
      </span>
    )
  }

  if (normalised === "replied") {
    return (
      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-inset ring-green-200">
        Replied
      </span>
    )
  }

  if (normalised === "customer_created") {
    return (
      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 ring-1 ring-inset ring-purple-200">
        Customer
      </span>
    )
  }

  if (normalised === "job_created") {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
        Job
      </span>
    )
  }

  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
      Open
    </span>
  )
}

function ThreadAvatar({
  displayName,
  businessLabel,
}: {
  displayName: string
  businessLabel: string
}) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "?"

  const className =
    businessLabel === "Three Counties"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : businessLabel === "Internal"
        ? "bg-zinc-100 text-zinc-700 ring-zinc-200"
        : "bg-yellow-50 text-yellow-800 ring-yellow-200"

  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset sm:h-11 sm:w-11 ${className}`}
    >
      {initial}
    </div>
  )
}

function SourceIcon({
  source,
  businessLabel,
}: {
  source: InboxSource
  businessLabel: string
}) {
  const baseClass =
    "inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ring-1 ring-inset"

  if (source === "facebook") {
    if (businessLabel === "Three Counties") {
      return <span className={`${baseClass} bg-blue-50 text-blue-700 ring-blue-200`}>f</span>
    }

    return <span className={`${baseClass} bg-yellow-50 text-yellow-800 ring-yellow-200`}>f</span>
  }

  if (source === "whatsapp") {
    return <span className={`${baseClass} bg-green-50 text-green-700 ring-green-200`}>wa</span>
  }

  if (source === "furlads-email" || source === "threecounties-email") {
    if (businessLabel === "Three Counties") {
      return <span className={`${baseClass} bg-blue-50 text-blue-700 ring-blue-200`}>@</span>
    }

    return <span className={`${baseClass} bg-orange-50 text-orange-700 ring-orange-200`}>@</span>
  }

  if (source === "wix") {
    return <span className={`${baseClass} bg-cyan-50 text-cyan-700 ring-cyan-200`}>w</span>
  }

  return <span className={`${baseClass} bg-zinc-100 text-zinc-700 ring-zinc-200`}>i</span>
}

function SourceMiniBadge({
  source,
  businessLabel,
}: {
  source: InboxSource
  businessLabel: string
}) {
  const readable = getReadableSourceName(source)

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
      <SourceIcon source={source} businessLabel={businessLabel} />
      <span>{readable}</span>
    </span>
  )
}

export default async function AdminInboxPage({ searchParams }: PageProps) {
  let messages: InboxMessageRow[] = []
  let databaseReady = true
  let errorMessage = ""

  const sourceFilter = parseSourceFilter(searchParams?.source)
  const viewFilter = parseViewFilter(searchParams?.view)
  const searchQuery = normaliseSearch(searchParams?.q)

  try {
    messages = (await prisma.inboxMessage.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 300,
      include: {
        conversation: true,
      },
      where: {
        OR: [{ conversation: { archived: false } }, { conversation: null }],
      },
    })) as InboxMessageRow[]
  } catch (error) {
    databaseReady = false
    errorMessage =
      error instanceof Error
        ? error.message
        : "Inbox messages are not ready yet."
  }

  const sourceFilteredMessages = sourceFilter
    ? messages.filter((message) => normaliseSource(message.source) === sourceFilter)
    : messages

  const allThreads = buildThreads(sourceFilteredMessages)
  const unreadThreads = allThreads.filter((thread) => statusIsUnread(thread.latestStatus))
  const furladsThreads = allThreads.filter((thread) => thread.businessLabel === "Furlads")
  const threeCountiesThreads = allThreads.filter(
    (thread) => thread.businessLabel === "Three Counties"
  )

  const viewThreads =
    viewFilter === "needs-reply"
      ? unreadThreads
      : viewFilter === "furlads"
        ? furladsThreads
        : viewFilter === "three-counties"
          ? threeCountiesThreads
          : allThreads

  const threads = searchQuery
    ? viewThreads.filter((thread) => threadMatchesSearch(thread, searchQuery))
    : viewThreads

  return (
    <div className="space-y-3 px-0 sm:px-0">
      <section className="rounded-xl border border-zinc-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Unified inbox
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">
              Conversations
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Compact thread list with cleaner source icons, quick filters, and keyword search.
            </p>

            {sourceFilter || viewFilter !== "all" || searchQuery ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Filters
                </span>

                {sourceFilter ? (
                  <SourceMiniBadge source={sourceFilter} businessLabel="Furlads" />
                ) : null}

                {viewFilter !== "all" ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                    {getReadableViewName(viewFilter)}
                  </span>
                ) : null}

                {searchQuery ? (
                  <span className="max-w-full truncate rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                    Search: {searchQuery}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {sourceFilter || viewFilter !== "all" || searchQuery ? (
              <Link
                href="/admin/inbox"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
              >
                Clear filters
              </Link>
            ) : null}

            <Link
              href="/admin/inbox/connections"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
            >
              Connections
            </Link>
          </div>
        </div>

        <form method="GET" className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            {sourceFilter ? <input type="hidden" name="source" value={sourceFilter} /> : null}
            {viewFilter !== "all" ? <input type="hidden" name="view" value={viewFilter} /> : null}

            <input
              type="text"
              name="q"
              defaultValue={searchQuery}
              placeholder="Search name, email, phone, message text..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-500"
            />

            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Search
            </button>
          </div>
        </form>
      </section>

      {!databaseReady && (
        <section className="rounded-xl border border-yellow-300 bg-yellow-50 p-4">
          <div className="font-semibold text-yellow-800">
            Inbox database is not ready yet
          </div>
          <div className="mt-1 text-sm text-yellow-700">
            This page could not load the inbox messages from Prisma.
          </div>
          <div className="mt-3 break-words text-xs text-yellow-700">
            Technical error: {errorMessage}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <SummaryCard
          label="Main threads"
          value={allThreads.length}
          href={buildInboxHref({ source: sourceFilter, view: "all", q: searchQuery })}
          active={viewFilter === "all"}
        />
        <SummaryCard
          label="Needs reply"
          value={unreadThreads.length}
          href={buildInboxHref({ source: sourceFilter, view: "needs-reply", q: searchQuery })}
          active={viewFilter === "needs-reply"}
        />
        <SummaryCard
          label="Furlads"
          value={furladsThreads.length}
          href={buildInboxHref({ source: sourceFilter, view: "furlads", q: searchQuery })}
          active={viewFilter === "furlads"}
        />
        <SummaryCard
          label="Three Counties"
          value={threeCountiesThreads.length}
          href={buildInboxHref({
            source: sourceFilter,
            view: "three-counties",
            q: searchQuery,
          })}
          active={viewFilter === "three-counties"}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-base font-bold text-zinc-950">Threads</h3>
            <p className="text-xs text-zinc-500">
              {viewFilter === "all"
                ? "Newest first, tighter mobile layout"
                : `${getReadableViewName(viewFilter)} threads`}
            </p>
          </div>
        </div>

        {!databaseReady ? null : threads.length === 0 ? (
          <div className="p-4">
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
              {sourceFilter || viewFilter !== "all" || searchQuery
                ? "No inbox threads match the current filters yet."
                : "No inbox threads yet."}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {threads.map((thread) => {
              const href = getThreadHref(thread)
              const isUnread = statusIsUnread(thread.latestStatus)
              const source = normaliseSource(thread.source)

              return (
                <div
                  key={thread.threadKey}
                  className="group relative transition-colors hover:bg-zinc-50"
                >
                  <div className="flex items-start gap-3 px-3 py-3 sm:px-4 sm:py-4">
                    <ThreadAvatar
                      displayName={thread.displayName}
                      businessLabel={thread.businessLabel}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4
                              className={`truncate text-sm sm:text-[15px] ${
                                isUnread ? "font-bold text-zinc-950" : "font-semibold text-zinc-900"
                              }`}
                            >
                              {thread.displayName}
                            </h4>

                            {isUnread ? (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                            ) : null}
                          </div>

                          <div className="mt-0.5 truncate text-xs text-zinc-500">
                            {thread.displayContact}
                          </div>
                        </div>

                        <div className="shrink-0 pl-2 text-right">
                          <div
                            className={`text-[11px] whitespace-nowrap ${
                              isUnread ? "font-semibold text-zinc-800" : "text-zinc-500"
                            }`}
                          >
                            {formatDateTime(thread.latestTime)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <SourceMiniBadge source={source} businessLabel={thread.businessLabel} />
                        <BusinessBadge label={thread.businessLabel} />
                        <ThreadStatusPill status={thread.latestStatus} />

                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                          {thread.messageCount} msg
                        </span>

                        {thread.customerId ? (
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 ring-1 ring-inset ring-purple-200">
                            Customer #{thread.customerId}
                          </span>
                        ) : null}

                        {thread.jobId ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            Job #{thread.jobId}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2">
                        <p
                          className={`line-clamp-2 text-sm ${
                            isUnread ? "font-medium text-zinc-900" : "text-zinc-600"
                          }`}
                        >
                          {thread.latestPreview}
                        </p>
                      </div>

                      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
                        {thread.hasConversation ? (
                          <ArchiveThreadButton conversationId={thread.conversationId} />
                        ) : null}

                        <Link
                          href={href}
                          className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={href}
                    className="absolute inset-0 z-0"
                    aria-label={`Open thread for ${thread.displayName}`}
                  />
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}