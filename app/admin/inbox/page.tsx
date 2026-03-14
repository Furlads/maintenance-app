import Link from "next/link"
import SourceBadge from "@/components/admin/SourceBadge"
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
  if (message.preview && message.preview.trim()) return message.preview.trim()
  if (message.subject && message.subject.trim()) return message.subject.trim()
  if (message.body && message.body.trim()) return message.body.trim()
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    unread: "bg-amber-50 text-amber-700 ring-amber-200",
    open: "bg-blue-50 text-blue-700 ring-blue-200",
    replied: "bg-green-50 text-green-700 ring-green-200",
    customer_created: "bg-purple-50 text-purple-700 ring-purple-200",
    job_created: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  }

  const className =
    map[String(status || "").toLowerCase()] ??
    "bg-zinc-100 text-zinc-700 ring-zinc-200"

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${className}`}
    >
      {String(status || "open").replace(/_/g, " ")}
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
    })) as InboxMessageRow[]
  } catch (error) {
    databaseReady = false
    errorMessage =
      error instanceof Error
        ? error.message
        : "Inbox messages are not ready yet."
  }

  const threads = buildThreads(messages)

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
              Unified inbox
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              Main threads first
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">
              One main thread per contact where possible, newest first, with source and
              business tags for quick office scanning.
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
          <div className="mt-3 text-xs break-words text-yellow-700">
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
            Unread threads
          </div>
          <div className="mt-2 text-3xl font-bold">
            {
              threads.filter(
                (thread) => String(thread.latestStatus).toLowerCase() === "unread"
              ).length
            }
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Furlads
          </div>
          <div className="mt-2 text-3xl font-bold">
            {threads.filter((thread) => thread.businessLabel === "Furlads").length}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Three Counties
          </div>
          <div className="mt-2 text-3xl font-bold">
            {
              threads.filter(
                (thread) => thread.businessLabel === "Three Counties"
              ).length
            }
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-base font-bold">Threads</h3>
            <p className="text-xs text-zinc-500">
              Newest conversations at the top
            </p>
          </div>
        </div>

        <div className="p-3">
          {!databaseReady ? null : threads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
              No inbox threads yet.
            </div>
          ) : (
            <div className="space-y-3">
              {threads.map((thread) => (
                <details
                  key={thread.threadKey}
                  className="rounded-2xl border border-zinc-200 bg-white"
                >
                  <summary className="cursor-pointer list-none p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <SourceBadge
                            source={normaliseSource(thread.source)}
                            compact
                          />
                          <BusinessBadge label={thread.businessLabel} />
                          <StatusBadge status={thread.latestStatus} />

                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                            {thread.messageCount} message
                            {thread.messageCount === 1 ? "" : "s"}
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

                        <div className="mb-2 flex flex-wrap gap-2">
                          {thread.sourceLabels.map((label) => (
                            <span
                              key={label}
                              className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200"
                            >
                              {label}
                            </span>
                          ))}
                        </div>

                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h4 className="truncate text-base font-bold text-zinc-900">
                              {thread.displayName}
                            </h4>
                            <div className="mt-1 text-sm text-zinc-500">
                              {thread.displayContact}
                            </div>
                          </div>

                          <div className="shrink-0 text-sm font-medium text-zinc-500">
                            {formatDateTime(thread.latestTime)}
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-700">
                          {thread.latestPreview}
                        </p>
                      </div>

                      <div className="flex w-full shrink-0 flex-wrap gap-2 lg:w-auto lg:flex-col">
                        <Link
                          href={`/admin/inbox/${thread.conversationId}`}
                          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open
                        </Link>

                        <button
                          type="button"
                          className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                          onClick={(e) => e.preventDefault()}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-zinc-200 bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Thread key
                        </div>
                        <div className="mt-2 break-all text-sm text-zinc-700">
                          {thread.threadKey}
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200 bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Latest message ID
                        </div>
                        <div className="mt-2 text-sm text-zinc-700">
                          {thread.latestMessageId}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-zinc-600">
                      This now groups threads by phone, then email, then contact reference,
                      then conversation ID as a fallback.
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}