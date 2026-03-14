import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type InboxConnectionRow = {
  id: string
  service: string
  account: string | null
  lastSync: Date | null
  createdAt: Date
  updatedAt: Date
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

  const services = [
    {
      key: "furlads_email",
      name: "Furlads Email",
      icon: "📧",
      description: "Main Furlads customer enquiries",
    },
    {
      key: "threecounties_email",
      name: "Three Counties Email",
      icon: "📧",
      description: "Three Counties Property Care enquiries",
    },
    {
      key: "facebook",
      name: "Facebook Messages",
      icon: "📘",
      description: "Facebook page messages",
    },
    {
      key: "whatsapp",
      name: "WhatsApp Business",
      icon: "💬",
      description: "Customer WhatsApp enquiries",
    },
    {
      key: "wix",
      name: "Wix Website Forms",
      icon: "🌐",
      description: "Website contact form submissions",
    },
  ]

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Inbox Connections</h1>

      <p className="text-gray-600 mb-8">
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
          <div className="mt-3 text-sm text-yellow-700">
            Run:
          </div>
          <pre className="mt-2 overflow-x-auto rounded bg-yellow-100 p-3 text-sm text-yellow-900">
{`npx prisma migrate dev --name add_inbox_connections
npx prisma generate`}
          </pre>
          <div className="mt-3 text-xs text-yellow-700 break-words">
            Technical error: {errorMessage}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => {
          const connection = connections.find((c) => c.service === service.key)
          const connected = !!connection

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

              {connected ? (
                <div className="mb-4">
                  <div className="font-semibold text-green-600">Connected</div>

                  <div className="mt-1 text-xs text-gray-500">
                    Account: {connection.account || "Configured"}
                  </div>

                  <div className="text-xs text-gray-500">
                    Last Sync:{" "}
                    {connection.lastSync
                      ? new Date(connection.lastSync).toLocaleString("en-GB")
                      : "Never"}
                  </div>
                </div>
              ) : (
                <div className="mb-4 font-semibold text-red-600">
                  {databaseReady ? "Not connected" : "Unavailable until DB is ready"}
                </div>
              )}

              <button
                disabled={!databaseReady}
                className={`w-full rounded py-2 text-white transition ${
                  databaseReady
                    ? "bg-black hover:bg-gray-800"
                    : "cursor-not-allowed bg-gray-400"
                }`}
              >
                {connected ? "Reconnect" : "Connect"}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}