import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanPhone(value: string) {
  return value.replace(/\D/g, "")
}

function makeConversationRef(phone: string) {
  return cleanPhone(phone)
}

function validSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 })
  }

  return new NextResponse("Forbidden", { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    if (!validSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
      return new NextResponse("Invalid signature", { status: 401 })
    }

    const payload = JSON.parse(rawBody)

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change?.value
        for (const message of value?.messages || []) {
          const from = message.from
          if (!from) continue

          let body = ""
          if (message.type === "text") body = message.text?.body || ""
          else if (message.type === "button") body = message.button?.text || "[Button reply]"
          else if (message.type === "interactive") body = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "[Interactive reply]"
          else body = `[${message.type || "WhatsApp message"}]`

          const contact = value.contacts?.[0]
          const senderName = contact?.profile?.name || from
          const conversationRef = makeConversationRef(from)

          let conversation = await prisma.conversation.findFirst({
            where: { source: "whatsapp", contactRef: conversationRef },
            select: { id: true },
          })

          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: {
                source: "whatsapp",
                contactName: senderName,
                contactRef: conversationRef,
                archived: false,
              },
              select: { id: true },
            })
          }

          await prisma.inboxMessage.create({
            data: {
              source: "whatsapp",
              senderName,
              senderPhone: from,
              preview: body.slice(0, 120),
              body,
              status: "unread",
              conversationId: conversation.id,
            },
          })
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("WHATSAPP WEBHOOK ERROR:", error)
    return new NextResponse("Server error", { status: 500 })
  }
}
