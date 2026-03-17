"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type Props = {
  conversationId: string
  contactName?: string | null
}

export default function OutlookReplyComposer({
  conversationId,
  contactName,
}: Props) {
  const router = useRouter()
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handleSend() {
    const trimmedMessage = message.trim()
    const trimmedSubject = subject.trim()

    if (!trimmedMessage) {
      setError("Please type a message first.")
      setSuccess("")
      return
    }

    try {
      setSending(true)
      setError("")
      setSuccess("")

      const res = await fetch("/api/inbox/outlook/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          subject: trimmedSubject,
          message: trimmedMessage,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to send Outlook reply.")
      }

      setMessage("")
      setSubject("")
      setSuccess(`Reply sent${contactName ? ` to ${contactName}` : ""}.`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply.")
      setSuccess("")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-bold text-zinc-900">Reply by email</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Send a direct Outlook email reply from this thread.
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-500"
        />

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your reply here..."
          rows={6}
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
            {sending ? "Sending..." : "Send Email"}
          </button>
        </div>
      </div>
    </div>
  )
}