import Link from "next/link"
import InboxAutoRefresh from "@/components/admin/InboxAutoRefresh"
import SourceBadge from "@/components/admin/SourceBadge"
import WhatsAppReplyComposer from "@/components/admin/WhatsAppReplyComposer"
import FacebookReplyComposer from "@/components/admin/FacebookReplyComposer"
import OutlookReplyComposer from "@/components/admin/OutlookReplyComposer"
import CreateQuoteVisitFromInbox from "@/components/admin/CreateQuoteVisitFromInbox"
import * as prismaModule from "@/lib/prisma"

export const dynamic = "force-dynamic"

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type PageProps = {
  params: {
    conversationId: string
  }
}

type QuoteDraftDetails = {
  scope: string
  priceExVat: string
  vat: string
  totalIncVat: string
  estimatedInstall: string
  customerDraft: string
  working: string
}

function formatDateTime(value: Date | string | null | undefined) {
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

function isIncomingMessage(conversation: any, message: any) {
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
    return String(message?.senderName || "").toLowerCase() !== "furlads"
  }

  if (source === "furlads-email" || source === "threecounties-email") {
    return String(message?.senderName || "").toLowerCase() !== "furlads"
  }

  return true
}

function valueBetween(text: string, start: string, end?: string) {
  const startIndex = text.indexOf(start)
  if (startIndex === -1) return ""

  const contentStart = startIndex + start.length

  if (!end) {
    return text.slice(contentStart).trim()
  }

  const endIndex = text.indexOf(end, contentStart)
  if (endIndex === -1) {
    return text.slice(contentStart).trim()
  }

  return text.slice(contentStart, endIndex).trim()
}

function parseQuoteDraft(value: unknown): QuoteDraftDetails | null {
  const text = String(value || "").trim()

  if (!text.includes("CHAS QUOTE DRAFT FOR KELLY")) {
    return null
  }

  return {
    scope: valueBetween(text, "Scope:", "Price ex VAT:"),
    priceExVat: valueBetween(text, "Price ex VAT:", "VAT:"),
    vat: valueBetween(text, "VAT:", "Total inc VAT:"),
    totalIncVat: valueBetween(text, "Total inc VAT:", "Estimated install:"),
    estimatedInstall: valueBetween(
      text,
      "Estimated install:",
      "Customer-ready draft:"
    ),
    customerDraft: valueBetween(
      text,
      "Customer-ready draft:",
      "Trevor / CHAS quote conversation:"
    ),
    working: valueBetween(text, "Trevor / CHAS quote conversation:"),
  }
}

function getCustomerDisplayName(conversation: any) {
  const name = String(conversation.contactName || "").trim()
  const ref = String(conversation.contactRef || "").trim()
  const nameLower = name.toLowerCase()
  const refLower = ref.toLowerCase()

  if (
    name &&
    nameLower !== "trevor" &&
    nameLower !== "unknown customer" &&
    !nameLower.startsWith("worker-quote")
  ) {
    return name
  }

  if (
    ref &&
    !refLower.startsWith("worker-quote") &&
    refLower !== "trevor"
  ) {
    return ref
  }

  return "Customer details needed"
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
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Thread not found
          </h1>
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
  const normalisedConversationSource = normaliseSource(conversation.source)

  const latestQuoteDraftMessage = [...conversation.messages]
    .reverse()
    .find((message: any) => parseQuoteDraft(message.body))

  const quoteDraft = latestQuoteDraftMessage
    ? parseQuoteDraft(latestQuoteDraftMessage.body)
    : null

  const isInternalQuoteDraft =
    normalisedConversationSource === "worker-quote" && Boolean(quoteDraft)

  const contactName = isInternalQuoteDraft
    ? getCustomerDisplayName(conversation)
    : String(conversation.contactName || "").trim() ||
      String(conversation.contactRef || "").trim() ||
      "Unknown contact"

  const contactRef = isInternalQuoteDraft
    ? "Internal CHAS quote handoff for Kelly review"
    : String(conversation.contactRef || "").trim() || "No contact details yet"

  const isWhatsAppThread = normalisedConversationSource === "whatsapp"
  const isFacebookThread = normalisedConversationSource === "facebook"
  const isEmailThread =
    normalisedConversationSource === "furlads-email" ||
    normalisedConversationSource === "threecounties-email"

  const facebookExternalThreadId =
    String(conversation.contactRef || "").trim() ||
    String(
      conversation.messages.find(
        (message: any) =>
          normaliseSource(message?.source || "") === "facebook" &&
          String(message?.externalThreadId || "").includes(":")
      )?.externalThreadId || ""
    ).trim()

  return (
    <div className="space-y-4 pb-36">
      <InboxAutoRefresh />

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SourceBadge source={normalisedConversationSource} compact />
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                {businessLabel}
              </span>
              {isInternalQuoteDraft ? (
                <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-bold text-yellow-900 ring-1 ring-inset ring-yellow-200">
                  Quote ready for review
                </span>
              ) : null}
              {conversation.archived ? (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                  Archived
                </span>
              ) : null}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {isInternalQuoteDraft ? "Quote ready for review" : contactName}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {isInternalQuoteDraft ? contactName : contactRef}
            </p>
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

      {isInternalQuoteDraft && quoteDraft ? (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  CHAS quote
                </p>
                <h2 className="mt-2 text-xl font-black text-zinc-950">
                  {quoteDraft.scope || "Quote scope"}
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Prepared by Trevor with CHAS · {formatDateTime(latestQuoteDraftMessage?.createdAt)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
                <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Price
                </div>
                <div className="mt-1 text-xl font-black text-zinc-950">
                  {quoteDraft.priceExVat || "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">excluding VAT</div>
              </div>

              <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
                <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  VAT
                </div>
                <div className="mt-1 text-xl font-black text-zinc-950">
                  {quoteDraft.vat || "—"}
                </div>
              </div>

              <div className="rounded-2xl bg-yellow-50 p-4 ring-1 ring-inset ring-yellow-200">
                <div className="text-xs font-bold uppercase tracking-wide text-yellow-800">
                  Total
                </div>
                <div className="mt-1 text-xl font-black text-zinc-950">
                  {quoteDraft.totalIncVat || "—"}
                </div>
                <div className="mt-1 text-xs text-yellow-800">including VAT</div>
              </div>

              <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
                <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Install
                </div>
                <div className="mt-1 text-base font-black text-zinc-950">
                  {quoteDraft.estimatedInstall || "Not estimated"}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-lg font-black text-zinc-950">
                Customer-ready quote
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                This is the clean message for Kelly to review before sending.
              </p>
            </div>

            <div className="p-5">
              {contactName === "Customer details needed" ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <strong>Customer is not linked yet.</strong> The quote itself is ready, but the customer name/contact details were not carried into this handoff.
                </div>
              ) : null}

              <div className="whitespace-pre-wrap rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-900 ring-1 ring-inset ring-zinc-200">
                {quoteDraft.customerDraft || "No customer-ready draft found."}
              </div>
            </div>
          </section>

          <details className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-zinc-900">
              View quote working
            </summary>
            <div className="border-t border-zinc-200 p-5">
              <div className="whitespace-pre-wrap rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
                {quoteDraft.working || "No quote working saved."}
              </div>
            </div>
          </details>
        </>
      ) : (
        <>
          <CreateQuoteVisitFromInbox
            conversationId={conversation.id}
            contactName={conversation.contactName}
          />

          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="text-base font-bold text-zinc-900">Conversation</h2>
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
                            ? message.senderName ||
                              conversation.contactName ||
                              "Customer"
                            : "Furlads"}
                        </div>

                        <div className="whitespace-pre-wrap text-sm leading-6">
                          {String(message.body || "").trim() ||
                            String(message.preview || "").trim() ||
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
        </>
      )}

      {!isInternalQuoteDraft ? (
        <div className="sticky bottom-0 z-10 -mx-0 bg-white/95 pt-2 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="border-t border-zinc-200 pt-2">
            {isWhatsAppThread ? (
              <WhatsAppReplyComposer
                conversationId={conversation.id}
                contactName={conversation.contactName}
              />
            ) : isFacebookThread ? (
              facebookExternalThreadId ? (
                <FacebookReplyComposer
                  conversationId={conversation.id}
                  externalThreadId={facebookExternalThreadId}
                  contactName={conversation.contactName}
                />
              ) : null
            ) : isEmailThread ? (
              <OutlookReplyComposer
                conversationId={conversation.id}
                contactName={conversation.contactName}
              />
            ) : (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-bold text-zinc-900">Reply</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Direct reply is currently enabled for WhatsApp, Facebook and email
                  threads.
                </p>
              </section>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
