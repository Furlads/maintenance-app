import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type LooseRecord = Record<string, any>

type WixFieldRow = {
  fieldName?: string
  fieldValue?: string
}

function safeString(value: unknown) {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function parseJsonSafely(value: unknown): any {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function getNestedWixData(envelope: LooseRecord) {
  const level1 = parseJsonSafely(envelope?.data) as LooseRecord
  const level2 = parseJsonSafely(level1?.data) as LooseRecord
  const level3 = parseJsonSafely(level2?.data) as LooseRecord

  // Some Wix payloads may stop one level earlier, so pick the richest object.
  if (level3 && typeof level3 === "object" && Object.keys(level3).length > 0) {
    return level3
  }

  if (level2 && typeof level2 === "object" && Object.keys(level2).length > 0) {
    return level2
  }

  if (level1 && typeof level1 === "object" && Object.keys(level1).length > 0) {
    return level1
  }

  return {}
}

function normaliseSubmissionRows(payload: LooseRecord): WixFieldRow[] {
  const rows = payload?.submissionData

  if (!Array.isArray(rows)) return []

  return rows.map((row: any) => ({
    fieldName: safeString(row?.fieldName),
    fieldValue: safeString(row?.fieldValue),
  }))
}

function findRowValue(rows: WixFieldRow[], keywords: string[]) {
  for (const row of rows) {
    const name = safeString(row.fieldName).toLowerCase()
    if (keywords.some((keyword) => name.includes(keyword))) {
      const value = safeString(row.fieldValue)
      if (value) return value
    }
  }
  return ""
}

function buildContactName(rows: WixFieldRow[]) {
  const fullName =
    findRowValue(rows, ["full name", "fullname", "name"]) ||
    [
      findRowValue(rows, ["first name", "firstname"]),
      findRowValue(rows, ["last name", "lastname"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim()

  return fullName || "Wix form lead"
}

function buildContactEmail(rows: WixFieldRow[]) {
  return findRowValue(rows, ["email", "e-mail"])
}

function buildContactPhone(rows: WixFieldRow[]) {
  return findRowValue(rows, ["phone", "mobile", "telephone", "tel"])
}

function buildMessage(rows: WixFieldRow[]) {
  const explicitMessage =
    findRowValue(rows, ["message"]) ||
    findRowValue(rows, ["enquiry"]) ||
    findRowValue(rows, ["details"]) ||
    findRowValue(rows, ["comments"])

  if (explicitMessage) return explicitMessage

  const lines = rows
    .map((row) => {
      const fieldName = safeString(row.fieldName)
      const fieldValue = safeString(row.fieldValue)
      if (!fieldName || !fieldValue) return ""
      return `${fieldName}: ${fieldValue}`
    })
    .filter(Boolean)

  return lines.join("\n") || "Wix form submission received."
}

function buildFullBody(rows: WixFieldRow[]) {
  const lines = rows
    .map((row) => {
      const fieldName = safeString(row.fieldName)
      const fieldValue = safeString(row.fieldValue)
      if (!fieldName || !fieldValue) return ""
      return `${fieldName}: ${fieldValue}`
    })
    .filter(Boolean)

  return lines.join("\n") || "Wix form submission received."
}

function buildSubject(formName: string) {
  return formName || "Wix form enquiry"
}

function buildContactRef(email: string, phone: string, contactId: string) {
  if (email) return email.toLowerCase()
  if (phone) return phone
  if (contactId) return `wix-contact:${contactId}`
  return "wix-unknown-contact"
}

function buildExternalMessageId(
  contactId: string,
  submissionTime: string,
  formName: string
) {
  return (
    [contactId, submissionTime, formName].filter(Boolean).join(":") ||
    `wix:${Date.now()}`
  )
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

    const wixData = getNestedWixData(envelope)
    const rows = normaliseSubmissionRows(wixData)

    const contactId = safeString(wixData?.contactId)
    const formName = safeString(wixData?.formName) || "Wix form"
    const submissionTime = safeString(wixData?.submissionTime)

    const externalId = buildExternalMessageId(contactId, submissionTime, formName)

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

    const contactName = buildContactName(rows)
    const contactEmail = buildContactEmail(rows)
    const contactPhone = buildContactPhone(rows)
    const subject = buildSubject(formName)
    const body = buildFullBody(rows)
    const preview = buildMessage(rows).slice(0, 120)
    const contactRef = buildContactRef(contactEmail, contactPhone, contactId)

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
    } else if (
      !safeString(conversation.contactName) ||
      conversation.contactName === "Wix form lead"
    ) {
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
        createdAt: submissionTime ? new Date(submissionTime) : new Date(),
      },
    })

    return NextResponse.json(
      {
        ok: true,
        eventType,
        instanceId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("WIX FORMS WEBHOOK ERROR:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to process Wix form submission." },
      { status: 500 }
    )
  }
}