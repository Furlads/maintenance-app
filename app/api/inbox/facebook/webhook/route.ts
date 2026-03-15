import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const VERIFY_TOKEN =
  process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "furlads_messenger_verify"

function getPageLabel(pageId: string) {
  const furladsPageId = String(process.env.FACEBOOK_PAGE_ID_FURLADS || "").trim()
  const threeCountiesPageId = String(
    process.env.FACEBOOK_PAGE_ID_THREE_COUNTIES || ""
  ).trim()

  if (pageId && pageId === furladsPageId) {
    return "Furlads Facebook"
  }

  if (pageId && pageId === threeCountiesPageId) {
    return "Three Counties Facebook"
  }

  return "Facebook"
}

function makeConversationRef(pageId: string, senderPsid: string) {
  return `${pageId}:${senderPsid}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  }

  return new NextResponse("Verification failed", { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()

    if (payload.object !== "page") {
      return NextResponse.json({ ignored: true })
    }

    for (const entry of payload.entry || []) {
      const pageId = String(entry?.id || "").trim()

      for (const event of entry.messaging || []) {
        const senderPsid = String(event?.sender?.id || "").trim()
        const messageId = String(event?.message?.mid || "").trim()
        const messageText = String(event?.message?.text || "").trim()

        if (!pageId || !senderPsid || !messageId) {
          continue
        }

        const existing = await prisma.inboxMessage.findFirst({
          where: {
            externalMessageId: messageId,
          },
          select: {
            id: true,
          },
        })

        if (existing) {
          continue
        }

        const conversationRef = makeConversationRef(pageId, senderPsid)
        const pageLabel = getPageLabel(pageId)

        let conversation = await prisma.conversation.findFirst({
          where: {
            source: "facebook",
            contactRef: conversationRef,
          },
          select: {
            id: true,
          },
        })

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              source: "facebook",
              contactName: pageLabel,
              contactRef: conversationRef,
              archived: false,
            },
            select: {
              id: true,
            },
          })
        }

        await prisma.inboxMessage.create({
          data: {
            conversationId: conversation.id,
            source: "facebook",
            direction: "inbound",
            status: "unread",
            externalMessageId: messageId,
            externalThreadId: conversationRef,
            senderName: pageLabel,
            senderPhone: null,
            senderEmail: null,
            preview: messageText.slice(0, 120),
            body: messageText || "[Facebook message with no text]",
            rawPayload: JSON.stringify(event),
          },
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("FACEBOOK WEBHOOK ERROR:", error)
    return new NextResponse("Server error", { status: 500 })
  }
}