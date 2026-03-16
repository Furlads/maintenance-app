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

function isGenericFacebookName(value: string | null | undefined) {
  const name = String(value || "").trim().toLowerCase()

  return (
    !name ||
    name === "facebook" ||
    name === "furlads facebook" ||
    name === "three counties facebook"
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const conversationId = String(body?.conversationId || "").trim()
    const externalThreadId = String(body?.externalThreadId || "").trim()
    const messageText = String(body?.messageText || "").trim()

    if (!conversationId) {
      return NextResponse.json(
        { ok: false, error: "Missing conversationId." },
        { status: 400 }
      )
    }

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

    const sendResponse = await fetch(`${GRAPH_URL}?access_token=${pageAccessToken}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        message: { text: messageText },
      }),
    })

    const responseText = await sendResponse.text()

    let parsed: any = null
    try {
      parsed = JSON.parse(responseText)
    } catch {
      parsed = { raw: responseText }
    }

    if (!sendResponse.ok) {
      console.error("FACEBOOK SEND ERROR:", parsed)

      return NextResponse.json(
        {
          ok: false,
          error: parsed?.error?.message || "Meta rejected the Facebook message.",
          details: parsed,
        },
        { status: 500 }
      )
    }

    try {
      await prisma.inboxMessage.create({
        data: {
          conversationId,
          source: "facebook",
          status: "replied",
          externalMessageId:
            String(
              parsed?.message_id ||
                parsed?.messageId ||
                parsed?.messages?.[0]?.id ||
                ""
            ).trim() || null,
          senderName: "Furlads",
          senderPhone: null,
          senderEmail: null,
          preview: messageText.slice(0, 120),
          body: messageText,
        },
      })

      const conversation = await prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
        select: {
          id: true,
          contactName: true,
          messages: {
            where: {
              source: "facebook",
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 10,
            select: {
              senderName: true,
            },
          },
        },
      })

      if (conversation && isGenericFacebookName(conversation.contactName)) {
        const bestInboundName =
          conversation.messages
            .map((message: any) => String(message?.senderName || "").trim())
            .find(
              (name: string) =>
                !!name &&
                !isGenericFacebookName(name) &&
                name.toLowerCase() !== "furlads"
            ) || ""

        if (bestInboundName) {
          await prisma.conversation.update({
            where: {
              id: conversationId,
            },
            data: {
              contactName: bestInboundName,
            },
          })
        }
      }
    } catch (dbError) {
      console.error("FACEBOOK MESSAGE LOGGING ERROR:", dbError)

      return NextResponse.json(
        {
          ok: false,
          error: "Facebook message sent but failed to save into the conversation.",
        },
        { status: 500 }
      )
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