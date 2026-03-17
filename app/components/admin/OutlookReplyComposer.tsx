"use client"

import { useState } from "react"

type Props = {
  conversationId: string
  contactName?: string | null
}

export default function OutlookReplyComposer({
  conversationId,
  contactName,
}: Props) {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!message.trim()) return

    setSending(true)
    setError(null)

    try {
      const res = await fetch("/api/inbox/outlook/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          subject,
          message,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to send email")
      }

      setMessage("")
      setSubject("")
    } catch (err: any) {
      setError(err?.message || "Send failed")
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-bold text-zinc-900">Reply</h3>

      <div className="mt-3 space-y-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        />

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Reply to ${contactName || "customer"}...`}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm min-h-[120px]"
        />

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        <button
          onClick={handleSend}
          disabled={sending}
          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send Email"}
        </button>
      </div>
    </section>
  )
}