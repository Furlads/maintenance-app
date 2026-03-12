import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

type QuoteRequestBody = {
  company?: string
  worker?: string
  sessionId?: string
  jobId?: number | null
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  customerPostcode?: string
  workSummary?: string
  estimatedTimeText?: string
  notes?: string
  imageDataUrl?: string
  chatTranscript?: string
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function buildEnquirySummary(body: {
  worker: string
  customerName: string
  customerPhone: string
  customerEmail: string
  customerAddress: string
  customerPostcode: string
  workSummary: string
  estimatedTimeText: string
  notes: string
  chatTranscript: string
}) {
  const parts: string[] = []

  parts.push(`Worker: ${body.worker}`)
  parts.push(`Customer name: ${body.customerName || "Not provided"}`)
  parts.push(`Customer phone: ${body.customerPhone || "Not provided"}`)
  parts.push(`Customer email: ${body.customerEmail || "Not provided"}`)
  parts.push(`Customer address: ${body.customerAddress || "Not provided"}`)
  parts.push(`Customer postcode: ${body.customerPostcode || "Not provided"}`)
  parts.push(`Work needed: ${body.workSummary || "Not provided"}`)
  parts.push(`Conservative time estimate: ${body.estimatedTimeText || "Not provided"}`)

  if (body.notes) {
    parts.push(`Notes: ${body.notes}`)
  }

  if (body.chatTranscript) {
    parts.push(`CHAS chat context: ${body.chatTranscript}`)
  }

  return parts.join(" | ")
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QuoteRequestBody

    const company = cleanString(body.company) || "furlads"
    const worker = cleanString(body.worker)
    const sessionId = cleanString(body.sessionId)
    const customerName = cleanString(body.customerName)
    const customerPhone = cleanString(body.customerPhone)
    const customerEmail = cleanString(body.customerEmail)
    const customerAddress = cleanString(body.customerAddress)
    const customerPostcode = cleanString(body.customerPostcode)
    const workSummary = cleanString(body.workSummary)
    const estimatedTimeText = cleanString(body.estimatedTimeText)
    const notes = cleanString(body.notes)
    const imageDataUrl = cleanString(body.imageDataUrl)
    const chatTranscript = cleanString(body.chatTranscript)

    const jobId =
      typeof body.jobId === "number" && Number.isFinite(body.jobId)
        ? body.jobId
        : null

    if (!worker) {
      return NextResponse.json({ error: "Missing worker." }, { status: 400 })
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 })
    }

    if (!customerName) {
      return NextResponse.json({ error: "Customer name is required." }, { status: 400 })
    }

    if (!customerPhone && !customerEmail) {
      return NextResponse.json(
        { error: "Add at least a phone number or email." },
        { status: 400 }
      )
    }

    if (!workSummary) {
      return NextResponse.json({ error: "Work summary is required." }, { status: 400 })
    }

    if (!estimatedTimeText) {
      return NextResponse.json(
        { error: "Conservative time estimate is required." },
        { status: 400 }
      )
    }

    const enquirySummary = buildEnquirySummary({
      worker,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerPostcode,
      workSummary,
      estimatedTimeText,
      notes,
      chatTranscript,
    })

    await prisma.chasMessage.create({
      data: {
        company,
        worker,
        sessionId,
        jobId,
        question: `Quote request for Kelly: ${workSummary}`,
        answer: "Sent to Kelly for pricing.",
        imageDataUrl: imageDataUrl || null,
        intent: "quote_request",
        confidence: 1,
        escalateTo: "kelly",
        safetyFlag: false,
        customerName,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        customerAddress: customerAddress || null,
        customerPostcode: customerPostcode || null,
        workSummary,
        roughPriceText: null,
        enquirySummary,
        enquiryReadyForKelly: true,
      },
    })

    return NextResponse.json({
      ok: true,
      message: "Quote request sent to Kelly.",
    })
  } catch (error) {
    console.error("Quote request error", error)

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to send quote request.",
      },
      { status: 500 }
    )
  }
}