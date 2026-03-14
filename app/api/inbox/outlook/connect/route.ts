import { NextResponse } from "next/server"

const ALLOWED_SERVICES = new Set(["furlads_email", "threecounties_email"])

export async function GET(req: Request) {
  const url = new URL(req.url)
  const service = String(url.searchParams.get("service") || "").trim()

  if (!ALLOWED_SERVICES.has(service)) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing service." },
      { status: 400 }
    )
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const appUrl = process.env.APP_URL

  if (!clientId || !appUrl) {
    return NextResponse.json(
      { ok: false, error: "Missing Microsoft OAuth environment variables." },
      { status: 500 }
    )
  }

  const redirectUri = `${appUrl}/api/inbox/outlook/callback`
  const scope = [
    "offline_access",
    "Mail.Read",
    "Mail.Send",
    "User.Read",
  ].join(" ")

  const authUrl = new URL(
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
  )

  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_mode", "query")
  authUrl.searchParams.set("scope", scope)
  authUrl.searchParams.set("state", service)

  return NextResponse.redirect(authUrl.toString())
}