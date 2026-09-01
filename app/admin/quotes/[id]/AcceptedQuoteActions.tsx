import Link from 'next/link'

type Props = {
  quoteId: number
  jobId: number
}

export default function AcceptedQuoteActions({ quoteId, jobId }: Props) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">Accepted quote</div>
      <h2 className="mt-1 text-xl font-black text-emerald-950">This quote is linked to Job #{jobId}</h2>
      <p className="mt-2 text-sm leading-6 text-emerald-900">
        Keep materials and ordering against this job, then choose whether the work is going to your own staff or being offered to subcontractors.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link
          href={`/admin/landscaping/jobs/${jobId}`}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-zinc-950 px-4 text-center text-sm font-black text-white"
        >
          Job pack & ordering
        </Link>
        <Link
          href={`/jobs/${jobId}`}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-400 px-4 text-center text-sm font-black text-zinc-950"
        >
          Assign to staff
        </Link>
        <Link
          href={`/admin/subcontractors/new?jobId=${jobId}`}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-4 text-center text-sm font-black text-white"
        >
          Offer to subcontractor
        </Link>
      </div>
      <div className="mt-3 text-xs font-bold text-emerald-800">Quote #{quoteId} remains the commercial source for this job whichever delivery route you choose.</div>
    </section>
  )
}
