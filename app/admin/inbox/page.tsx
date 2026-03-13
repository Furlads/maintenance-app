import { prisma } from '@/lib/prisma'
import SourceBadge from '@/components/admin/SourceBadge'

export const dynamic = 'force-dynamic'

type InboxRow = {
  id: number
  source: string
  senderName: string | null
  senderEmail: string | null
  subject: string | null
  preview: string | null
  status: string
  assignedTo: string | null
  createdAt: Date
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function safeSource(source: string): any {
  switch ((source || '').toLowerCase()) {
    case 'whatsapp':
      return 'whatsapp'
    case 'furlads-email':
      return 'furlads-email'
    case 'threecounties-email':
      return 'threecounties-email'
    case 'facebook':
      return 'facebook'
    case 'wix':
      return 'wix'
    case 'worker-quote':
      return 'worker-quote'
    default:
      return 'worker-quote'
  }
}

async function loadInboxMessagesSafe() {
  try {
    const messages = await prisma.inboxMessage.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    })

    return {
      messages: messages as InboxRow[],
      dbReady: true,
      error: '',
    }
  } catch (error) {
    console.error('ADMIN INBOX LOAD ERROR:', error)

    return {
      messages: [] as InboxRow[],
      dbReady: false,
      error:
        error instanceof Error
          ? error.message
          : 'Inbox table is not ready yet on production.',
    }
  }
}

export default async function AdminInboxPage() {
  const { messages, dbReady, error } = await loadInboxMessagesSafe()

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Admin Inbox</h1>
        <p className="text-sm text-zinc-500">
          Messages from WhatsApp, email, Facebook, Wix and workers
        </p>
      </div>

      {!dbReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="text-sm font-semibold text-amber-800">
            Inbox database not ready yet
          </div>
          <p className="mt-1 text-sm text-amber-700">
            The page is working, but the new InboxMessage table is not available
            yet in this environment.
          </p>
          <p className="mt-2 text-xs text-amber-700 break-all">
            {error}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {dbReady && messages.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
            No inbox messages yet.
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <SourceBadge source={safeSource(message.source)} />
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700">
                {message.status || 'unread'}
              </span>
              <span className="text-xs text-zinc-500">
                {formatDate(message.createdAt)}
              </span>
            </div>

            <div className="font-semibold text-zinc-900">
              {message.senderName || message.senderEmail || 'Unknown sender'}
            </div>

            {message.subject ? (
              <div className="mt-1 text-sm font-medium text-zinc-700">
                {message.subject}
              </div>
            ) : null}

            {message.preview ? (
              <div className="mt-1 text-sm text-zinc-500">
                {message.preview}
              </div>
            ) : null}

            {(message.senderEmail || message.assignedTo) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                {message.senderEmail ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-1">
                    {message.senderEmail}
                  </span>
                ) : null}
                {message.assignedTo ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-1">
                    Assigned: {message.assignedTo}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}