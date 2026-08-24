import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildContactKey } from "@/lib/inbox/contactKey"

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function firstExistingMarker(text: string, markers: string[], afterIndex = 0) {
  return markers
    .map((marker) => ({ marker, index: text.indexOf(marker, afterIndex) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)[0]?.marker
}

function valueAfterAny(text: string, starts: string[], ends: string[] = []) {
  const startMarker = firstExistingMarker(text, starts)
  if (!startMarker) return ""

  const contentStart = text.indexOf(startMarker) + startMarker.length
  const endMarker = firstExistingMarker(text, ends, contentStart)

  if (!endMarker) return text.slice(contentStart).trim()
  return text.slice(contentStart, text.indexOf(endMarker, contentStart)).trim()
}

function parseMoney(value: string) {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)
  if (!match) return 0
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(value) ? value : 0)
}

function firstName(value: string | null | undefined) {
  return clean(value).split(/\s+/)[0] || "there"
}

function conciseExistingCustomerMessage(params: {
  customerName: string | null
  workerName: string | null
  scope: string
  priceExVat: number
  totalIncVat: number
}) {
  const customer = firstName(params.customerName)
  const worker = firstName(params.workerName)
  const intro = worker.toLowerCase() === "trevor" || worker.toLowerCase() === "trev"
    ? "I've got the details from the visit."
    : `${worker} has sent me the details from the visit.`

  return [
    `Hi ${customer},`,
    "",
    intro,
    "",
    params.scope,
    "",
    `The cost for this would be ${formatMoney(params.priceExVat)} + VAT (${formatMoney(params.totalIncVat)} including VAT).`,
    "",
    "If you're happy with that, just let me know and I'll get it sorted for you 👍",
    "",
    "Thanks,",
    "Kelly",
    "Furlads",
  ].join("\n")
}

function readSurveyPhotos(quoteWorking: string | null | undefined) {
  const value = clean(quoteWorking)
  if (!value) return [] as Array<{ url: string; fileName: string }>

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed?.surveyPhotos)) return []
    return parsed.surveyPhotos
      .map((item: unknown) => {
        if (!item || typeof item !== "object") return null
        const row = item as Record<string, unknown>
        const url = clean(row.url)
        const fileName = clean(row.fileName) || "Site photo"
        return url.startsWith("https://") ? { url, fileName } : null
      })
      .filter(
        (photo: { url: string; fileName: string } | null): photo is { url: string; fileName: string } =>
          photo !== null
      )
      .slice(0, 12)
  } catch {
    return []
  }
}

function appendSurveyPhotos(quoteWorking: string, photos: Array<{ url: string; fileName: string }>) {
  if (!photos.length) return quoteWorking
  return [
    quoteWorking,
    `SURVEY PHOTOS JSON\n${JSON.stringify(photos)}`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

function parseChasQuoteDraft(workSummary: string) {
  if (!workSummary.includes("CHAS QUOTE DRAFT FOR KELLY")) return null

  const scope = valueAfterAny(workSummary, ["Scope:"], [
    "Options / packages:",
    "All-together combinations:",
    "Reference price ex VAT:",
    "Price ex VAT:",
    "Customer-ready draft:",
  ])

  const optionsAndPackages = valueAfterAny(workSummary, ["Options / packages:"], [
    "All-together combinations:",
    "Reference price ex VAT:",
    "Price ex VAT:",
    "Customer-ready draft:",
  ])

  const allTogetherCombinations = valueAfterAny(workSummary, ["All-together combinations:"], [
    "Reference price ex VAT:",
    "Price ex VAT:",
    "Customer-ready draft:",
  ])

  const priceExVat = parseMoney(
    valueAfterAny(workSummary, ["Reference price ex VAT:", "Price ex VAT:"], ["Reference VAT:", "VAT:"])
  )

  const vatAmount = parseMoney(
    valueAfterAny(workSummary, ["Reference VAT:", "VAT:"], ["Reference total inc VAT:", "Total inc VAT:"])
  )

  const totalIncVat = parseMoney(
    valueAfterAny(workSummary, ["Reference total inc VAT:", "Total inc VAT:"], [
      "Reference estimated install:",
      "Estimated install:",
      "Customer-ready draft:",
    ])
  )

  const install = valueAfterAny(workSummary, ["Reference estimated install:", "Estimated install:"], ["Customer-ready draft:"])
  const customerMessage = valueAfterAny(workSummary, ["Customer-ready draft:"], ["Trevor / CHAS quote conversation:"])
  const conversationWorking = valueAfterAny(workSummary, ["Trevor / CHAS quote conversation:"])

  const quoteWorking = [
    optionsAndPackages ? `OPTIONS / PACKAGES\n${optionsAndPackages}` : "",
    allTogetherCombinations ? `ALL-TOGETHER COMBINATIONS\n${allTogetherCombinations}` : "",
    conversationWorking ? `TREVOR / CHAS CONVERSATION\n${conversationWorking}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  const daysMatch = install.match(/([0-9]+(?:\.[0-9]+)?)\s+day/i)
  const peopleMatch = install.match(/([0-9]+)\s+(?:person|people)/i)
  const estimatedDays = daysMatch ? Number(daysMatch[1]) : null
  const estimatedTeamSize = peopleMatch ? Number(peopleMatch[1]) : null
  const vatRate = priceExVat > 0 ? Number(((vatAmount / priceExVat) * 100).toFixed(2)) : 20
  const depositPercent = 25
  const depositAmount = Number(((totalIncVat * depositPercent) / 100).toFixed(2))

  if (!scope || priceExVat <= 0 || totalIncVat <= 0) return null

  return {
    scope,
    priceExVat,
    vatRate,
    vatAmount,
    totalIncVat,
    depositPercent,
    depositAmount,
    estimatedDays:
      estimatedDays != null && Number.isFinite(estimatedDays) ? estimatedDays : null,
    estimatedTeamSize:
      estimatedTeamSize != null && Number.isFinite(estimatedTeamSize) ? estimatedTeamSize : null,
    customerMessage,
    quoteWorking,
    isMultiOption: Boolean(optionsAndPackages || allTogetherCombinations),
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const requestedCustomerId = Number(data.customerId)
    const customerId = Number.isInteger(requestedCustomerId) && requestedCustomerId > 0 ? requestedCustomerId : null

    const message = await prisma.chasMessage.create({
      data: {
        company: data.company,
        worker: data.worker,
        sessionId: data.sessionId,
        jobId: data.jobId,
        question: data.question,
        answer: data.answer,
        imageDataUrl: data.imageDataUrl,
        responseId: data.responseId,
        conversationId: data.conversationId,
        intent: data.intent,
        confidence: data.confidence,
        escalateTo: data.escalateTo,
        safetyFlag: data.safetyFlag ?? false,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        customerAddress: data.customerAddress,
        customerPostcode: data.customerPostcode,
        workSummary: data.workSummary,
        estimatedHours: data.estimatedHours,
        roughPriceText: data.roughPriceText,
        enquirySummary: data.enquirySummary,
        enquiryReadyForKelly: data.enquiryReadyForKelly ?? false,
      },
    })

    let createdQuote = null

    if (message.enquiryReadyForKelly) {
      const contactKey = buildContactKey({
        senderPhone: message.customerPhone,
        senderEmail: message.customerEmail,
        contactRef: message.customerName,
        conversationId: message.conversationId,
      })

      let conversation = null

      if (contactKey) {
        conversation = await prisma.conversation.findFirst({
          where: { source: "worker-quote", contactRef: contactKey },
          orderBy: { createdAt: "desc" },
        })
      }

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            source: "worker-quote",
            contactName: message.customerName ?? message.worker ?? "Unknown customer",
            contactRef:
              contactKey ??
              message.customerEmail ??
              message.customerPhone ??
              message.customerName ??
              message.conversationId ??
              `worker-quote-${message.id}`,
          },
        })
      }

      await prisma.inboxMessage.create({
        data: {
          conversationId: conversation.id,
          customerId,
          jobId: message.jobId ?? null,
          source: "worker-quote",
          senderName: message.worker ?? "Worker",
          senderEmail: message.customerEmail ?? undefined,
          senderPhone: message.customerPhone ?? undefined,
          subject: message.customerName ?? "Worker Quote Request",
          preview: message.enquirySummary ?? message.workSummary ?? "",
          body: message.workSummary ?? "",
          status: "unread",
          assignedTo: "Kelly",
        },
      })

      const parsedDraft = parseChasQuoteDraft(clean(message.workSummary))

      if (parsedDraft) {
        const draftQuote = await prisma.quote.findFirst({
          where: {
            status: "in_progress",
            archivedAt: null,
            ...(customerId
              ? { customerId }
              : {
                  customerName: clean(message.customerName) || undefined,
                  customerPostcode: clean(message.customerPostcode) || undefined,
                }),
          },
          orderBy: { updatedAt: "desc" },
        })
        const surveyPhotos = readSurveyPhotos(draftQuote?.quoteWorking)
        const customerMessage =
          customerId && !parsedDraft.isMultiOption
            ? conciseExistingCustomerMessage({
                customerName: message.customerName,
                workerName: message.worker,
                scope: parsedDraft.scope,
                priceExVat: parsedDraft.priceExVat,
                totalIncVat: parsedDraft.totalIncVat,
              })
            : parsedDraft.customerMessage || clean(message.answer) || null

        createdQuote = await prisma.quote.create({
          data: {
            customerId,
            conversationId: conversation.id,
            jobId: message.jobId ?? null,
            customerName: clean(message.customerName) || null,
            customerPhone: clean(message.customerPhone) || null,
            customerEmail: clean(message.customerEmail) || null,
            customerAddress: clean(message.customerAddress) || null,
            customerPostcode: clean(message.customerPostcode) || null,
            scope: parsedDraft.scope,
            customerMessage,
            internalNotes: clean(message.enquirySummary) || null,
            quoteWorking: appendSurveyPhotos(parsedDraft.quoteWorking || "", surveyPhotos) || null,
            priceExVat: parsedDraft.priceExVat,
            vatRate: parsedDraft.vatRate,
            vatAmount: parsedDraft.vatAmount,
            totalIncVat: parsedDraft.totalIncVat,
            depositPercent: parsedDraft.depositPercent,
            depositAmount: parsedDraft.depositAmount,
            estimatedDays: parsedDraft.estimatedDays,
            estimatedTeamSize: parsedDraft.estimatedTeamSize,
            status: "needs_review",
          },
        })
      } else {
        console.error("CHAS QUOTE PARSE ERROR: inbox handoff created but Quote record could not be parsed", {
          chasMessageId: message.id,
          conversationId: conversation.id,
        })
      }
    }

    return NextResponse.json({ success: true, message, quote: createdQuote })
  } catch (error) {
    console.error("CHAS API ERROR:", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
