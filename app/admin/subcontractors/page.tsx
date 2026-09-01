import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Opportunity = {
  id: number
  company: string
  title: string
  trade: string
  roughArea: string
  pricingMode: string
  fixedPrice: number | null
  status: string
  createdAt: Date
  sentCount: bigint
  interestedCount: bigint
  acceptedCount: bigint
  declinedCount: bigint
}

export default async function SubcontractorsPage() {
  const opportunities = await prisma.$queryRaw<Opportunity[]>`
    SELECT o."id", o."company", o."title", o."trade", o."roughArea", o."pricingMode", o."fixedPrice", o."status", o."createdAt",
      COUNT(r."id") AS "sentCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'interested') AS "interestedCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'accepted') AS "acceptedCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'declined') AS "declinedCount"
    FROM "SubcontractorOpportunity" o
    LEFT JOIN "SubcontractorOpportunityRecipient" r ON r."opportunityId" = o."id"
    GROUP BY o."id"
    ORDER BY o."createdAt" DESC
    LIMIT 100
  `

  const contractors = await prisma.worker.findMany({
    where: { active: true, employmentType: 'subcontractor' },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: { id: true, firstName: true, lastName: true, dayRate: true, skills: true, phone: true, transportRequired: true },
  })

  const awaiting = opportunities.reduce((sum, item) => sum + Number(item.sentCount) - Number(item.acceptedCount) - Number(item.declinedCount), 0)
  const accepted = opportunities.reduce((sum, item) => sum + Number(item.acceptedCount), 0)

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-[28px] bg-gradient-to-br from-[#152315] via-[#273c1d] to-[#3b5625] p-6 text-white shadow-xl sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[#b8d874]">Trade network</div>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Subcontractors</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#dce6d6]">Send a private opportunity, track who has viewed it, and record interest, acceptance or decline against the job.</p>
        <div className="mt-5"><Link href="/admin/subcontractors/new" className="inline-flex rounded-2xl bg-[#a9cc4b] px-5 py-3 text-sm font-black text-[#17220f]">+ Send an opportunity</Link></div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open opportunities" value={String(opportunities.filter((item) => item.status === 'open').length)} />
        <Stat label="Awaiting reply" value={String(awaiting)} />
        <Stat label="Active subcontractors" value={String(contractors.length)} />
        <Stat label="Accepted" value={String(accepted)} />
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.15em] text-[#789333]">Live work</div><h2 className="mt-1 text-2xl font-black">Current opportunities</h2></div><Link href="/admin/subcontractors/new" className="text-sm font-black text-[#4d6828]">Send another →</Link></div>
        <div className="mt-4 space-y-3">
          {opportunities.length ? opportunities.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[1.5fr_.7fr_.8fr_.8fr] md:items-center">
              <div><div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">#{item.id} · {item.company === 'three-counties' ? 'Three Counties' : 'Furlads'}</div><div className="mt-1 font-black text-zinc-900">{item.title}</div><div className="mt-1 text-xs font-semibold text-zinc-500">{item.trade} · {item.roughArea}</div></div>
              <div><div className="text-[10px] font-black uppercase text-zinc-400">Trade price</div><div className="mt-1 text-sm font-black">{item.pricingMode === 'price' && item.fixedPrice != null ? `£${item.fixedPrice.toLocaleString('en-GB')}` : 'Quote requested'}</div></div>
              <div><div className="text-[10px] font-black uppercase text-zinc-400">Responses</div><div className="mt-1 text-sm font-black">{Number(item.interestedCount)} interested · {Number(item.acceptedCount)} accepted</div></div>
              <div><div className="text-[10px] font-black uppercase text-zinc-400">Sent</div><div className="mt-1 text-sm font-black">{Number(item.sentCount)} subcontractor{Number(item.sentCount) === 1 ? '' : 's'}</div></div>
            </div>
          )) : <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm font-semibold text-zinc-500">No opportunities yet. The next one you send will appear here.</div>}
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.15em] text-[#789333]">Network</div><h2 className="mt-1 text-2xl font-black">Active subcontractors</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contractors.map((worker) => <div key={worker.id} className="rounded-2xl border border-zinc-200 p-4"><div className="font-black">{worker.firstName} {worker.lastName}</div><div className="mt-1 text-xs font-semibold text-zinc-500">{worker.skills.length ? worker.skills.join(' · ') : 'General subcontractor'}</div><div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-[#edf3e4] px-2.5 py-1 text-[#59712c]">{worker.dayRate != null ? `£${worker.dayRate}/day` : 'Rate not set'}</span>{worker.transportRequired ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Transport required</span> : null}</div></div>)}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>
}
