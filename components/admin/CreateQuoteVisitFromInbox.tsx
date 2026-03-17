"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Props = {
  conversationId: string
  contactName?: string | null
}

type AvailabilityResponse = {
  ok: boolean
  quoteCount: number
  maxReached: boolean
  slots: Array<{
    time: string
    available: boolean
    reason?: string
  }>
}

function todayIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function CreateQuoteVisitFromInbox({
  conversationId,
  contactName,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [visitDate, setVisitDate] = useState(todayIso())
  const [selectedTime, setSelectedTime] = useState("")
  const [allowOverride, setAllowOverride] = useState(false)
  const [overrideTime, setOverrideTime] = useState("")
  const [notes, setNotes] = useState("")
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)

  const effectiveTime = useMemo(() => {
    if (allowOverride) return overrideTime.trim()
    return selectedTime.trim()
  }, [allowOverride, overrideTime, selectedTime])

  async function loadAvailability(date: string) {
    if (!date) return

    try {
      setLoadingSlots(true)
      setError("")
      setSuccess("")

      const res = await fetch(
        `/api/inbox/conversations/${conversationId}/quote-visit/availability?date=${encodeURIComponent(date)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      )

      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load availability.")
      }

      setAvailability(data)
      if (!allowOverride) {
        const firstAvailable = (data.slots || []).find((slot: any) => slot.available)
        setSelectedTime(firstAvailable?.time || "")
      }
    } catch (err) {
      setAvailability(null)
      setError(err instanceof Error ? err.message : "Failed to load availability.")
    } finally {
      setLoadingSlots(false)
    }
  }

  async function handleOpen() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (!open && visitDate) {
      await loadAvailability(visitDate)
    }
  }

  async function handleCreate() {
    if (!visitDate) {
      setError("Please choose a date.")
      setSuccess("")
      return
    }

    if (!effectiveTime) {
      setError("Please choose a time.")
      setSuccess("")
      return
    }

    try {
      setCreating(true)
      setError("")
      setSuccess("")

      const res = await fetch(
        `/api/inbox/conversations/${conversationId}/quote-visit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            visitDate,
            startTime: effectiveTime,
            allowQuoteTimeOverride: allowOverride,
            notes,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to create quote visit.")
      }

      setSuccess("Quote visit created successfully.")
      setNotes("")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quote visit.")
      setSuccess("")
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-zinc-900">Create Quote Visit</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Book Trev from this thread for {contactName || "this lead"}.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          {open ? "Close" : "Create Quote Visit"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Visit date
            </label>
            <input
              type="date"
              value={visitDate}
              onChange={async (e) => {
                const nextDate = e.target.value
                setVisitDate(nextDate)
                setSelectedTime("")
                await loadAvailability(nextDate)
              }}
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-zinc-700">
                Trev quote slots
              </label>
              {availability ? (
                <span className="text-xs text-zinc-500">
                  {availability.quoteCount}/3 booked
                </span>
              ) : null}
            </div>

            {loadingSlots ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                Loading availability...
              </div>
            ) : availability ? (
              <div className="grid grid-cols-3 gap-2">
                {availability.slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available || allowOverride}
                    onClick={() => setSelectedTime(slot.time)}
                    className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
                      selectedTime === slot.time && !allowOverride
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : slot.available
                        ? "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
                        : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    <div>{slot.time}</div>
                    <div className="mt-1 text-[11px] font-medium">
                      {slot.available ? "Available" : slot.reason || "Booked"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                Choose a date to load Trev’s availability.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
              <input
                type="checkbox"
                checked={allowOverride}
                onChange={(e) => {
                  setAllowOverride(e.target.checked)
                  if (!e.target.checked) {
                    setOverrideTime("")
                  }
                }}
              />
              Allow specific-time override
            </label>

            {allowOverride ? (
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Override time
                </label>
                <input
                  type="time"
                  value={overrideTime}
                  onChange={(e) => setOverrideTime(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-500"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  This still stays capped at 3 quote visits total for the day.
                </p>
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Notes for the visit
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Any useful details from the enquiry..."
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-500"
            />
          </div>

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
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create Quote Visit"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}