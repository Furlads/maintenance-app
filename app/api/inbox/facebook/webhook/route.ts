import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const VERIFY_TOKEN =
  process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "furlads_messenger_verify"

type FacebookPageConfig = {
  pageId: string
  key: string
  label: string
  business: "furlads" | "three_counties"
  token: string | null
}

type FacebookProfile = {
  first_name?: string
  last_name?: string
  name?: string
  id?: string
}

function getFacebookPages(): FacebookPageConfig[] {
  const pages: FacebookPageConfig[] = []

  const furladsPageId = String(process.env.FACEBOOK_PAGE_ID_FURLADS || "").trim()
  const threeCountiesPageId = String(
    process.env.FACEBOOK_PAGE_ID_THREE_COUNTIES || ""
  ).trim()

  const furladsToken = String(
    process.env.FACEBOOK_PAGE_TOKEN_FURLADS || ""
  ).trim()
  const threeCountiesToken = String(
    process.env.FACEBOOK_PAGE_TOKEN_THREE_COUNTIES || ""
  ).trim()

  if (furladsPageId) {
    pages.push({
      pageId: furladsPageId,
      key: "facebook_furlads",
      label: "Furlads Facebook",
      business: "furlads",
      token: furladsToken || null,
    })
  }

  if (threeCountiesPageId) {
    pages.push({
      pageId: threeCountiesPageId,
      key: "facebook_threecounties",
      label: "Three Counties Facebook",
      business: "three_counties",
      token: threeCountiesToken || null,
    })
  }

  return pages
}

function getPageConfig(pageId: string): FacebookPageConfig {
  const pages = getFacebookPages()
  const found = pages.find((page) => page.pageId === pageId)

  if (found) return found

  return {
    pageId,
    key: "facebook_unknown",
    label: "Facebook",
    business: "furlads",
    token: null,
  }
}

function makeConversationRef(pageId: string, senderPsid: string) {
  return `${pageId}:${senderPsid}`
}

function buildDisplayName(profile: FacebookProfile | null, senderPsid: string) {
  const fullName = String(profile?.name || "").trim()
  if (fullName) return fullName

  const first = String(profile?.first_name || "").trim()
  const last = String(profile?.last_name || "").trim()
  const joined = [first, last].filter(Boolean).join(" ").trim()
  if (joined) return joined

  const shortPsid = senderPsid.slice(-6)
  return shortPsid ? `Facebook contact ${shortPsid}` : "Facebook contact"
}

async function fetchMessengerProfile(
  senderPsid: string,
  pageAccessToken: string | null
): Promise<FacebookProfile | null> {
  if (!senderPsid || !pageAccessToken) {
    return null
  }

  try {
    const url = new URL(`https://graph.facebook.com/${senderPsid}`)
    url.searchParams.set("fields", "name,first_name,last_name")
    url.searchParams.set("access_token", pageAccessToken)

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    })

    const text = await response.text()

    let parsed: any = null
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { raw: text }
    }

    if (!response.ok) {
      console.error("FACEBOOK PROFILE LOOKUP ERROR:", {
        senderPsid,
        status: response.status,
        details: parsed,
      })
      return null
    }

    return parsed as FacebookProfile
  } catch (error) {
    console.error("FACEBOOK PROFILE LOOKUP FAILED:", {
      senderPsid,
      error,
    })
    return null
  }
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
      const pageConfig = getPageConfig(pageId)

      for (const event of entry.messaging || []) {
        if (!event?.message) {
          continue
        }

        const senderPsid = String(event?.sender?.id || "").trim()
        const messageId = String(event?.message?.mid || "").trim()
        const messageText = String(event?.message?.text || "").trim()
        const timestamp = Number(event?.timestamp || 0)

        if (!pageId || !senderPsid || !messageId) {
          continue
        }

        const existingMessage = await prisma.inboxMessage.findFirst({
          where: {
            externalMessageId: messageId,
          },
          select: {
            id: true,
          },
        })

        if (existingMessage) {
          continue
        }

        const conversationRef = makeConversationRef(pageId, senderPsid)
        const profile = await fetchMessengerProfile(senderPsid, pageConfig.token)
        const customerName = buildDisplayName(profile, senderPsid)

        let conversation = await prisma.conversation.findFirst({
          where: {
            source: "facebook",
            contactRef: conversationRef,
          },
          select: {
            id: true,
            contactName: true,
          },
        })

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              source: "facebook",
              contactName: customerName,
              contactRef: conversationRef,
              archived: false,
            },
            select: {
              id: true,
              contactName: true,
            },
          })
        } else if (
          !conversation.contactName ||
          conversation.contactName === pageConfig.label ||
          conversation.contactName === "Facebook"
        ) {
          await prisma.conversation.update({
            where: {
              id: conversation.id,
            },
            data: {
              contactName: customerName,
            },
          })
        }

        const body =
          messageText && messageText.length > 0
            ? messageText
            : "[Facebook message with no text]"

        await prisma.inboxMessage.create({
          data: {
            source: "facebook",
            status: "unread",
            conversationId: conversation.id,
            externalMessageId: messageId,
            senderName: customerName,
            senderPhone: senderPsid,
            senderEmail: null,
            preview: body.slice(0, 120),
            body,
            createdAt: timestamp ? new Date(timestamp) : new Date(),
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