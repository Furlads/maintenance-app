"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function AddJobSuccessPage() {
  const params = useSearchParams();
  const jobId = params.get("jobId");

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <div className="text-2xl font-semibold tracking-tight">✅ Job added</div>
        <p className="mt-2 text-sm text-gray-600">Nice one — what do you want to do next?</p>

        {jobId ? (
          <div className="mt-4 rounded-xl border bg-gray-50 px-4 py-3 text-xs text-gray-700">
            Job ID: <span className="font-mono">{jobId}</span>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/my-visits"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:opacity-90"
          >
            ➕ Add another job
          </Link>

          <Link
            href="/unscheduled"
            className="inline-flex items-center justify-center rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            🗓️ Unscheduled list
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            🏠 Home
          </Link>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Tip: if you want this to auto-redirect back to “Add another job” after a few seconds, say the word.
        </div>
      </div>
    </div>
  );
}