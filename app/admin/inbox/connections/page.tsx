import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function hasValue(value: string | undefined | null) {
  return String(value || "").trim().length > 0
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "Never"

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return "Unknown"

  return date.toLocaleString("en-GB")
}

function isFutureDate(value: Date | string | null | undefined) {
  if (!value) return false

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return false

  return date.getTime() > Date.now()
}

function isOutlookConnected(connection: {
  accessToken?: string | null
  tokenExpiresAt?: Date | string | null
}) {
  return hasValue(connection?.accessToken) && isFutureDate(connection?.tokenExpiresAt)
}

type ServiceCard = {
  key: string
  name: string
  icon: string
  description: string
  connectable: boolean
}

export default async function InboxConnectionsPage() {
  let connections: any[] = []
  let databaseReady = true
  let errorMessage = ""

  try {
    connections = await prisma.inboxConnection.findMany({
      orderBy: { createdAt: "asc" },
    })
  } catch (error) {
    databaseReady = false
    errorMessage =
      error instanceof Error
        ? error.message
        : "Inbox connections table is not ready yet."
  }

  const services: ServiceCard[] = [
    {
      key: "furlads_email",
      name: "Furlads Email",
      icon: "📧",
      description: "Main Furlads customer enquiries",
      connectable: true,
    },
    {
      key: "threecounties_email",
      name: "Three Counties Email",
      icon: "📧",
      description: "Three Counties Property Care enquiries",
      connectable: true,
    },
    {
      key: "facebook_furlads",
      name: "Furlads Facebook",
      icon: "📘",
      description: "Furlads Facebook page messages",
      connectable: false,
    },
    {
      key: "facebook_threecounties",
      name: "Three Counties Facebook",
      icon: "📘",
      description: "Three Counties Property Care Facebook messages",
      connectable: false,
    },
    {
      key: "whatsapp",
      name: "WhatsApp Business",
      icon: "💬",
      description: "Customer WhatsApp enquiries",
      connectable: false,
    },
    {
      key: "wix",
      name: "Wix Website Forms",
      icon: "🌐",
      description: "Website contact form submissions",
      connectable: false,
    },
  ]

  const facebookFurladsPageId = String(
    process.env.FACEBOOK_PAGE_ID_FURLADS || ""
  ).trim()
  const facebookThreeCountiesPageId = String(
    process.env.FACEBOOK_PAGE_ID_THREE_COUNTIES || ""
  ).trim()

  const facebookFurladsConnected =
    hasValue(process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) &&
    hasValue(facebookFurladsPageId) &&
    hasValue(process.env.FACEBOOK_PAGE_TOKEN_FURLADS)

  const facebookThreeCountiesConnected =
    hasValue(process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) &&
    hasValue(facebookThreeCountiesPageId) &&
    hasValue(process.env.FACEBOOK_PAGE_TOKEN_THREE_COUNTIES)

  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">Inbox Connections</h1>

      <p className="mb-8 text-gray-600">
        Manage communication channels connected to the Furlads inbox.
      </p>

      {!databaseReady && (
        <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <div className="font-semibold text-yellow-800">
            Inbox connections database is not ready yet
          </div>

          <div className="mt-1 text-sm text-yellow-700">
            This usually means the Prisma migration has not been run against the
            live Neon database yet.
          </div>

          <div className="mt-3 text-sm text-yellow-700">Run:</div>

          <pre className="mt-2 overflow-x-auto rounded bg-yellow-100 p-3 text-sm text-yellow-900">
{`npx prisma migrate dev --name add_outlook_inbox_support
npx prisma generate`}
          </pre>

          <div className="mt-3 break-words text-xs text-yellow-700">
            Technical error: {errorMessage}
          </div>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-zinc-900">Outlook sync</div>

        <div className="mt-1 text-sm text-zinc-600">
          After connecting one or both Outlook mailboxes, run the sync route to pull
          recent emails into the inbox.
        </div>

        <div className="mt-4">
          <a
            href="/api/inbox/outlook/sync"
            className="inline-flex rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Run Outlook Sync
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => {
          const connection = connections.find((c) => c.service === service.key)

          const connected =
            service.key === "facebook_furlads"
              ? facebookFurladsConnected
              : service.key === "facebook_threecounties"
              ? facebookThreeCountiesConnected
              : service.key === "furlads_email" || service.key === "threecounties_email"
              ? isOutlookConnected(connection || {})
              : !!connection?.accessToken

          const tokenExpired =
            (service.key === "furlads_email" || service.key === "threecounties_email") &&
            hasValue(connection?.accessToken) &&
            !isFutureDate(connection?.tokenExpiresAt)

          return (
            <div
              key={service.key}
              className="rounded-lg border bg-white p-5 shadow-sm"
            >
              <div className="mb-2 flex items-center gap-3">
                <div className="text-2xl">{service.icon}</div>
                <div className="text-lg font-semibold">{service.name}</div>
              </div>

              <div className="mb-4 text-sm text-gray-500">
                {service.description}
              </div>

              {service.key === "facebook_furlads" ? (
                <>
                  {connected ? (
                    <div className="mb-4">
                      <div className="font-semibold text-green-600">Connected</div>

                      <div className="mt-1 text-xs text-gray-500">
                        Webhook: Active via environment configuration
                      </div>

                      <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-700">
                        <div className="font-medium">Furlads Facebook</div>
                        <div>Page ID: {facebookFurladsPageId}</div>
                        <div>Token: Configured</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <div className="font-semibold text-red-600">
                        Not fully configured
                      </div>

                      <div className="mt-2 text-xs text-gray-500">
                        This page needs the Furlads Facebook page ID and page token in
                        Vercel environment variables.
                      </div>
                    </div>
                  )}

                  <div
                    className={`w-full rounded py-2 text-center text-white ${
                      connected ? "bg-green-600" : "bg-zinc-500"
                    }`}
                  >
                    {connected ? "Webhook Connected" : "Needs Meta / Vercel setup"}
                  </div>
                </>
              ) : service.key === "facebook_threecounties" ? (
                <>
                  {connected ? (
                    <div className="mb-4">
                      <div className="font-semibold text-green-600">Connected</div>

                      <div className="mt-1 text-xs text-gray-500">
                        Webhook: Active via environment configuration
                      </div>

                      <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-700">
                        <div className="font-medium">Three Counties Facebook</div>
                        <div>Page ID: {facebookThreeCountiesPageId}</div>
                        <div>Token: Configured</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <div className="font-semibold text-red-600">
                        Not fully configured
                      </div>

                      <div className="mt-2 text-xs text-gray-500">
                        This page needs the Three Counties Facebook page ID and page
                        token in Vercel environment variables.
                      </div>
                    </div>
                  )}

                  <div
                    className={`w-full rounded py-2 text-center text-white ${
                      connected ? "bg-green-600" : "bg-zinc-500"
                    }`}
                  >
                    {connected ? "Webhook Connected" : "Needs Meta / Vercel setup"}
                  </div>
                </>
              ) : (
                <>
                  {connected ? (
                    <div className="mb-4">
                      <div className="font-semibold text-green-600">Connected</div>

                      <div className="mt-1 text-xs text-gray-500">
                        Account: {connection?.account || "Configured"}
                      </div>

                      <div className="text-xs text-gray-500">
                        Last Sync: {formatDateTime(connection?.lastSync)}
                      </div>

                      <div className="text-xs text-gray-500">
                        Token Expiry: {formatDateTime(connection?.tokenExpiresAt)}
                      </div>

                      {connection?.syncError ? (
                        <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                          {connection.syncError}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mb-4">
                      <div className="font-semibold text-red-600">
                        {databaseReady
                          ? service.connectable
                            ? tokenExpired
                              ? "Disconnected"
                              : "Not connected"
                            : "Not wired up yet"
                          : "Unavailable until DB is ready"}
                      </div>

                      {tokenExpired ? (
                        <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                          The Outlook access token has expired. Reconnect this mailbox to
                          restore inbox syncing.
                        </div>
                      ) : null}
                    </div>
                  )}

                  {service.connectable ? (
                    <a
                      href={`/api/inbox/outlook/connect?service=${service.key}`}
                      className={`block w-full rounded py-2 text-center text-white transition ${
                        databaseReady
                          ? connected
                            ? "bg-black hover:bg-gray-800"
                            : "bg-red-600 hover:bg-red-700"
                          : "pointer-events-none cursor-not-allowed bg-gray-400"
                      }`}
                    >
                      {connected ? "Reconnect" : "Connect"}
                    </a>
                  ) : (
                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded bg-gray-300 py-2 text-white"
                    >
                      Coming later
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}