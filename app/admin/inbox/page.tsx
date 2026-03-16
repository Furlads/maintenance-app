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
  sourceLabels: string[]
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

function getBusinessLabel(source: string) {
  const normalised = normaliseSource(source)

  if (normalised === "threecounties-email") return "Three Counties"
  if (normalised === "worker-quote") return "Internal"
  return "Furlads"
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
      businessLabel: getBusinessLabel(latest.source),
      displayName: buildDisplayName(latest),
      displayContact: buildDisplayContact(latest),
      latestPreview: buildPreview(latest),
      latestTime: latest.createdAt,
      latestStatus: latest.status,
      messageCount: sorted.length,
      latestMessageId: latest.id,
      customerId: latest.customerId,
      jobId: latest.jobId,
      sourceLabels: [],
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

function buildInboxHref({
  source,
  view,
}: {
  source?: InboxSource | null
  view?: InboxView
}) {
  const params = new URLSearchParams()

  if (source) {
    params.set("source", source)
  }

  if (view && view !== "all") {
    params.set("view", view)
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
      className={`rounded-xl border px-4 py-3 shadow-sm transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-950 hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <div
        className={`text-[11px] font-bold uppercase tracking-[0.16em] ${
          active ? "text-zinc-200" : "text-zinc-500"
        }`}
      >
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
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
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset ${className}`}
    >
      {initial}
    </div>
  )
}

function SourceIcon({
  source,
}: {
  source: InboxSource
}) {
  const baseClass =
    "inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ring-1 ring-inset"

  if (source === "facebook") {
    return <span className={`${baseClass} bg-blue-50 text-blue-700 ring-blue-200`}>f</span>
  }

  if (source === "whatsapp") {
    return <span className={`${baseClass} bg-green-50 text-green-700 ring-green-200`}>wa</span>
  }

  if (source === "furlads-email" || source === "threecounties-email") {
    return <span className={`${baseClass} bg-orange-50 text-orange-700 ring-orange-200`}>@</span>
  }

  if (source === "wix") {
    return <span className={`${baseClass} bg-cyan-50 text-cyan-700 ring-cyan-200`}>w</span>
  }

  return <span className={`${baseClass} bg-zinc-100 text-zinc-700 ring-zinc-200`}>i</span>
}

function SourceMiniBadge({ source }: { source: InboxSource }) {
  const readable = getReadableSourceName(source)

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
      <SourceIcon source={source} />
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

  const sourceFilteredThreads = buildThreads(sourceFilteredMessages)
  const unreadThreads = sourceFilteredThreads.filter((thread) =>
    statusIsUnread(thread.latestStatus)
  )
  const furladsThreads = sourceFilteredThreads.filter(
    (thread) => thread.businessLabel === "Furlads"
  )
  const threeCountiesThreads = sourceFilteredThreads.filter(
    (thread) => thread.businessLabel === "Three Counties"
  )

  const threads =
    viewFilter === "needs-reply"
      ? unreadThreads
      : viewFilter === "furlads"
        ? furladsThreads
        : viewFilter === "three-counties"
          ? threeCountiesThreads
          : sourceFilteredThreads

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Unified inbox
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
              Conversations
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Compact thread list with cleaner source icons and less wasted space.
            </p>

            {(sourceFilter || viewFilter !== "all") ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Filters
                </span>

                {sourceFilter ? <SourceMiniBadge source={sourceFilter} /> : null}

                {viewFilter !== "all" ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                    {getReadableViewName(viewFilter)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {sourceFilter || viewFilter !== "all" ? (
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
          value={sourceFilteredThreads.length}
          href={buildInboxHref({ source: sourceFilter, view: "all" })}
          active={viewFilter === "all"}
        />
        <SummaryCard
          label="Needs reply"
          value={unreadThreads.length}
          href={buildInboxHref({ source: sourceFilter, view: "needs-reply" })}
          active={viewFilter === "needs-reply"}
        />
        <SummaryCard
          label="Furlads"
          value={furladsThreads.length}
          href={buildInboxHref({ source: sourceFilter, view: "furlads" })}
          active={viewFilter === "furlads"}
        />
        <SummaryCard
          label="Three Counties"
          value={threeCountiesThreads.length}
          href={buildInboxHref({ source: sourceFilter, view: "three-counties" })}
          active={viewFilter === "three-counties"}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-base font-bold text-zinc-950">Threads</h3>
            <p className="text-xs text-zinc-500">
              {viewFilter === "all"
                ? "Newest first, tighter layout"
                : `${getReadableViewName(viewFilter)} threads`}
            </p>
          </div>
        </div>

        {!databaseReady ? null : threads.length === 0 ? (
          <div className="p-4">
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
              {sourceFilter || viewFilter !== "all"
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
                  <div className="flex items-start gap-3 px-4 py-3">
                    <ThreadAvatar
                      displayName={thread.displayName}
                      businessLabel={thread.businessLabel}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4
                              className={`truncate text-sm ${
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

                        <div className="shrink-0 text-right">
                          <div
                            className={`text-[11px] ${
                              isUnread ? "font-semibold text-zinc-800" : "text-zinc-500"
                            }`}
                          >
                            {formatDateTime(thread.latestTime)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <SourceMiniBadge source={source} />
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

                      <div className="mt-2 flex items-center gap-2">
                        <p
                          className={`min-w-0 flex-1 truncate text-sm ${
                            isUnread ? "font-medium text-zinc-900" : "text-zinc-600"
                          }`}
                        >
                          {thread.latestPreview}
                        </p>

                        <div className="relative z-10 hidden items-center gap-2 md:flex">
                          {thread.hasConversation ? (
                            <ArchiveThreadButton conversationId={thread.conversationId} />
                          ) : null}

                          <Link
                            href={href}
                            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                          >
                            Open
                          </Link>
                        </div>
                      </div>

                      <div className="relative z-10 mt-2 flex flex-wrap items-center gap-2 md:hidden">
                        {thread.hasConversation ? (
                          <ArchiveThreadButton conversationId={thread.conversationId} />
                        ) : null}

                        <Link
                          href={href}
                          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
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