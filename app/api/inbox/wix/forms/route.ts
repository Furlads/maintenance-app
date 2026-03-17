import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type LooseRecord = Record<string, any>

function parseJwtPayload(token: string) {
  const parts = token.split(".")
  if (parts.length < 2) {
    throw new Error("Invalid JWT format")
  }

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  const json = Buffer.from(padded, "base64").toString("utf8")
  return JSON.parse(json)
}

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
    return value
      .map((item) => valueToText(item))
      .filter(Boolean)
      .join(", ")
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

function looksLikeJwt(raw: string) {
  const trimmed = raw.trim()
  return trimmed.split(".").length >= 2 && !trimmed.startsWith("{")
}

function extractPossibleSubmissionData(payload: LooseRecord) {
  const createdEvent = payload?.createdEvent || payload?.data?.createdEvent || null
  const entity = createdEvent?.entity || payload?.entity || payload?.data?.entity || null

  const externalId =
    safeString(entity?.id) ||
    safeString(createdEvent?.entityId) ||
    safeString(payload?.entityId) ||
    safeString(payload?.submissionId) ||
    safeString(payload?.id)

  const createdAt =
    safeString(entity?.createdDate) ||
    safeString(createdEvent?.eventTime) ||
    safeString(payload?.createdDate) ||
    safeString(payload?.eventTime)

  const fieldMaps: LooseRecord[] = []

  if (entity?.submissions && typeof entity.submissions === "object") {
    fieldMaps.push(entity.submissions as LooseRecord)
  }

  if (entity?.submission && typeof entity.submission === "object") {
    fieldMaps.push(entity.submission as LooseRecord)
  }

  if (payload?.submissions && typeof payload.submissions === "object") {
    fieldMaps.push(payload.submissions as LooseRecord)
  }

  if (payload?.submission && typeof payload.submission === "object") {
    fieldMaps.push(payload.submission as LooseRecord)
  }

  if (payload?.fields && typeof payload.fields === "object") {
    fieldMaps.push(payload.fields as LooseRecord)
  }

  const flattened: LooseRecord = {}
  for (const map of fieldMaps) {
    for (const [key, value] of Object.entries(map)) {
      flattened[key] = value
    }
  }

  return {
    externalId,
    createdAt,
    fields: flattened,
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    if (!rawBody.trim()) {
      return NextResponse.json(
        { ok: false, error: "Empty request body." },
        { status: 400 }
      )
    }

    let payload: LooseRecord = {}

    try {
      if (looksLikeJwt(rawBody)) {
        payload = parseJwtPayload(rawBody)
      } else {
        payload = JSON.parse(rawBody)
      }
    } catch (error) {
      console.error("WIX FORMS PARSE ERROR:", error)
      return NextResponse.json(
        { ok: false, error: "Could not parse Wix payload." },
        { status: 400 }
      )
    }

    const { externalId, createdAt, fields } = extractPossibleSubmissionData(payload)

    if (!externalId) {
      console.error("WIX FORMS MISSING ID:", payload)
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
        createdAt: createdAt ? new Date(createdAt) : new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("WIX FORMS WEBHOOK ERROR:", error)

    return NextResponse.json(
      { ok: false, error: "Failed to process Wix form submission." },
      { status: 500 }
    )
  }
}