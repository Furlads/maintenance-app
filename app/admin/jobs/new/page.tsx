"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"

export default function NewJobPage() {

  const params = useSearchParams()

  const name = params.get("name") ?? ""
  const summary = params.get("summary") ?? ""

  const [title, setTitle] = useState(summary)
  const [customerName, setCustomerName] = useState(name)
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState(summary)

  return (
    <div className="space-y-6 max-w-xl">

      <div>
        <h1 className="text-2xl font-bold">Create Job</h1>
        <p className="text-sm text-zinc-500">
          Create a new job for the schedule
        </p>
      </div>

      <div className="space-y-4">

        <div>
          <label className="text-sm font-medium">Title</label>
          <input
            className="w-full border rounded-lg p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Customer Name</label>
          <input
            className="w-full border rounded-lg p-2"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Address</label>
          <input
            className="w-full border rounded-lg p-2"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Notes</label>
          <textarea
            className="w-full border rounded-lg p-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button className="bg-black text-white px-4 py-2 rounded-lg">
          Save Job
        </button>

      </div>

    </div>
  )
}