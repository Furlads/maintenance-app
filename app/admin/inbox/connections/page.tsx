import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type InboxConnectionRow = {
  id: string
  service: string
  account: string | null
  lastSync: Date | null
  accessToken: string | null
  refreshToken: string | null
  tokenExpiresAt: Date | null
  syncError: string | null
  createdAt: Date
  updatedAt: Date
}

type ServiceCard = {
  key: string
  name: string
  icon: string
  description: string
  connectable: boolean
}

function hasValue(value: string | undefined | null) {
  return String(value || "").trim().length > 0
}

export default async function InboxConnectionsPage() {
  let connections: InboxConnectionRow[] = []
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
      key: "facebook",
      name: "Facebook Messages",
      icon: "📘",
      description: "Facebook page messages",
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

  const facebookConfigured =
    hasValue(process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) &&
    hasValue(process.env.FACEBOOK_PAGE_ID_FURLADS) &&
    hasValue(process.env.FACEBOOK_PAGE_ID_THREE_COUNTIES) &&
    hasValue(process.env.FACEBOOK_PAGE_TOKEN_FURLADS) &&
    hasValue(process.env.FACEBOOK_PAGE_TOKEN_THREE_COUNTIES)

  const facebookPages = [
    {
      name: "Furlads Facebook",
      pageId: String(process.env.FACEBOOK_PAGE_ID_FURLADS || "").trim(),
      hasToken: hasValue(process.env.FACEBOOK_PAGE_TOKEN_FURLADS),
    },
    {
      name: "Three Counties Facebook",
      pageId: String(process.env.FACEBOOK_PAGE_ID_THREE_COUNTIES || "").trim(),
      hasToken: hasValue(process.env.FACEBOOK_PAGE_TOKEN_THREE_COUNTIES),
    },
  ].filter((page) => page.pageId)

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
            service.key === "facebook"
              ? facebookConfigured
              : !!connection?.accessToken

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

              {service.key === "facebook" ? (
                <>
                  {connected ? (
                    <div className="mb-4">
                      <div className="font-semibold text-green-600">Connected</div>

                      <div className="mt-1 text-xs text-gray-500">
                        Webhook: Active via environment configuration
                      </div>

                      <div className="mt-2 space-y-1">
                        {facebookPages.map((page) => (
                          <div
                            key={page.pageId}
                            className="rounded border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-700"
                          >
                            <div className="font-medium">{page.name}</div>
                            <div>Page ID: {page.pageId}</div>
                            <div>
                              Token: {page.hasToken ? "Configured" : "Missing"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <div className="font-semibold text-red-600">
                        {databaseReady ? "Not fully configured" : "Unavailable until DB is ready"}
                      </div>

                      <div className="mt-2 text-xs text-gray-500">
                        Facebook uses the Meta webhook and page tokens rather than the
                        Outlook connection flow.
                      </div>

                      <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                        Required env vars:
                        <div className="mt-1 font-mono text-[11px] leading-5">
                          FACEBOOK_WEBHOOK_VERIFY_TOKEN
                          <br />
                          FACEBOOK_PAGE_ID_FURLADS
                          <br />
                          FACEBOOK_PAGE_TOKEN_FURLADS
                          <br />
                          FACEBOOK_PAGE_ID_THREE_COUNTIES
                          <br />
                          FACEBOOK_PAGE_TOKEN_THREE_COUNTIES
                        </div>
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
                        Last Sync:{" "}
                        {connection?.lastSync
                          ? new Date(connection.lastSync).toLocaleString("en-GB")
                          : "Never"}
                      </div>

                      <div className="text-xs text-gray-500">
                        Token Expiry:{" "}
                        {connection?.tokenExpiresAt
                          ? new Date(connection.tokenExpiresAt).toLocaleString("en-GB")
                          : "Unknown"}
                      </div>

                      {connection?.syncError ? (
                        <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                          {connection.syncError}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mb-4 font-semibold text-red-600">
                      {databaseReady
                        ? service.connectable
                          ? "Not connected"
                          : "Not wired up yet"
                        : "Unavailable until DB is ready"}
                    </div>
                  )}

                  {service.connectable ? (
                    <a
                      href={`/api/inbox/outlook/connect?service=${service.key}`}
                      className={`block w-full rounded py-2 text-center text-white transition ${
                        databaseReady
                          ? "bg-black hover:bg-gray-800"
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