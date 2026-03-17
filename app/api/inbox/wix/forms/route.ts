import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type WixSubmissionValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { value?: string | number | boolean | null; label?: string | null }
  | Array<string | number | boolean | null | undefined>

type WixSubmissionMap = Record<string, WixSubmissionValue>

type WixSubmissionEntity = {
  id?: string
  formId?: string
  createdDate?: string
  submissions?: WixSubmissionMap
}

type WixCreatedEvent = {
  id?: string
  eventTime?: string
  entity?: WixSubmissionEntity
  entityId?: string
}

type WixWebhookPayload = {
  createdEvent?: WixCreatedEvent
}

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

function valueToText(value: WixSubmissionValue): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join(", ")
  }

  if (typeof value === "object") {
    if ("value" in value && value.value !== undefined && value.value !== null) {
      return String(value.value).trim()
    }
    if ("label" in value && value.label) {
      return String(value.label).trim()
    }
  }

  return ""
}

function findField(submissions: WixSubmissionMap, keywords: string[]) {
  for (const [key, rawValue] of Object.entries(submissions || {})) {
    const normalisedKey = key.toLowerCase()

    if (keywords.some((keyword) => normalisedKey.includes(keyword))) {
      const text = valueToText(rawValue)
      if (text) return text
    }
  }

  return ""
}

function buildContactName(submissions: WixSubmissionMap) {
  const fullName =
    findField(submissions, ["full name", "fullname", "name"]) ||
    [findField(submissions, ["first name", "firstname"]), findField(submissions, ["last name", "lastname"])]
      .filter(Boolean)
      .join(" ")
      .trim()

  return fullName || "Wix form lead"
}

function buildContactEmail(submissions: WixSubmissionMap) {
  return findField(submissions, ["email", "e-mail"])
}

function buildContactPhone(submissions: WixSubmissionMap) {
  return findField(submissions, ["phone", "mobile", "telephone", "tel"])
}

function buildSubject(submissions: WixSubmissionMap) {
  return (
    findField(submissions, ["subject"]) ||
    findField(submissions, ["service"]) ||
    findField(submissions, ["project"]) ||
    "Wix form enquiry"
  )
}

function buildBody(submissions: WixSubmissionMap) {
  const lines = Object.entries(submissions || [])
    .map(([key, value]) => {
      const text = valueToText(value)
      if (!text) return ""
      return `${key}: ${text}`
    })
    .filter(Boolean)

  return lines.join("\n")
}

function buildContactRef(email: string, phone: string, submissionId: string) {
  if (email) return email.toLowerCase()
  if (phone) return phone
  return `wix-submission:${submissionId}`
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : ""

    if (!bearerToken) {
      return NextResponse.json(
        { ok: false, error: "Missing Wix bearer token." },
        { status: 400 }
      )
    }

    // Pragmatic first step:
    // decode the JWT payload so we can build the inbox flow.
    // You should still verify the JWT signature before production use.
    const decoded = parseJwtPayload(bearerToken) as WixWebhookPayload
    const createdEvent = decoded?.createdEvent
    const entity = createdEvent?.entity

    const submissionId =
      String(entity?.id || createdEvent?.entityId || "").trim()

    if (!submissionId) {
      return NextResponse.json(
        { ok: false, error: "Missing submission id." },
        { status: 400 }
      )
    }

    const existing = await prisma.inboxMessage.findFirst({
      where: {
        source: "wix",
        externalMessageId: submissionId,
      },
      select: {
        id: true,
      },
    })

    if (existing) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const submissions = entity?.submissions || {}
    const contactName = buildContactName(submissions)
    const contactEmail = buildContactEmail(submissions)
    const contactPhone = buildContactPhone(submissions)
    const subject = buildSubject(submissions)
    const body = buildBody(submissions) || "Wix form submission received."
    const preview = body.slice(0, 120)
    const contactRef = buildContactRef(contactEmail, contactPhone, submissionId)

    let conversation = await prisma.conversation.findFirst({
      where: {
        source: "wix",
        contactRef,
      },
      select: {
        id: true,
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
        },
      })
    } else {
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
        externalMessageId: submissionId,
        status: "unread",
        createdAt: entity?.createdDate
          ? new Date(entity.createdDate)
          : createdEvent?.eventTime
          ? new Date(createdEvent.eventTime)
          : new Date(),
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