import Link from "next/link"
import SourceBadge from "@/components/admin/SourceBadge"
import ArchiveThreadButton from "@/components/admin/ArchiveThreadButton"
import * as prismaModule from "@/lib/prisma"
import { buildContactKey } from "@/lib/inbox/contactKey"

export const dynamic = "force-dynamic"

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type InboxMessageRow = {
  id: number
  conversationId: string
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function normaliseSource(
  value: string
):
  | "whatsapp"
  | "furlads-email"
  | "threecounties-email"
  | "facebook"
  | "wix"
  | "worker-quote" {
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

function getSourceLabel(source: string) {
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

function ThreadStatusPill({ status }: { status: string }) {
  const normalised = String(status || "").toLowerCase()

  if (normalised === "unread") {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
        Needs reply
      </span>
    )
  }

  if (normalised === "replied") {
    return (
      <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700 ring-1 ring-inset ring-green-200">
        Replied
      </span>
    )
  }

  if (normalised === "customer_created") {
    return (
      <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 ring-1 ring-inset ring-purple-200">
        Customer created
      </span>
    )
  }

  if (normalised === "job_created") {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
        Job created
      </span>
    )
  }

  return (
    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
      Open
    </span>
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
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${className}`}
    >
      {label}
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
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ring-inset ${className}`}
    >
      {initial}
    </div>
  )
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

    const sourceLabels = Array.from(
      new Set(sorted.map((item) => getSourceLabel(item.source)))
    )

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
      sourceLabels,
      hasConversation: Boolean(latest.conversationId),
    })
  }

  return threads.sort(
    (a, b) => new Date(b.latestTime).getTime() - new Date(a.latestTime).getTime()
  )
}

export default async function AdminInboxPage() {
  let messages: InboxMessageRow[] = []
  let databaseReady = true
  let errorMessage = ""

  try {
    messages = (await prisma.inboxMessage.findMany({
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
  } catch (error) {
    databaseReady = false
    errorMessage =
      error instanceof Error
        ? error.message
        : "Inbox messages are not ready yet."
  }

  const threads = buildThreads(messages)
  const unreadThreads = threads.filter((thread) => statusIsUnread(thread.latestStatus))
  const furladsThreads = threads.filter((thread) => thread.businessLabel === "Furlads")
  const threeCountiesThreads = threads.filter(
    (thread) => thread.businessLabel === "Three Counties"
  )

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
              Unified inbox
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              Conversations
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">
              Latest message first, cleaner thread view, and ready for a dashboard
              needs-reply widget.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/inbox/connections"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800"
            >
              Connections
            </Link>
          </div>
        </div>
      </section>

      {!databaseReady && (
        <section className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
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

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Main threads
          </div>
          <div className="mt-2 text-3xl font-bold">{threads.length}</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Needs reply
          </div>
          <div className="mt-2 text-3xl font-bold">{unreadThreads.length}</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Furlads
          </div>
          <div className="mt-2 text-3xl font-bold">{furladsThreads.length}</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Three Counties
          </div>
          <div className="mt-2 text-3xl font-bold">{threeCountiesThreads.length}</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-base font-bold">Threads</h3>
            <p className="text-xs text-zinc-500">Newest conversations at the top</p>
          </div>
        </div>

        {!databaseReady ? null : threads.length === 0 ? (
          <div className="p-4">
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
              No inbox threads yet.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {threads.map((thread) => {
              const href = getThreadHref(thread)
              const isUnread = statusIsUnread(thread.latestStatus)

              return (
                <div
                  key={thread.threadKey}
                  className="group relative transition-colors hover:bg-zinc-50"
                >
                  <div className="flex items-start gap-3 px-4 py-4">
                    <ThreadAvatar
                      displayName={thread.displayName}
                      businessLabel={thread.businessLabel}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4
                              className={`truncate text-sm ${
                                isUnread ? "font-bold text-zinc-950" : "font-semibold text-zinc-900"
                              }`}
                            >
                              {thread.displayName}
                            </h4>

                            {isUnread ? (
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                            ) : null}
                          </div>

                          <div className="mt-0.5 truncate text-sm text-zinc-500">
                            {thread.displayContact}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div
                            className={`text-xs ${
                              isUnread ? "font-semibold text-zinc-800" : "text-zinc-500"
                            }`}
                          >
                            {formatDateTime(thread.latestTime)}
                          </div>

                          <div className="mt-2 hidden justify-end gap-2 md:flex">
                            {thread.hasConversation ? (
                              <ArchiveThreadButton conversationId={thread.conversationId} />
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <SourceBadge source={normaliseSource(thread.source)} compact />
                        <BusinessBadge label={thread.businessLabel} />
                        <ThreadStatusPill status={thread.latestStatus} />

                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                          {thread.messageCount} message{thread.messageCount === 1 ? "" : "s"}
                        </span>

                        {thread.customerId ? (
                          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 ring-1 ring-inset ring-purple-200">
                            Customer #{thread.customerId}
                          </span>
                        ) : null}

                        {thread.jobId ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            Job #{thread.jobId}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-start gap-2">
                        <p
                          className={`min-w-0 flex-1 truncate text-sm ${
                            isUnread ? "font-medium text-zinc-900" : "text-zinc-600"
                          }`}
                        >
                          {thread.latestPreview}
                        </p>

                        <Link
                          href={href}
                          className="shrink-0 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                        >
                          Open
                        </Link>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 md:hidden">
                        {thread.hasConversation ? (
                          <ArchiveThreadButton conversationId={thread.conversationId} />
                        ) : null}
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