"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type Props = {
  conversationId: string
  externalThreadId: string
  contactName?: string | null
}

const QUICK_REPLIES = [
  "Thanks for your message — we’ll get back to you shortly.",
  "What postcode is the job at please?",
  "Can you send a few photos of the area please?",
  "When would you like us to come out and have a look?",
]

export default function FacebookReplyComposer({
  conversationId,
  externalThreadId,
  contactName,
}: Props) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function sendMessage(text: string) {
    const trimmed = text.trim()

    if (!trimmed) {
      setError("Please type a message first.")
      setSuccess("")
      return
    }

    try {
      setSending(true)
      setError("")
      setSuccess("")

      const res = await fetch("/api/inbox/facebook/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          externalThreadId,
          messageText: trimmed,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to send Facebook reply.")
      }

      setMessage("")
      setSuccess(`Reply sent${contactName ? ` to ${contactName}` : ""}.`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply.")
      setSuccess("")
    } finally {
      setSending(false)
    }
  }

  async function handleSend() {
    await sendMessage(message)
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-bold text-zinc-900">Reply on Facebook</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Send a direct Facebook Messenger reply from this thread.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Quick replies
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => setMessage(reply)}
                disabled={sending}
                className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your reply here..."
          rows={5}
          className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-500"
        />

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send Facebook reply"}
          </button>
        </div>
      </div>
    </div>
  )
}