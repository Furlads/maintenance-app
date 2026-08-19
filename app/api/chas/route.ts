import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildContactKey } from "@/lib/inbox/contactKey"

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function between(text: string, start: string, end?: string) {
  const startIndex = text.indexOf(start)
  if (startIndex === -1) return ""

  const from = startIndex + start.length
  if (!end) return text.slice(from).trim()

  const endIndex = text.indexOf(end, from)
  return endIndex === -1 ? text.slice(from).trim() : text.slice(from, endIndex).trim()
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseChasQuoteDraft(workSummary: string) {
  if (!workSummary.includes("CHAS QUOTE DRAFT FOR KELLY")) return null

  const scope = between(workSummary, "Scope:", "Price ex VAT:")
  const priceExVat = parseMoney(between(workSummary, "Price ex VAT:", "VAT:"))
  const vatAmount = parseMoney(between(workSummary, "VAT:", "Total inc VAT:"))
  const totalIncVat = parseMoney(
    between(workSummary, "Total inc VAT:", "Estimated install:")
  )
  const install = between(
    workSummary,
    "Estimated install:",
    "Customer-ready draft:"
  )
  const customerMessage = between(
    workSummary,
    "Customer-ready draft:",
    "Trevor / CHAS quote conversation:"
  )
  const quoteWorking = between(
    workSummary,
    "Trevor / CHAS quote conversation:"
  )

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
      estimatedTeamSize != null && Number.isFinite(estimatedTeamSize)
        ? estimatedTeamSize
        : null,
    customerMessage,
    quoteWorking,
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const requestedCustomerId = Number(data.customerId)
    const customerId =
      Number.isInteger(requestedCustomerId) && requestedCustomerId > 0
        ? requestedCustomerId
        : null

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
          where: {
            source: "worker-quote",
            contactRef: contactKey,
          },
          orderBy: {
            createdAt: "desc",
          },
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
          conversation: {
            connect: {
              id: conversation.id,
            },
          },
          customerId,
          source: "worker-quote",
          senderName: message.customerName ?? message.worker,
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
            customerMessage:
              parsedDraft.customerMessage || clean(message.answer) || null,
            internalNotes: clean(message.enquirySummary) || null,
            quoteWorking: parsedDraft.quoteWorking || null,
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
      }
    }

    return NextResponse.json({
      success: true,
      message,
      quote: createdQuote,
    })
  } catch (error) {
    console.error("CHAS API ERROR:", error)

    return NextResponse.json(
      {
        success: false,
      },
      { status: 500 }
    )
  }
}
