import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

const ALLOWED_SERVICES = new Set(["furlads_email", "threecounties_email"])

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const code = String(url.searchParams.get("code") || "").trim()
    const service = String(url.searchParams.get("state") || "").trim()

    if (!code || !ALLOWED_SERVICES.has(service)) {
      return NextResponse.json(
        { ok: false, error: "Missing code or invalid service." },
        { status: 400 }
      )
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const appUrl = process.env.APP_URL

    if (!clientId || !clientSecret || !appUrl) {
      return NextResponse.json(
        { ok: false, error: "Missing Microsoft OAuth environment variables." },
        { status: 500 }
      )
    }

    const redirectUri = `${appUrl}/api/inbox/outlook/callback`

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
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      }
    )

    const tokenJson = await tokenRes.json()

    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("OUTLOOK CALLBACK TOKEN ERROR:", tokenJson)

      return NextResponse.json(
        {
          ok: false,
          error: tokenJson.error_description || "Failed to exchange code for token.",
          details: tokenJson,
        },
        { status: 500 }
      )
    }

    const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
      },
    })

    const meJson = await meRes.json()

    if (!meRes.ok) {
      console.error("OUTLOOK CALLBACK PROFILE ERROR:", meJson)

      return NextResponse.json(
        {
          ok: false,
          error: "Failed to read Microsoft profile.",
          details: meJson,
        },
        { status: 500 }
      )
    }

    const account =
      meJson.mail ||
      meJson.userPrincipalName ||
      meJson.displayName ||
      "Connected mailbox"

    const expiresInSeconds = Number(tokenJson.expires_in || 3600)

    await prisma.inboxConnection.upsert({
      where: {
        service,
      },
      update: {
        account,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token || null,
        tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
        externalAccountId: meJson.id || null,
        syncError: null,
      },
      create: {
        service,
        account,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token || null,
        tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
        externalAccountId: meJson.id || null,
        syncError: null,
      },
    })

    return NextResponse.redirect(`${appUrl}/admin/inbox/connections`)
  } catch (error) {
    console.error("OUTLOOK CALLBACK ROUTE ERROR:", error)

    return NextResponse.json(
      { ok: false, error: "Server error handling Outlook callback." },
      { status: 500 }
    )
  }
}