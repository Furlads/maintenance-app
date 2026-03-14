import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function cleanPhone(value: string) {
  return value.replace(/\D/g, "")
}

function makeConversationId(phone: string) {
  return `whatsapp:${cleanPhone(phone)}`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({
    ok: true,
    route: "whatsapp webhook live",
  })
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()

    const entry = payload.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value

    if (!value?.messages?.length) {
      return NextResponse.json({ received: true })
    }

    const message = value.messages[0]
    const from = message.from
    const body = message.text?.body || ""

    if (!from) {
      return NextResponse.json({ received: true })
    }

    const contact = value.contacts?.[0]
    const senderName = contact?.profile?.name || from
    const conversationId = makeConversationId(from)

    await prisma.inboxMessage.create({
      data: {
        source: "whatsapp",
        senderName,
        senderPhone: from,
        preview: body.slice(0, 120),
        body,
        status: "unread",
        conversationId,
      },
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("WHATSAPP WEBHOOK ERROR:", error)
    return new NextResponse("Server error", { status: 500 })
  }
}