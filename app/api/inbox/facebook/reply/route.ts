import { NextRequest, NextResponse } from "next/server"
import * as prismaModule from "@/lib/prisma"

export const dynamic = "force-dynamic"

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

const GRAPH_URL = "https://graph.facebook.com/v18.0/me/messages"

function getPageAccessToken(pageId: string) {
  const furladsPageId = process.env.FACEBOOK_PAGE_ID_FURLADS
  const threeCountiesPageId = process.env.FACEBOOK_PAGE_ID_THREE_COUNTIES

  if (pageId === furladsPageId) {
    return process.env.FACEBOOK_PAGE_TOKEN_FURLADS || null
  }

  if (pageId === threeCountiesPageId) {
    return process.env.FACEBOOK_PAGE_TOKEN_THREE_COUNTIES || null
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const { externalThreadId, messageText } = await req.json()

    const trimmedExternalThreadId = String(externalThreadId || "").trim()
    const trimmedMessageText = String(messageText || "").trim()

    if (!trimmedExternalThreadId || !trimmedMessageText) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields." },
        { status: 400 }
      )
    }

    const [pageId, recipientPsid] = trimmedExternalThreadId.split(":")

    if (!pageId || !recipientPsid) {
      return NextResponse.json(
        { ok: false, error: "Invalid externalThreadId format." },
        { status: 400 }
      )
    }

    const pageAccessToken = getPageAccessToken(pageId)

    if (!pageAccessToken) {
      return NextResponse.json(
        { ok: false, error: "No page access token found for pageId." },
        { status: 400 }
      )
    }

    const response = await fetch(`${GRAPH_URL}?access_token=${pageAccessToken}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        message: { text: trimmedMessageText },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Facebook send error:", data)
      return NextResponse.json(
        {
          ok: false,
          error: data?.error?.message || "Facebook send failed.",
          details: data,
        },
        { status: 500 }
      )
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        source: "facebook",
        OR: [
          { contactRef: trimmedExternalThreadId },
          { messages: { some: { externalThreadId: trimmedExternalThreadId } } },
        ],
      },
      select: {
        id: true,
      },
    })

    if (conversation) {
      await prisma.inboxMessage.create({
        data: {
          conversationId: conversation.id,
          source: "facebook",
          direction: "outbound",
          status: "replied",
          externalMessageId:
            String(data?.message_id || data?.messageId || "").trim() || null,
          externalThreadId: trimmedExternalThreadId,
          senderName: "Furlads",
          senderPhone: null,
          senderEmail: null,
          preview: trimmedMessageText.slice(0, 120),
          body: trimmedMessageText,
          rawPayload: JSON.stringify(data),
        },
      })
    }

    return NextResponse.json({
      ok: true,
      data,
    })
  } catch (error) {
    console.error("Facebook reply error:", error)
    return NextResponse.json(
      { ok: false, error: "Reply failed." },
      { status: 500 }
    )
  }
}