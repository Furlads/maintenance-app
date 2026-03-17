import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type LooseRecord = Record<string, any>

function safeString(value: unknown) {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function valueToText(value: unknown): string {
  if (value === null || value === undefined) return ""

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value).trim()
  }

  if (Array.isArray(value)) {
    return value.map((item) => valueToText(item)).filter(Boolean).join(", ")
  }

  if (typeof value === "object") {
    const obj = value as LooseRecord

    if (obj.value !== undefined && obj.value !== null) {
      const nested = valueToText(obj.value)
      if (nested) return nested
    }

    if (obj.label !== undefined && obj.label !== null) {
      const label = valueToText(obj.label)
      if (label) return label
    }

    if (obj.name !== undefined && obj.name !== null) {
      const name = valueToText(obj.name)
      if (name) return name
    }
  }

  return ""
}

function findField(source: LooseRecord, keywords: string[]) {
  for (const [key, rawValue] of Object.entries(source || {})) {
    const normalisedKey = key.toLowerCase()

    if (keywords.some((keyword) => normalisedKey.includes(keyword))) {
      const text = valueToText(rawValue)
      if (text) return text
    }
  }

  return ""
}

function buildContactName(fields: LooseRecord) {
  const fullName =
    findField(fields, ["full name", "fullname", "name"]) ||
    [
      findField(fields, ["first name", "firstname"]),
      findField(fields, ["last name", "lastname"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim()

  return fullName || "Wix form lead"
}

function buildContactEmail(fields: LooseRecord) {
  return findField(fields, ["email", "e-mail"])
}

function buildContactPhone(fields: LooseRecord) {
  return findField(fields, ["phone", "mobile", "telephone", "tel"])
}

function buildSubject(fields: LooseRecord) {
  return (
    findField(fields, ["subject"]) ||
    findField(fields, ["service"]) ||
    findField(fields, ["project"]) ||
    findField(fields, ["enquiry"]) ||
    "Wix form enquiry"
  )
}

function buildBody(fields: LooseRecord) {
  const lines = Object.entries(fields || {})
    .map(([key, value]) => {
      const text = valueToText(value)
      if (!text) return ""
      return `${key}: ${text}`
    })
    .filter(Boolean)

  return lines.join("\n")
}

function buildContactRef(email: string, phone: string, externalId: string) {
  if (email) return email.toLowerCase()
  if (phone) return phone
  return `wix:${externalId}`
}

function parseEventDataObject(eventData: any): LooseRecord {
  if (!eventData) return {}

  if (typeof eventData === "string") {
    try {
      return JSON.parse(eventData)
    } catch {
      return {}
    }
  }

  if (typeof eventData === "object") {
    return eventData as LooseRecord
  }

  return {}
}

function flattenPossibleFields(eventData: LooseRecord): LooseRecord {
  const flattened: LooseRecord = {}

  const candidates = [
    eventData?.submission,
    eventData?.submissions,
    eventData?.fields,
    eventData?.formData,
    eventData?.data,
    eventData?.payload,
    eventData?.entity?.submission,
    eventData?.entity?.submissions,
  ]

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      for (const [key, value] of Object.entries(candidate)) {
        flattened[key] = value
      }
    }
  }

  if (Object.keys(flattened).length === 0) {
    for (const [key, value] of Object.entries(eventData || {})) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        Array.isArray(value) ||
        (value && typeof value === "object")
      ) {
        flattened[key] = value
      }
    }
  }

  return flattened
}

export async function POST(req: NextRequest) {
  try {
    const publicKey = process.env.WIX_WEBHOOK_PUBLIC_KEY

    if (!publicKey) {
      console.error("WIX WEBHOOK ERROR: Missing WIX_WEBHOOK_PUBLIC_KEY")
      return NextResponse.json(
        { ok: false, error: "Missing Wix public key." },
        { status: 500 }
      )
    }

    const rawBody = await req.text()

    if (!rawBody.trim()) {
      return NextResponse.json(
        { ok: false, error: "Empty request body." },
        { status: 400 }
      )
    }

    let decoded: any
    try {
      decoded = jwt.verify(rawBody, publicKey, {
        algorithms: ["RS256"],
      })
    } catch (error) {
      console.error("WIX JWT VERIFY ERROR:", error)
      return NextResponse.json(
        { ok: false, error: "Invalid Wix webhook signature." },
        { status: 400 }
      )
    }

    const envelope =
      typeof decoded?.data === "string" ? JSON.parse(decoded.data) : decoded?.data || decoded

    const eventType = safeString(envelope?.eventType)
    const instanceId = safeString(envelope?.instanceId)
    const eventData = parseEventDataObject(envelope?.data)

    const externalId =
      safeString(eventData?.id) ||
      safeString(envelope?.entityId) ||
      safeString(envelope?.id)

    if (!externalId) {
      console.error("WIX WEBHOOK ERROR: Missing external id", {
        eventType,
        instanceId,
        envelope,
      })
      return NextResponse.json(
        { ok: false, error: "Missing submission id." },
        { status: 400 }
      )
    }

    const existing = await prisma.inboxMessage.findFirst({
      where: {
        source: "wix",
        externalMessageId: externalId,
      },
      select: {
        id: true,
      },
    })

    if (existing) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const fields = flattenPossibleFields(eventData)

    const contactName = buildContactName(fields)
    const contactEmail = buildContactEmail(fields)
    const contactPhone = buildContactPhone(fields)
    const subject = buildSubject(fields)
    const body = buildBody(fields) || "Wix form submission received."
    const preview = body.slice(0, 120)
    const contactRef = buildContactRef(contactEmail, contactPhone, externalId)

    let conversation = await prisma.conversation.findFirst({
      where: {
        source: "wix",
        contactRef,
      },
      select: {
        id: true,
        contactName: true,
      },
    })

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          source: "wix",
          contactName,
          contactRef,
          archived: false,
        },
        select: {
          id: true,
          contactName: true,
        },
      })
    } else if (!safeString(conversation.contactName) || conversation.contactName === "Wix form lead") {
      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          contactName,
        },
      })
    }

    await prisma.inboxMessage.create({
      data: {
        conversationId: conversation.id,
        source: "wix",
        senderName: contactName,
        senderEmail: contactEmail || null,
        senderPhone: contactPhone || null,
        subject,
        preview,
        body,
        externalMessageId: externalId,
        status: "unread",
        createdAt: envelope?.eventTime ? new Date(envelope.eventTime) : new Date(),
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("WIX FORMS WEBHOOK ERROR:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to process Wix form submission." },
      { status: 500 }
    )
  }
}