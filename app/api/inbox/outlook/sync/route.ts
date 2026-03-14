import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

const MAIL_SERVICES = ["furlads_email", "threecounties_email"] as const

type ConnectionRecord = {
  id: string
  service: string
  account: string | null
  accessToken: string | null
  refreshToken: string | null
  tokenExpiresAt: Date | null
}

function normaliseEmail(value: string | null | undefined) {
  const cleaned = String(value || "").trim().toLowerCase()
  return cleaned || null
}

async function refreshAccessToken(connection: ConnectionRecord) {
  if (!connection.refreshToken) {
    throw new Error(`No refresh token stored for ${connection.service}.`)
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Missing Microsoft OAuth environment variables.")
  }

  const tokenRes = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token",
      }),
    }
  )

  const tokenJson = await tokenRes.json()

  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(
      tokenJson.error_description || `Failed to refresh token for ${connection.service}.`
    )
  }

  const expiresInSeconds = Number(tokenJson.expires_in || 3600)

  await prisma.inboxConnection.update({
    where: {
      id: connection.id,
    },
    data: {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || connection.refreshToken,
      tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      syncError: null,
    },
  })

  return tokenJson.access_token as string
}

async function getValidAccessToken(connection: ConnectionRecord) {
  const expiresAt = connection.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt).getTime()
    : 0

  const now = Date.now()
  const refreshBufferMs = 5 * 60 * 1000

  if (connection.accessToken && expiresAt > now + refreshBufferMs) {
    return connection.accessToken
  }

  return refreshAccessToken(connection)
}

export async function GET() {
  try {
    const connections = await prisma.inboxConnection.findMany({
      where: {
        service: {
          in: [...MAIL_SERVICES],
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    })

    const results: Array<{
      service: string
      synced: number
      skipped: number
      error: string | null
    }> = []

    for (const connection of connections) {
      let synced = 0
      let skipped = 0
      let error: string | null = null

      try {
        const accessToken = await getValidAccessToken(connection)

        const mailRes = await fetch(
          "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=25&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,receivedDateTime,isRead,from",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        const mailJson = await mailRes.json()

        if (!mailRes.ok) {
          throw new Error(mailJson.error?.message || "Failed to read Outlook inbox.")
        }

        for (const msg of mailJson.value || []) {
          const externalMessageId = String(msg.id || "").trim()
          const senderEmail = normaliseEmail(msg.from?.emailAddress?.address)
          const senderName =
            String(msg.from?.emailAddress?.name || "").trim() || senderEmail || "Unknown sender"

          if (!externalMessageId || !senderEmail) {
            skipped++
            continue
          }

          const existingMessage = await prisma.inboxMessage.findFirst({
            where: {
              source: connection.service,
              externalMessageId,
            },
            select: {
              id: true,
            },
          })

          if (existingMessage) {
            skipped++
            continue
          }

          let conversation = await prisma.conversation.findFirst({
            where: {
              source: connection.service,
              contactRef: senderEmail,
            },
            select: {
              id: true,
            },
          })

          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: {
                source: connection.service,
                contactName: senderName,
                contactRef: senderEmail,
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
              source: connection.service,
              senderName,
              senderEmail,
              subject: msg.subject || "(No subject)",
              preview: msg.subject || msg.bodyPreview || "(No subject)",
              body: msg.bodyPreview || "",
              externalMessageId,
              status: msg.isRead ? "open" : "unread",
              createdAt: msg.receivedDateTime
                ? new Date(msg.receivedDateTime)
                : new Date(),
            },
          })

          synced++
        }

        await prisma.inboxConnection.update({
          where: {
            id: connection.id,
          },
          data: {
            lastSync: new Date(),
            syncError: null,
          },
        })
      } catch (syncError) {
        error =
          syncError instanceof Error ? syncError.message : "Unknown sync error."

        await prisma.inboxConnection.update({
          where: {
            id: connection.id,
          },
          data: {
            syncError: error,
          },
        })
      }

      results.push({
        service: connection.service,
        synced,
        skipped,
        error,
      })
    }

    return NextResponse.json({
      ok: true,
      results,
    })
  } catch (error) {
    console.error("OUTLOOK SYNC ROUTE ERROR:", error)

    return NextResponse.json(
      { ok: false, error: "Server error syncing Outlook mailboxes." },
      { status: 500 }
    )
  }
}