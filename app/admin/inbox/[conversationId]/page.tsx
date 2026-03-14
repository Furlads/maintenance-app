import Link from "next/link"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type MessageRow = {
  id: number
  source: string
  senderName: string | null
  senderEmail: string | null
  senderPhone: string | null
  subject: string | null
  preview: string | null
  body: string | null
  status: string
  customerId: number | null
  jobId: number | null
  createdAt: Date
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function normalisePhoneForWhatsApp(phone: string) {
  const cleaned = phone.replace(/\D/g, "")

  if (cleaned.startsWith("0")) {
    return `44${cleaned.slice(1)}`
  }

  if (cleaned.startsWith("44")) {
    return cleaned
  }

  return cleaned
}

export default async function ThreadPage({
  params,
}: {
  params: { conversationId: string }
}) {
  const conversationId = params.conversationId

  const messages = await prisma.inboxMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  })

  if (!messages.length) {
    return (
      <div className="p-6">
        <Link href="/admin/inbox" className="text-blue-600 underline">
          ← Back to Inbox
        </Link>
        <p className="mt-4">Conversation not found.</p>
      </div>
    )
  }

  const first = messages[0]

  const displayName =
    first.senderName || first.senderEmail || first.senderPhone || "Unknown"

  const phone = first.senderPhone
  const email = first.senderEmail

  const whatsappNumber = phone
    ? normalisePhoneForWhatsApp(phone)
    : ""

  return (
    <div className="space-y-6">

      <div className="rounded-xl border bg-white p-5">
        <Link href="/admin/inbox" className="text-sm text-blue-600 underline">
          ← Back to Inbox
        </Link>

        <h1 className="mt-2 text-2xl font-bold">
          {displayName}
        </h1>

        <div className="text-sm text-zinc-500 mt-1 flex gap-4 flex-wrap">
          {phone && <span>{phone}</span>}
          {email && <span>{email}</span>}
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">

          {phone && (
            <a
              href={`tel:${phone}`}
              className="px-3 py-2 bg-green-600 text-white rounded text-sm"
            >
              📞 Call
            </a>
          )}

          {phone && (
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              className="px-3 py-2 bg-green-500 text-white rounded text-sm"
            >
              💬 WhatsApp
            </a>
          )}

          {email && (
            <a
              href={`mailto:${email}`}
              className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
            >
              ✉ Email
            </a>
          )}

          {!first.customerId && (
            <button className="px-3 py-2 bg-black text-white rounded text-sm">
              Create Customer
            </button>
          )}

          {!first.jobId && (
            <button className="px-3 py-2 border rounded text-sm">
              Create Job
            </button>
          )}

        </div>
      </div>

      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-xl border bg-white p-4"
          >
            <div className="text-xs text-zinc-500 mb-2">
              {formatDate(message.createdAt)}
            </div>

            {message.subject && (
              <div className="font-semibold mb-1">
                {message.subject}
              </div>
            )}

            <div className="text-sm text-zinc-700 whitespace-pre-wrap">
              {message.body || message.preview}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}