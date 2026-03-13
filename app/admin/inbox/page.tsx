import { prisma } from "@/lib/prisma"
import SourceBadge from "@/components/admin/SourceBadge"

export const dynamic = "force-dynamic"

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date))
}

export default async function AdminInboxPage() {

  const messages = await prisma.inboxMessage.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  })

  return (
    <div className="space-y-4">

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h1 className="text-2xl font-bold">Admin Inbox</h1>
        <p className="text-sm text-zinc-500">
          Messages from WhatsApp, Email, Facebook, Wix and workers
        </p>
      </div>

      <div className="space-y-3">

        {messages.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
            No inbox messages yet.
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >

            <div className="flex items-center gap-2 mb-2">
              <SourceBadge source={message.source as any} />

              <span className="text-xs text-zinc-500">
                {formatDate(message.createdAt)}
              </span>
            </div>

            <div className="font-semibold">
              {message.senderName || message.senderEmail || "Unknown sender"}
            </div>

            {message.subject && (
              <div className="text-sm text-zinc-700">
                {message.subject}
              </div>
            )}

            {message.preview && (
              <div className="text-sm text-zinc-500 mt-1">
                {message.preview}
              </div>
            )}

          </div>
        ))}

      </div>

    </div>
  )
}