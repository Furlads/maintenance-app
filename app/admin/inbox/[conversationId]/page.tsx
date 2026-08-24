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
  quoteMode: string
  options: string
  combinedOffers: string
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

function firstExistingMarker(text: string, markers: string[], afterIndex = 0) {
  return markers
    .map((marker) => ({ marker, index: text.indexOf(marker, afterIndex) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)[0]?.marker
}

function valueAfterAny(
  text: string,
  starts: string[],
  ends: string[] = []
) {
  const startMarker = firstExistingMarker(text, starts)
  if (!startMarker) return ""

  const contentStart = text.indexOf(startMarker) + startMarker.length
  const endMarker = firstExistingMarker(text, ends, contentStart)

  if (!endMarker) return text.slice(contentStart).trim()

  return text.slice(contentStart, text.indexOf(endMarker, contentStart)).trim()
}

function parseQuoteDraft(value: unknown): QuoteDraftDetails | null {
  const text = String(value || "").trim()

  if (!text.includes("CHAS QUOTE DRAFT FOR KELLY")) {
    return null
  }

  const scope = valueAfterAny(
    text,
    ["Scope:"],
    [
      "Options / packages:",
      "All-together combinations:",
      "Reference price ex VAT:",
      "Price ex VAT:",
      "Customer-ready draft:",
    ]
  )

  return {
    scope,
    quoteMode: valueAfterAny(text, ["Quote mode:"], ["Scope:"]),
    options: valueAfterAny(text, ["Options / packages:"], [
      "All-together combinations:",
      "Reference price ex VAT:",
      "Price ex VAT:",
      "Customer-ready draft:",
    ]),
    combinedOffers: valueAfterAny(text, ["All-together combinations:"], [
      "Reference price ex VAT:",
      "Price ex VAT:",
      "Customer-ready draft:",
    ]),
    priceExVat: valueAfterAny(text, ["Reference price ex VAT:", "Price ex VAT:"], ["Reference VAT:", "VAT:"]),
    vat: valueAfterAny(text, ["Reference VAT:", "VAT:"], ["Reference total inc VAT:", "Total inc VAT:"]),
    totalIncVat: valueAfterAny(text, ["Reference total inc VAT:", "Total inc VAT:"], [
      "Reference estimated install:",
      "Estimated install:",
      "Customer-ready draft:",
    ]),
    estimatedInstall: valueAfterAny(text, ["Reference estimated install:", "Estimated install:"], ["Customer-ready draft:"]),
    customerDraft: valueAfterAny(text, ["Customer-ready draft:"], ["Trevor / CHAS quote conversation:"]),
    working: valueAfterAny(text, ["Trevor / CHAS quote conversation:"]),
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

function parseWorkerQuoteMessage(value: unknown) {
  const original = String(value || "").trim()
  const urls = Array.from(original.matchAll(/https?:\/\/[^\s]+/g)).map((match) =>
    match[0].replace(/[),.;]+$/, "")
  )
  const photoUrls = Array.from(
    new Set(
      urls.filter((url) =>
        /vercel-storage\.com|\/jobs\/|\.(?:jpe?g|png|webp|heic|heif)(?:\?|$)/i.test(url)
      )
    )
  )

  let text = original
  for (const url of photoUrls) {
    text = text.replace(url, "")
  }

  text = text
    .replace(/^\s*Photo:\s*$/gim, "")
    .replace(/^\s*Photo:\s+/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return { text, photoUrls }
}

export default async function AdminInboxThreadPage({ params }: PageProps) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!conversation) {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Thread not found</h1>
          <p className="mt-2 text-sm text-zinc-600">This inbox thread could not be found.</p>
          <div className="mt-4">
            <Link href="/admin/inbox" className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
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

  const isOptionsQuote = Boolean(
    quoteDraft?.options || quoteDraft?.combinedOffers || quoteDraft?.quoteMode === "packages" || quoteDraft?.quoteMode === "alternatives"
  )

  return (
    <div className="space-y-4 pb-36">
      <InboxAutoRefresh />

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SourceBadge source={normalisedConversationSource} compact />
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">{businessLabel}</span>
              {isInternalQuoteDraft ? (
                <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-bold text-yellow-900 ring-1 ring-inset ring-yellow-200">Quote ready for review</span>
              ) : null}
              {conversation.archived ? (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">Archived</span>
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
            <Link href="/admin/inbox" className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800">
              Back to inbox
            </Link>
          </div>
        </div>
      </section>

      {isInternalQuoteDraft && quoteDraft ? (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">CHAS quote</p>
              <h2 className="mt-2 text-xl font-black text-zinc-950">{quoteDraft.scope || "Quote scope"}</h2>
              <p className="mt-2 text-sm text-zinc-500">Prepared by Trevor with CHAS · {formatDateTime(latestQuoteDraftMessage?.createdAt)}</p>
            </div>

            {isOptionsQuote ? (
              <div className="mt-5 space-y-4">
                {quoteDraft.options ? (
                  <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
                    <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Separate prices / options</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-900">{quoteDraft.options}</div>
                  </div>
                ) : null}

                {quoteDraft.combinedOffers ? (
                  <div className="rounded-2xl bg-yellow-50 p-4 ring-1 ring-inset ring-yellow-200">
                    <div className="text-xs font-black uppercase tracking-wide text-yellow-800">If completed together</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-900">{quoteDraft.combinedOffers}</div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
                    <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Reference price</div>
                    <div className="mt-1 text-xl font-black text-zinc-950">{quoteDraft.priceExVat || "—"}</div>
                    <div className="mt-1 text-xs text-zinc-500">internal reference only</div>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
                    <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Reference VAT</div>
                    <div className="mt-1 text-xl font-black text-zinc-950">{quoteDraft.vat || "—"}</div>
                  </div>
                  <div className="rounded-2xl bg-yellow-50 p-4 ring-1 ring-inset ring-yellow-200">
                    <div className="text-xs font-bold uppercase tracking-wide text-yellow-800">Reference total</div>
                    <div className="mt-1 text-xl font-black text-zinc-950">{quoteDraft.totalIncVat || "—"}</div>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
                    <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Reference install</div>
                    <div className="mt-1 text-base font-black text-zinc-950">{quoteDraft.estimatedInstall || "Not estimated"}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
                  <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Price</div>
                  <div className="mt-1 text-xl font-black text-zinc-950">{quoteDraft.priceExVat || "—"}</div>
                  <div className="mt-1 text-xs text-zinc-500">excluding VAT</div>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
                  <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">VAT</div>
                  <div className="mt-1 text-xl font-black text-zinc-950">{quoteDraft.vat || "—"}</div>
                </div>
                <div className="rounded-2xl bg-yellow-50 p-4 ring-1 ring-inset ring-yellow-200">
                  <div className="text-xs font-bold uppercase tracking-wide text-yellow-800">Total</div>
                  <div className="mt-1 text-xl font-black text-zinc-950">{quoteDraft.totalIncVat || "—"}</div>
                  <div className="mt-1 text-xs text-yellow-800">including VAT</div>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
                  <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Install</div>
                  <div className="mt-1 text-base font-black text-zinc-950">{quoteDraft.estimatedInstall || "Not estimated"}</div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-lg font-black text-zinc-950">Customer-ready quote</h2>
              <p className="mt-1 text-sm text-zinc-500">This is the clean message for Kelly to review before sending.</p>
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
            <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-zinc-900">View quote working</summary>
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
              <p className="text-xs text-zinc-500">Full message history for this thread</p>
            </div>

            <div className="space-y-4 p-4">
              {conversation.messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  No messages in this thread yet.
                </div>
              ) : (
                conversation.messages.map((message: any) => {
                  const incoming = isIncomingMessage(conversation, message)
                  const messageSource = normaliseSource(message?.source || conversation?.source || "")
                  const isWorkerQuote = messageSource === "worker-quote"
                  const rawText = String(message.body || "").trim() || String(message.preview || "").trim() || "No message content."
                  const workerQuoteContent = isWorkerQuote
                    ? parseWorkerQuoteMessage(rawText)
                    : { text: rawText, photoUrls: [] as string[] }

                  return (
                    <div
                      key={message.id}
                      className={isWorkerQuote ? "block w-full" : `flex ${incoming ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`${
                          isWorkerQuote ? "w-full max-w-none" : "max-w-[85%]"
                        } rounded-2xl px-4 py-3 shadow-sm ${
                          incoming
                            ? "border border-zinc-200 bg-white text-zinc-900"
                            : "bg-zinc-900 text-white"
                        }`}
                      >
                        <div className={`mb-2 text-sm font-semibold ${incoming ? "text-zinc-700" : "text-zinc-200"}`}>
                          {incoming
                            ? message.senderName || conversation.contactName || "Customer"
                            : "Furlads"}
                        </div>

                        <div className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6">
                          {workerQuoteContent.text}
                        </div>

                        {workerQuoteContent.photoUrls.length ? (
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {workerQuoteContent.photoUrls.map((url) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt="Worker site photo"
                                  className="h-auto max-h-[520px] w-full object-contain"
                                />
                              </a>
                            ))}
                          </div>
                        ) : null}

                        <div className={`mt-3 text-xs ${incoming ? "text-zinc-400" : "text-zinc-300"}`}>
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
              <WhatsAppReplyComposer conversationId={conversation.id} contactName={conversation.contactName} />
            ) : isFacebookThread ? (
              facebookExternalThreadId ? (
                <FacebookReplyComposer conversationId={conversation.id} externalThreadId={facebookExternalThreadId} contactName={conversation.contactName} />
              ) : null
            ) : isEmailThread ? (
              <OutlookReplyComposer conversationId={conversation.id} contactName={conversation.contactName} />
            ) : (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-bold text-zinc-900">Reply</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Direct reply is currently enabled for WhatsApp, Facebook and email threads.
                </p>
              </section>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
