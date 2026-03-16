import InboxAutoRefresh from "@/components/admin/InboxAutoRefresh"
import Link from "next/link"
import SourceBadge from "@/components/admin/SourceBadge"
import WhatsAppReplyComposer from "@/components/admin/WhatsAppReplyComposer"
import FacebookReplyComposer from "@/components/admin/FacebookReplyComposer"
import * as prismaModule from "@/lib/prisma"

export const dynamic = "force-dynamic"

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type PageProps = {
  params: {
    conversationId: string
  }
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

function cleanPhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "")
}

function isIncomingMessage(
  conversation: any,
  message: any
) {
  const source = normaliseSource(message?.source || conversation?.source || "")

  if (source === "whatsapp") {
    const conversationPhone = cleanPhone(conversation?.contactRef)
    const messagePhone = cleanPhone(message?.senderPhone)

    if (conversationPhone && messagePhone) {
      return conversationPhone === messagePhone
    }

    return String(message?.senderName || "").toLowerCase() !== "furlads"
  }

  if (source === "facebook") {
    const direction = String(message?.direction || "").toLowerCase()
    if (direction === "outbound") return false
    if (direction === "inbound") return true

    return String(message?.senderName || "").toLowerCase() !== "furlads"
  }

  return true
}

export default async function AdminInboxThreadPage({ params }: PageProps) {
  const conversation = await prisma.conversation.findUnique({
    where: {
      id: params.conversationId,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  })

  if (!conversation) {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">Thread not found</h1>
          <p className="mt-2 text-sm text-zinc-600">
            This inbox thread could not be found.
          </p>

          <div className="mt-4">
            <Link
              href="/admin/inbox"
              className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Back to inbox
            </Link>
          </div>
        </section>
      </div>
    )
  }

  const businessLabel = getBusinessLabel(conversation.source)
  const contactName =
    conversation.contactName?.trim() ||
    conversation.contactRef?.trim() ||
    "Unknown contact"

  const contactRef =
    conversation.contactRef?.trim() || "No contact details yet"

  const normalisedConversationSource = normaliseSource(conversation.source)
  const isWhatsAppThread = normalisedConversationSource === "whatsapp"
  const isFacebookThread = normalisedConversationSource === "facebook"

  const facebookExternalThreadId =
    conversation.contactRef?.trim() ||
    conversation.messages.find((message: any) =>
      normaliseSource(message.source) === "facebook" &&
      String(message.externalThreadId || "").includes(":")
    )?.externalThreadId ||
    ""

  return (
    <div className="space-y-4">
      <InboxAutoRefresh />

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SourceBadge source={normalisedConversationSource} compact />
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                {businessLabel}
              </span>
              {conversation.archived ? (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                  Archived
                </span>
              ) : null}
            </div>

            <h1 className="text-2xl font-bold tracking-tight">{contactName}</h1>
            <p className="mt-1 text-sm text-zinc-500">{contactRef}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/inbox"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800"
            >
              Back to inbox
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-base font-bold">Conversation</h2>
          <p className="text-xs text-zinc-500">
            Full message history for this thread
          </p>
        </div>

        <div className="space-y-4 p-4">
          {conversation.messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
              No messages in this thread yet.
            </div>
          ) : (
            conversation.messages.map((message: any) => {
              const incoming = isIncomingMessage(conversation, message)

              return (
                <div
                  key={message.id}
                  className={`flex ${incoming ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                      incoming
                        ? "border border-zinc-200 bg-white text-zinc-900"
                        : "bg-zinc-900 text-white"
                    }`}
                  >
                    <div
                      className={`mb-1 text-xs font-semibold ${
                        incoming ? "text-zinc-500" : "text-zinc-300"
                      }`}
                    >
                      {incoming
                        ? message.senderName || conversation.contactName || "Customer"
                        : "Furlads"}
                    </div>

                    <div className="whitespace-pre-wrap text-sm leading-6">
                      {message.body?.trim() ||
                        message.preview?.trim() ||
                        "No message content."}
                    </div>

                    <div
                      className={`mt-2 text-xs ${
                        incoming ? "text-zinc-400" : "text-zinc-300"
                      }`}
                    >
                      {formatDateTime(message.createdAt)}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {isWhatsAppThread ? (
        <WhatsAppReplyComposer
          conversationId={conversation.id}
          contactName={conversation.contactName}
        />
      ) : isFacebookThread ? (
        facebookExternalThreadId ? (
          <FacebookReplyComposer
            externalThreadId={facebookExternalThreadId}
            contactName={conversation.contactName}
          />
        ) : (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-zinc-900">Reply</h3>
            <p className="mt-1 text-sm text-zinc-500">
              This Facebook thread is missing its external thread reference, so reply is unavailable right now.
            </p>
          </section>
        )
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-zinc-900">Reply</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Direct reply is currently enabled for WhatsApp and Facebook threads only.
          </p>
        </section>
      )}
    </div>
  )
}