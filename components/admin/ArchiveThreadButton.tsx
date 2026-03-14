"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type ArchiveThreadButtonProps = {
  conversationId: string
}

export default function ArchiveThreadButton({
  conversationId,
}: ArchiveThreadButtonProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleArchive() {
    if (isSubmitting) return

    const confirmed = window.confirm(
      "Archive this thread? It will be hidden from the main inbox but not deleted."
    )

    if (!confirmed) return

    try {
      setIsSubmitting(true)

      const response = await fetch("/api/inbox/archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to archive thread")
      }

      router.refresh()
    } catch (error) {
      console.error("ARCHIVE THREAD BUTTON ERROR:", error)
      window.alert("Could not archive this thread.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void handleArchive()
      }}
      disabled={isSubmitting}
      className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting ? "Archiving..." : "Archive"}
    </button>
  )
}