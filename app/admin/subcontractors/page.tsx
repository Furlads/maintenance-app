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
  replyBy: Date | null
  sentCount: bigint
  interestedCount: bigint
  counterCount: bigint
  awardedCount: bigint
  acceptedCount: bigint
  declinedCount: bigint
}

type Contractor = {
  id: number; firstName: string; lastName: string; dayRate: number | null; skills: string[]; phone: string | null;
  transportRequired: boolean; cisRegistered: boolean; cisVerified: boolean; utrNumber: string | null; passwordHash: string | null;
  publicLiabilityExpiresAt: Date | null; tradingName: string | null; availabilityStatus: string; unavailableUntil: Date | null;
  doNotUse: boolean; teamSize: number | null; teamDayRate: number | null; workSetup: string;
}

export default async function SubcontractorsPage() {
  await prisma.$executeRaw`
    UPDATE "SubcontractorOpportunityRecipient" r
    SET "status"='expired'
    FROM "SubcontractorOpportunity" o
    WHERE r."opportunityId"=o."id" AND o."replyBy" IS NOT NULL AND o."replyBy" < CURRENT_TIMESTAMP
      AND r."status" IN ('sent','viewed','interested','countered')
  `

  const opportunities = await prisma.$queryRaw<Opportunity[]>`
    SELECT o."id", o."company", o."title", o."trade", o."roughArea", o."pricingMode", o."fixedPrice", o."status", o."createdAt", o."replyBy",
      COUNT(r."id") AS "sentCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'interested') AS "interestedCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'countered') AS "counterCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'awarded') AS "awardedCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'accepted') AS "acceptedCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'declined') AS "declinedCount"
    FROM "SubcontractorOpportunity" o
    LEFT JOIN "SubcontractorOpportunityRecipient" r ON r."opportunityId" = o."id"
    GROUP BY o."id"
    ORDER BY o."createdAt" DESC
    LIMIT 100
  `

  const contractors = await prisma.$queryRaw<Contractor[]>`
    SELECT "id", "firstName", "lastName", "dayRate", "skills", "phone", "transportRequired", "cisRegistered", "cisVerified",
      "utrNumber", "passwordHash", "publicLiabilityExpiresAt", "tradingName", "availabilityStatus", "unavailableUntil", "doNotUse",
      "teamSize", "teamDayRate", "workSetup"
    FROM "Worker" WHERE "active"=TRUE AND "employmentType"='subcontractor'
    ORDER BY "firstName" ASC, "lastName" ASC
  `

  const agreementRows = await prisma.$queryRaw<Array<{ workerId: number }>>`
    SELECT DISTINCT "workerId" FROM "SubcontractorAgreementAcceptance"
    WHERE "version"=${SUBCONTRACTOR_AGREEMENT_VERSION}
  `
  const agreementAccepted = new Set(agreementRows.map((row) => row.workerId))

  const workOrderStats = await prisma.$queryRaw<Array<{ awaiting: bigint; snags: bigint; payment: bigint }>>`
    SELECT COUNT(*) FILTER (WHERE "status" = 'awaiting_signoff') AS "awaiting",
      COUNT(*) FILTER (WHERE "status" = 'snag') AS "snags",
      COUNT(*) FILTER (WHERE "status" = 'approved' AND "paymentStatus" = 'pending') AS "payment"
    FROM "SubcontractorWorkOrder"
  `

  let pendingApplications = 0
  let pendingPasswordResets = 0
  try {
    const applicationStats = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS "count" FROM "SubcontractorApplication" WHERE "status"='pending'`
    pendingApplications = Number(applicationStats[0]?.count || 0)
    const resetStats = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS "count" FROM "SubcontractorPasswordResetRequest" WHERE "status"='pending'`
    pendingPasswordResets = Number(resetStats[0]?.count || 0)
  } catch { pendingApplications = 0; pendingPasswordResets = 0 }

  const awaiting = opportunities.reduce((sum, item) => sum + Number(item.interestedCount) + Number(item.counterCount) + Number(item.awardedCount), 0)
  const accepted = opportunities.reduce((sum, item) => sum + Number(item.acceptedCount), 0)
  const workStats = workOrderStats[0] ?? { awaiting: BigInt(0), snags: BigInt(0), payment: BigInt(0) }

  return <div className="space-y-3 pb-4 sm:space-y-4 sm:pb-8">
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[#789333] sm:text-xs">Trade network</div>
      <h1 className="mt-1.5 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">Subcontractors</h1>
      <p className="mt-1.5 max-w-2xl text-sm font-semibold leading-5 text-zinc-600 sm:leading-6">Manage applications, work offers, sign-off, CIS and payments without clutter.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Link href="/admin/subcontractors/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#a9cc4b] px-3 text-center text-xs font-black text-[#17220f] sm:px-4 sm:text-sm">+ Opportunity</Link>
        <Link href="/admin/subcontractors/invite" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 text-center text-xs font-black text-zinc-900 sm:px-4 sm:text-sm">+ Invite</Link>
        <Link href="/admin/subcontractors/applications" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-center text-xs font-black text-zinc-900 sm:px-4 sm:text-sm">Applications{pendingApplications ? ` (${pendingApplications})` : ''}</Link>
        <Link href="/admin/subcontractors/password-resets" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-center text-xs font-black text-zinc-900 sm:px-4 sm:text-sm">Password resets{pendingPasswordResets ? ` (${pendingPasswordResets})` : ''}</Link>
        <Link href="/admin/subcontractors/work-orders" className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-3 text-center text-xs font-black text-yellow-300 sm:col-span-1 sm:px-4 sm:text-sm">Work orders & sign-off</Link>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5"><Stat label="Applications" value={String(pendingApplications)} /><Stat label="Needs decision" value={String(awaiting)} /><Stat label="Confirmed" value={String(accepted)} /><Stat label="Awaiting sign-off" value={String(Number(workStats.awaiting))} /><Stat label="Snags / payment" value={`${Number(workStats.snags)} / ${Number(workStats.payment)}`} /></section>

    <section className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm sm:p-5">
      <div className="flex items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#789333] sm:text-xs">Live work</div><h2 className="mt-1 text-lg font-black text-zinc-950 sm:text-xl">Current opportunities</h2></div><Link href="/admin/subcontractors/new" className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-2 text-[11px] font-black text-[#4d6828] sm:text-sm">Send another</Link></div>
      <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
        {opportunities.length ? opportunities.map((item) => <Link href={`/admin/subcontractors/opportunities/${item.id}`} key={item.id} className="block rounded-xl border border-zinc-200 bg-zinc-50 p-3 transition hover:border-[#a7c662] hover:bg-[#fbfdf7] sm:rounded-2xl sm:p-4 md:grid md:grid-cols-[1.4fr_.7fr_1fr_.55fr] md:items-center md:gap-3">
          <div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-wider text-zinc-400 sm:text-[10px]">#{item.id} · {item.company === 'three-counties' ? 'Three Counties' : 'Furlads'}</div><div className="mt-1 truncate font-black text-zinc-900">{item.title}</div><div className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-zinc-500 sm:text-xs">{item.trade} · {item.roughArea}{item.replyBy ? ` · reply by ${item.replyBy.toLocaleDateString('en-GB')}` : ''}</div></div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:mt-0 md:block"><div><div className="text-[9px] font-black uppercase text-zinc-400 sm:text-[10px]">Trade price</div><div className="mt-0.5 text-xs font-black sm:mt-1 sm:text-sm">{item.pricingMode === 'price' && item.fixedPrice != null ? `£${item.fixedPrice.toLocaleString('en-GB')}` : 'Quote requested'}</div></div><div className="md:hidden"><div className="text-[9px] font-black uppercase text-zinc-400">Status</div><div className="mt-0.5 text-xs font-black text-[#56752c]">Manage →</div></div></div>
          <div className="mt-2 md:mt-0"><div className="text-[9px] font-black uppercase text-zinc-400 sm:text-[10px]">Responses</div><div className="mt-0.5 text-[11px] font-black leading-5 sm:mt-1 sm:text-sm">{Number(item.interestedCount)} interested · {Number(item.counterCount)} counter · {Number(item.awardedCount)} awarded · {Number(item.acceptedCount)} confirmed</div></div>
          <div className="hidden text-right text-sm font-black text-[#56752c] md:block">Manage →</div>
        </Link>) : <div className="rounded-xl border border-dashed border-zinc-300 p-5 text-center text-sm font-semibold text-zinc-500 sm:rounded-2xl sm:p-8">No opportunities yet. The next one you send will appear here.</div>}
      </div>
    </section>

    <section className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm sm:p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#789333] sm:text-xs">Network</div><h2 className="mt-1 text-lg font-black text-zinc-950 sm:text-xl">Active subcontractors</h2>
      <div className="mt-3 grid gap-2.5 sm:mt-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        {contractors.map((worker) => {
          const expired = worker.publicLiabilityExpiresAt ? worker.publicLiabilityExpiresAt.getTime() < Date.now() : false
          const unavailable = worker.availabilityStatus === 'unavailable' || !!(worker.unavailableUntil && worker.unavailableUntil.getTime() > Date.now())
          const agreementOk = agreementAccepted.has(worker.id)
          const blockers = [expired ? 'Insurance expired' : null, worker.doNotUse ? 'Do not use' : null, unavailable ? 'Unavailable' : null].filter(Boolean) as string[]
          const actions = [!worker.passwordHash ? 'Account setup' : null, !agreementOk ? 'Agreement' : null, !worker.utrNumber ? 'UTR' : null, worker.cisRegistered && !worker.cisVerified ? 'CIS verification' : null, !worker.publicLiabilityExpiresAt ? 'Insurance' : null].filter(Boolean) as string[]
          const readiness = blockers.length ? 'Cannot offer work' : actions.length ? 'Action needed' : worker.availabilityStatus === 'limited' ? 'Limited' : 'Ready to work'
          const readinessClass = blockers.length ? 'bg-red-100 text-red-800' : actions.length ? 'bg-amber-100 text-amber-900' : worker.availabilityStatus === 'limited' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
          return <Link href={`/admin/subcontractors/${worker.id}`} key={worker.id} className="rounded-xl border border-zinc-200 p-3 transition hover:border-[#a7c662] hover:bg-[#fbfdf7] sm:rounded-2xl sm:p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate font-black">{worker.firstName} {worker.lastName}</div>{worker.tradingName ? <div className="mt-0.5 truncate text-[11px] font-bold text-zinc-500 sm:text-xs">{worker.tradingName}</div> : null}</div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase sm:px-2.5 sm:text-[10px] ${readinessClass}`}>{readiness}</span></div><div className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-zinc-500 sm:text-xs">{worker.skills.length ? worker.skills.join(' · ') : 'General subcontractor'}</div>{actions.length ? <div className="mt-2 text-[11px] font-bold leading-5 text-amber-800 sm:text-xs">Needs: {actions.join(' · ')}</div> : null}{blockers.length ? <div className="mt-2 text-[11px] font-black leading-5 text-red-700 sm:text-xs">{blockers.join(' · ')}</div> : null}<div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-bold sm:mt-3 sm:gap-2 sm:text-xs"><span className="rounded-full bg-[#edf3e4] px-2.5 py-1 text-[#59712c]">{worker.teamDayRate != null ? `${worker.teamSize || '?'}-person team £${worker.teamDayRate}/day` : worker.dayRate != null ? `£${worker.dayRate}/day` : 'Rate not set'}</span>{worker.transportRequired ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Transport required</span> : null}<span className={`rounded-full px-2.5 py-1 ${worker.cisVerified ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-600'}`}>{worker.cisVerified ? 'CIS verified' : 'CIS check needed'}</span></div></Link>
        })}
      </div>
    </section>
  </div>
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4"><div className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500 sm:text-[10px] sm:tracking-wider">{label}</div><div className="mt-1.5 text-2xl font-black sm:mt-2">{value}</div></div> }
