import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SUBCONTRACTOR_AGREEMENT_VERSION } from '@/lib/subcontractor-agreement'

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
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dayRate: true,
      skills: true,
      phone: true,
      transportRequired: true,
      cisRegistered: true,
      cisVerified: true,
      utrNumber: true,
      passwordHash: true,
      publicLiabilityExpiresAt: true,
      tradingName: true,
    },
  })

  const agreementRows = await prisma.$queryRaw<Array<{ workerId: number }>>`
    SELECT DISTINCT "workerId" FROM "SubcontractorAgreementAcceptance"
    WHERE "version"=${SUBCONTRACTOR_AGREEMENT_VERSION}
  `
  const agreementAccepted = new Set(agreementRows.map((row) => row.workerId))

  const workOrderStats = await prisma.$queryRaw<Array<{ awaiting: bigint; snags: bigint; payment: bigint }>>`
    SELECT
      COUNT(*) FILTER (WHERE "status" = 'awaiting_signoff') AS "awaiting",
      COUNT(*) FILTER (WHERE "status" = 'snag') AS "snags",
      COUNT(*) FILTER (WHERE "status" = 'approved' AND "paymentStatus" = 'pending') AS "payment"
    FROM "SubcontractorWorkOrder"
  `

  let pendingApplications = 0
  let pendingPasswordResets = 0
  try {
    const applicationStats = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS "count" FROM "SubcontractorApplication" WHERE "status"='pending'
    `
    pendingApplications = Number(applicationStats[0]?.count || 0)
    const resetStats = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS "count" FROM "SubcontractorPasswordResetRequest" WHERE "status"='pending'
    `
    pendingPasswordResets = Number(resetStats[0]?.count || 0)
  } catch {
    pendingApplications = 0
    pendingPasswordResets = 0
  }

  const awaiting = opportunities.reduce((sum, item) => sum + Number(item.sentCount) - Number(item.acceptedCount) - Number(item.declinedCount), 0)
  const accepted = opportunities.reduce((sum, item) => sum + Number(item.acceptedCount), 0)
  const workStats = workOrderStats[0] ?? { awaiting: BigInt(0), snags: BigInt(0), payment: BigInt(0) }

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-[28px] bg-gradient-to-br from-[#152315] via-[#273c1d] to-[#3b5625] p-6 text-white shadow-xl sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[#b8d874]">Trade network</div>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Subcontractors</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#dce6d6]">Build the trade network, review applications, offer work, capture acceptance, completion evidence, sign-off, CIS and payment.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/admin/subcontractors/new" className="inline-flex rounded-2xl bg-[#a9cc4b] px-5 py-3 text-sm font-black text-[#17220f]">+ Send an opportunity</Link>
          <Link href="/admin/subcontractors/invite" className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-900 shadow-sm">+ Invite a subcontractor</Link>
          <Link href="/admin/subcontractors/applications" className="inline-flex rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-900 shadow-sm">Applications{pendingApplications ? ` (${pendingApplications})` : ''} →</Link>
          <Link href="/admin/subcontractors/password-resets" className="inline-flex rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-900 shadow-sm">Password resets{pendingPasswordResets ? ` (${pendingPasswordResets})` : ''} →</Link>
          <Link href="/admin/subcontractors/work-orders" className="inline-flex rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-900 shadow-sm">Work orders & sign-off →</Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Applications" value={String(pendingApplications)} />
        <Stat label="Awaiting reply" value={String(awaiting)} />
        <Stat label="Accepted" value={String(accepted)} />
        <Stat label="Awaiting sign-off" value={String(Number(workStats.awaiting))} />
        <Stat label="Snags / payment" value={`${Number(workStats.snags)} / ${Number(workStats.payment)}`} />
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
          {contractors.map((worker) => {
            const expired = worker.publicLiabilityExpiresAt ? worker.publicLiabilityExpiresAt.getTime() < Date.now() : false
            const agreementOk = agreementAccepted.has(worker.id)
            const blockers = expired ? ['Insurance expired'] : []
            const actions = [
              !worker.passwordHash ? 'Account setup' : null,
              !agreementOk ? 'Agreement' : null,
              !worker.utrNumber ? 'UTR' : null,
              worker.cisRegistered && !worker.cisVerified ? 'CIS verification' : null,
              !worker.publicLiabilityExpiresAt ? 'Insurance' : null,
            ].filter(Boolean) as string[]
            const readiness = blockers.length ? 'Cannot offer work' : actions.length ? 'Action needed' : 'Ready to work'
            const readinessClass = blockers.length ? 'bg-red-100 text-red-800' : actions.length ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800'
            return <Link href={`/admin/subcontractors/${worker.id}`} key={worker.id} className="rounded-2xl border border-zinc-200 p-4 transition hover:border-[#a7c662] hover:bg-[#fbfdf7]"><div className="flex items-start justify-between gap-2"><div><div className="font-black">{worker.firstName} {worker.lastName}</div>{worker.tradingName ? <div className="mt-1 text-xs font-bold text-zinc-500">{worker.tradingName}</div> : null}</div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${readinessClass}`}>{readiness}</span></div><div className="mt-1 text-xs font-semibold text-zinc-500">{worker.skills.length ? worker.skills.join(' · ') : 'General subcontractor'}</div>{actions.length ? <div className="mt-2 text-xs font-bold text-amber-800">Needs: {actions.join(' · ')}</div> : null}{blockers.length ? <div className="mt-2 text-xs font-black text-red-700">{blockers.join(' · ')}</div> : null}<div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-[#edf3e4] px-2.5 py-1 text-[#59712c]">{worker.dayRate != null ? `£${worker.dayRate}/day` : 'Rate not set'}</span>{worker.transportRequired ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Transport required</span> : null}<span className={`rounded-full px-2.5 py-1 ${worker.cisVerified ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-600'}`}>{worker.cisVerified ? 'CIS verified' : 'CIS check needed'}</span><span className={`rounded-full px-2.5 py-1 ${expired ? 'bg-red-100 text-red-800' : 'bg-zinc-100 text-zinc-600'}`}>{expired ? 'Insurance expired' : worker.publicLiabilityExpiresAt ? 'Insurance recorded' : 'Insurance not recorded'}</span></div></Link>
          })}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>
}
