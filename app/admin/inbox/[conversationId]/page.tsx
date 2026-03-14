import Link from "next/link"
import * as prismaModule from "@/lib/prisma"

export const dynamic = "force-dynamic"

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type InboxMessageRow = {
  id: number
  conversationId: string
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

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—"

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

  const messages: InboxMessageRow[] = await prisma.inboxMessage.findMany({
    where: {
      conversationId: conversationId,
    },
    orderBy: {
      createdAt: "asc",
    },
  })

  if (!messages.length) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/inbox"
          className="text-blue-600 underline text-sm"
        >
          ← Back to Inbox
        </Link>

        <div className="rounded-xl border bg-white p-6">
          Conversation not found.
        </div>
      </div>
    )
  }

  const first = messages[0]

  const displayName =
    first.senderName ||
    first.senderEmail ||
    first.senderPhone ||
    "Unknown sender"

  const phone = first.senderPhone
  const email = first.senderEmail

  const whatsappNumber = phone
    ? normalisePhoneForWhatsApp(phone)
    : ""

  return (
    <div className="space-y-4">

      <Link
        href="/admin/inbox"
        className="text-blue-600 underline text-sm"
      >
        ← Back to Inbox
      </Link>

      {/* CONTACT HEADER */}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">

        <h1 className="text-xl font-bold">{displayName}</h1>

        <div className="mt-1 text-sm text-zinc-500 flex gap-4 flex-wrap">
          {phone && <span>{phone}</span>}
          {email && <span>{email}</span>}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">

          {phone && (
            <a
              href={`tel:${phone}`}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white"
            >
              📞 Call
            </a>
          )}

          {phone && (
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white"
            >
              💬 WhatsApp
            </a>
          )}

          {email && (
            <a
              href={`mailto:${email}`}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              ✉ Email
            </a>
          )}

          {!first.customerId && (
            <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
              Create Customer
            </button>
          )}

          {!first.jobId && (
            <button className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800">
              Create Job
            </button>
          )}
        </div>

      </section>

      {/* MESSAGES */}

      <section className="space-y-3">

        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >
            <div className="text-xs text-zinc-500 mb-2">
              {formatDateTime(message.createdAt)}
            </div>

            {message.subject && (
              <div className="font-semibold mb-1">
                {message.subject}
              </div>
            )}

            <div className="text-sm whitespace-pre-wrap text-zinc-700">
              {message.body || message.preview}
            </div>
          </div>
        ))}

      </section>
    </div>
  )
}