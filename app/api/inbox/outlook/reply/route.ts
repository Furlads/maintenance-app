import { NextRequest, NextResponse } from "next/server"
import * as prismaModule from "@/lib/prisma"

export const dynamic = "force-dynamic"

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const conversationId = String(body?.conversationId || "").trim()
    const subject = String(body?.subject || "").trim()
    const message = String(body?.message || "").trim()

    if (!conversationId || !message) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    })

    if (!conversation) {
      return NextResponse.json(
        { ok: false, error: "Conversation not found" },
        { status: 404 }
      )
    }

    const email = String(conversation.contactRef || "").trim()

    if (!email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "No valid email on this thread" },
        { status: 400 }
      )
    }

    // 🔑 Get Outlook connection
    const connection = await prisma.inboxConnection.findFirst({
      where: {
        provider: "outlook",
        status: "active",
      },
    })

    if (!connection?.accessToken) {
      return NextResponse.json(
        { ok: false, error: "No active Outlook connection" },
        { status: 400 }
      )
    }

    // 📤 Send email via Microsoft Graph
    const sendRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: subject || "Re: Your enquiry",
          body: {
            contentType: "Text",
            content: message,
          },
          toRecipients: [
            {
              emailAddress: {
                address: email,
              },
            },
          ],
        },
      }),
    })

    if (!sendRes.ok) {
      const errText = await sendRes.text()
      console.error("OUTLOOK SEND ERROR:", errText)

      return NextResponse.json(
        { ok: false, error: "Failed to send email" },
        { status: 500 }
      )
    }

    // 💾 Save into conversation
    await prisma.inboxMessage.create({
      data: {
        conversationId,
        source: conversation.source,
        status: "replied",
        senderName: "Furlads",
        senderEmail: null,
        senderPhone: null,
        preview: message.slice(0, 120),
        body: message,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("OUTLOOK REPLY ERROR:", error)

    return NextResponse.json(
      { ok: false, error: "Server error sending email" },
      { status: 500 }
    )
  }
}