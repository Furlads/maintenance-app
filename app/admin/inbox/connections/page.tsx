import { prisma } from "@/lib/prisma";

export default async function InboxConnectionsPage() {
  const connections = await prisma.inboxConnection.findMany({
    orderBy: { createdAt: "asc" },
  });

  const services = [
    { key: "furlads_email", name: "Furlads Email", icon: "📧" },
    { key: "threecounties_email", name: "Three Counties Email", icon: "📧" },
    { key: "facebook", name: "Facebook Messages", icon: "📘" },
    { key: "whatsapp", name: "WhatsApp Business", icon: "💬" },
    { key: "wix", name: "Wix Website Forms", icon: "🌐" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Inbox Connections</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => {
          const connection = connections.find((c) => c.service === service.key);

          return (
            <div
              key={service.key}
              className="border rounded-lg p-4 shadow-sm bg-white"
            >
              <div className="flex items-center gap-2 text-lg font-semibold">
                <span>{service.icon}</span>
                <span>{service.name}</span>
              </div>

              <div className="mt-3 text-sm">
                {connection ? (
                  <>
                    <div className="text-green-600 font-medium">
                      Connected
                    </div>
                    <div className="text-gray-500">
                      Last sync:{" "}
                      {connection.lastSync
                        ? new Date(connection.lastSync).toLocaleString()
                        : "Never"}
                    </div>
                  </>
                ) : (
                  <div className="text-red-600 font-medium">
                    Not connected
                  </div>
                )}
              </div>

              <div className="mt-4">
                <button className="px-4 py-2 bg-black text-white rounded">
                  {connection ? "Reconnect" : "Connect"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}