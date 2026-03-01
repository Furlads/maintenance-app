'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function AddJobSuccessPage() {
  const params = useSearchParams()
  const jobId = params.get('jobId')

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-2xl border bg-white shadow-sm p-8">
        <div className="text-2xl font-semibold tracking-tight">✅ Job added</div>
        <p className="mt-2 text-sm text-gray-600">
          Nice one — what do you want to do next?
        </p>

        {jobId ? (
          <div className="mt-4 rounded-xl border bg-gray-50 px-4 py-3 text-xs text-gray-700">
            Job ID: <span className="font-mono">{jobId}</span>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/my-visits/add"
            className="inline-flex justify-center items-center rounded-lg bg-gray-900 text-white px-4 py-2 text-sm hover:opacity-90"
          >
            ➕ Add another job
          </Link>

          <Link
            href="/admin"
            className="inline-flex justify-center items-center rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            🏠 Go to dashboard
          </Link>

          {jobId ? (
            <Link
              href={`/admin/job/${encodeURIComponent(jobId)}`}
              className="inline-flex justify-center items-center rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              🔎 View job
            </Link>
          ) : null}
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Tip: if you want “Go to dashboard” automatically after a few seconds, say the word and I’ll add it.
        </div>
      </div>
    </div>
  )
}