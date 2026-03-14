import { NextRequest, NextResponse } from "next/server"
import * as prismaModule from "@/lib/prisma"

export const dynamic = "force-dynamic"

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

function cleanPhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const conversationId = String(body?.conversationId || "").trim()
    const message = String(body?.message || "").trim()

    if (!conversationId) {
      return NextResponse.json(
        { ok: false, error: "Missing conversationId." },
        { status: 400 }
      )
    }

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Message cannot be empty." },
        { status: 400 }
      )
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v25.0"

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing WhatsApp environment variables.",
        },
        { status: 500 }
      )
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        source: true,
        contactName: true,
        contactRef: true,
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { ok: false, error: "Conversation not found." },
        { status: 404 }
      )
    }

    if (String(conversation.source || "").toLowerCase() !== "whatsapp") {
      return NextResponse.json(
        { ok: false, error: "This conversation is not a WhatsApp thread." },
        { status: 400 }
      )
    }

    const to = cleanPhone(conversation.contactRef)

    if (!to) {
      return NextResponse.json(
        { ok: false, error: "This WhatsApp thread has no valid phone number." },
        { status: 400 }
      )
    }

    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: {
            body: message,
          },
        }),
      }
    )

    const responseText = await response.text()

    let parsed: any = null
    try {
      parsed = JSON.parse(responseText)
    } catch {
      parsed = { raw: responseText }
    }

    if (!response.ok) {
      console.error("WHATSAPP SEND ERROR:", parsed)

      return NextResponse.json(
        {
          ok: false,
          error:
            parsed?.error?.message ||
            "Meta rejected the WhatsApp message.",
          details: parsed,
        },
        { status: 500 }
      )
    }

    await prisma.inboxMessage.create({
      data: {
        conversationId: conversation.id,
        source: "whatsapp",
        senderName: "Furlads",
        senderPhone: null,
        preview: message.slice(0, 120),
        body: message,
        status: "replied",
      },
    })

    return NextResponse.json({
      ok: true,
      meta: parsed,
    })
  } catch (error) {
    console.error("WHATSAPP SEND ROUTE ERROR:", error)

    return NextResponse.json(
      { ok: false, error: "Server error sending WhatsApp reply." },
      { status: 500 }
    )
  }
}