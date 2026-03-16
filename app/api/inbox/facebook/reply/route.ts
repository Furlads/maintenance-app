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
    const body = await req.json()

    const externalThreadId = String(body?.externalThreadId || "").trim()
    const messageText = String(body?.messageText || "").trim()

    if (!externalThreadId) {
      return NextResponse.json(
        { ok: false, error: "Missing externalThreadId." },
        { status: 400 }
      )
    }

    if (!messageText) {
      return NextResponse.json(
        { ok: false, error: "Message cannot be empty." },
        { status: 400 }
      )
    }

    const [pageId, recipientPsid] = externalThreadId.split(":")

    if (!pageId || !recipientPsid) {
      return NextResponse.json(
        { ok: false, error: "Invalid externalThreadId format." },
        { status: 400 }
      )
    }

    const pageAccessToken = getPageAccessToken(pageId)

    if (!pageAccessToken) {
      return NextResponse.json(
        { ok: false, error: "No Facebook page token found for this thread." },
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
        message: { text: messageText },
      }),
    })

    const responseText = await response.text()

    let parsed: any = null
    try {
      parsed = JSON.parse(responseText)
    } catch {
      parsed = { raw: responseText }
    }

    if (!response.ok) {
      console.error("FACEBOOK SEND ERROR:", parsed)

      return NextResponse.json(
        {
          ok: false,
          error:
            parsed?.error?.message || "Meta rejected the Facebook message.",
          details: parsed,
        },
        { status: 500 }
      )
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        source: "facebook",
        OR: [
          {
            contactRef: externalThreadId,
          },
          {
            messages: {
              some: {
                externalThreadId,
              },
            },
          },
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
            String(
              parsed?.message_id ||
                parsed?.messageId ||
                parsed?.messages?.[0]?.id ||
                ""
            ).trim() || null,
          externalThreadId,
          senderName: "Furlads",
          senderPhone: null,
          senderEmail: null,
          preview: messageText.slice(0, 120),
          body: messageText,
          rawPayload: JSON.stringify(parsed),
        },
      })
    }

    return NextResponse.json({
      ok: true,
      meta: parsed,
    })
  } catch (error) {
    console.error("FACEBOOK REPLY ROUTE ERROR:", error)

    return NextResponse.json(
      { ok: false, error: "Server error sending Facebook reply." },
      { status: 500 }
    )
  }
}