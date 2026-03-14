import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function InboxConnectionsPage() {

  const connections = await prisma.inboxConnection.findMany({
    orderBy: { createdAt: "asc" }
  })

  const services = [
    {
      key: "furlads_email",
      name: "Furlads Email",
      icon: "📧",
      description: "Main Furlads customer enquiries"
    },
    {
      key: "threecounties_email",
      name: "Three Counties Email",
      icon: "📧",
      description: "Three Counties Property Care enquiries"
    },
    {
      key: "facebook",
      name: "Facebook Messages",
      icon: "📘",
      description: "Facebook page messages"
    },
    {
      key: "whatsapp",
      name: "WhatsApp Business",
      icon: "💬",
      description: "Customer WhatsApp enquiries"
    },
    {
      key: "wix",
      name: "Wix Website Forms",
      icon: "🌐",
      description: "Website contact form submissions"
    }
  ]

  return (
    <div className="p-8">

      <h1 className="text-3xl font-bold mb-2">
        Inbox Connections
      </h1>

      <p className="text-gray-600 mb-8">
        Manage communication channels connected to the Furlads inbox.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {services.map((service) => {

          const connection = connections.find(
            (c) => c.service === service.key
          )

          const connected = !!connection

          return (

            <div
              key={service.key}
              className="border rounded-lg p-5 bg-white shadow-sm"
            >

              <div className="flex items-center gap-3 mb-2">

                <div className="text-2xl">
                  {service.icon}
                </div>

                <div className="font-semibold text-lg">
                  {service.name}
                </div>

              </div>

              <div className="text-sm text-gray-500 mb-4">
                {service.description}
              </div>

              {connected ? (

                <div className="mb-4">

                  <div className="text-green-600 font-semibold">
                    Connected
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    Account: {connection.account || "Configured"}
                  </div>

                  <div className="text-xs text-gray-500">
                    Last Sync:{" "}
                    {connection.lastSync
                      ? new Date(connection.lastSync).toLocaleString()
                      : "Never"}
                  </div>

                </div>

              ) : (

                <div className="mb-4 text-red-600 font-semibold">
                  Not connected
                </div>

              )}

              <button
                className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 transition"
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