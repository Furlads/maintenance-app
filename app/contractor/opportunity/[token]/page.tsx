import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import OpportunityActions from './OpportunityActions'
import WorkOrderPanel from './WorkOrderPanel'
import ContractorAuthGate from '../../ContractorAuthGate'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ token: string }> }

type Row = {
  recipientId: number
  workerId: number
  status: string
  firstName: string
  passwordHash: string | null
  company: string
  title: string
  trade: string
  roughArea: string
  publicDescription: string
  durationText: string | null
  timingText: string | null
  pricingMode: string
  fixedPrice: number | null
  quoteGuidance: string | null
}

export default async function ContractorOpportunityPage({ params }: Props) {
  const { token } = await params
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT r."id" AS "recipientId", r."workerId", r."status", w."firstName", w."passwordHash",
      o."company", o."title", o."trade", o."roughArea", o."publicDescription", o."durationText",
      o."timingText", o."pricingMode", o."fixedPrice", o."quoteGuidance"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "SubcontractorOpportunity" o ON o."id" = r."opportunityId"
    JOIN "Worker" w ON w."id" = r."workerId"
    WHERE r."token" = ${token}
    LIMIT 1
  `
  const item = rows[0]
  if (!item) notFound()

  const session = await getSession()
  const authenticated = !!session?.workerId && Number(session.workerId) === item.workerId
  if (!authenticated) {
    return <ContractorAuthGate token={token} firstName={item.firstName} registered={!!item.passwordHash} />
  }

  await prisma.$executeRaw`
    UPDATE "SubcontractorOpportunityRecipient"
    SET "viewedAt" = COALESCE("viewedAt", CURRENT_TIMESTAMP),
        "status" = CASE WHEN "status" = 'sent' THEN 'viewed' ELSE "status" END
    WHERE "id" = ${item.recipientId}
  `

  const displayStatus = item.status === 'sent' ? 'viewed' : item.status
  const accepted = displayStatus === 'accepted'
  const brand = item.company === 'three-counties' ? 'Three Counties Property Care' : 'Furlads'
  const priceText = item.pricingMode === 'price' && item.fixedPrice != null
    ? `£${item.fixedPrice.toLocaleString('en-GB')}`
    : 'Quote requested'

  return (
    <main className="min-h-dvh bg-[#eef2e9] px-3 py-5 text-[#162111] sm:px-5 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/contractor" className="text-sm font-black text-[#506b28]">← My work dashboard</Link>
          <span className="text-xs font-bold text-zinc-500">Signed in as {item.firstName}</span>
        </div>

        <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#13220f] via-[#223718] to-[#30491c] p-6 text-white shadow-2xl sm:p-8">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-[#b8d874]">{brand} · {accepted ? 'Accepted work order' : 'Private opportunity'}</div>
          <h1 className="mt-3 text-4xl font-black leading-none tracking-tight sm:text-5xl">{accepted ? `Hi ${item.firstName}, here’s the job.` : `Hi ${item.firstName}, interested in this job?`}</h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[#dce6d6] sm:text-base">{accepted ? 'You have accepted this work. The complete job pack, completion evidence and sign-off are available below.' : 'Customer identity and exact address are kept private at this stage. Here’s enough information to decide whether you want the work.'}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Trade" value={item.trade} />
            <Stat label="Rough area" value={item.roughArea} />
            <Stat label="Likely duration" value={item.durationText || 'To be confirmed'} />
          </div>
        </section>

        {!accepted ? <section className="grid gap-4 md:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-3xl border border-[#dfe6d7] bg-white p-5 shadow-sm sm:p-6">
            <div className="text-xs font-black uppercase tracking-[0.15em] text-[#6d852f]">Job outline</div>
            <h2 className="mt-2 text-2xl font-black">{item.title}</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-6 text-zinc-600">{item.publicDescription}</p>
            {item.timingText ? <div className="mt-4 rounded-2xl bg-[#f0f5e8] p-4 text-sm font-bold text-[#435334]">Target timing: {item.timingText}</div> : null}
          </div>
          <aside className="rounded-3xl border border-[#d7e4bf] bg-[#f7f9f2] p-5 sm:p-6">
            <div className="text-xs font-black uppercase tracking-[0.15em] text-[#6d852f]">{item.pricingMode === 'price' ? 'Trade price' : 'Pricing'}</div>
            <div className="mt-3 text-4xl font-black text-[#1f3215]">{priceText}</div>
            {item.quoteGuidance ? <p className="mt-3 text-sm font-semibold leading-5 text-zinc-600">{item.quoteGuidance}</p> : null}
          </aside>
        </section> : null}

        <section className="rounded-3xl border border-[#dfe6d7] bg-white p-5 shadow-sm sm:p-6">
          <OpportunityActions token={token} initialStatus={displayStatus} />
        </section>

        {accepted ? <>
          <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm sm:p-6">
            <div className="text-xs font-black uppercase tracking-[0.15em] text-blue-800">Customer data & privacy</div>
            <p className="mt-2 text-sm font-semibold leading-6 text-blue-950">Customer names, contact details, addresses, photos and job information are provided only so you can carry out this work. Do not forward or share customer information, and do not retain customer details for your own use once the work is complete.</p>
          </section>
          <WorkOrderPanel token={token} />
        </> : null}

        <p className="text-center text-xs font-semibold text-zinc-500">{accepted ? 'Your account verification protects the customer details in this work order.' : 'No customer contact details are shared until you accept the work.'}</p>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/10 p-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#b8d874]">{label}</div><div className="mt-2 font-black">{value}</div></div>
}
