import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SUBCONTRACTOR_AGREEMENT_VERSION } from '@/lib/subcontractor-agreement'

export const dynamic = 'force-dynamic'

type DashboardRow = {
  token: string
  status: string
  title: string
  trade: string
  roughArea: string
  durationText: string | null
  timingText: string | null
  fixedPrice: number | null
  pricingMode: string
  visitDate: Date | null
  startTime: string | null
  jobStatus: string | null
  workOrderStatus: string | null
  paymentStatus: string | null
}

function money(value: number | null) {
  return value == null ? 'Quote requested' : `£${value.toLocaleString('en-GB')}`
}

function formatDate(value: Date | null) {
  return value ? new Date(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Date to be confirmed'
}

export default async function ContractorDashboard() {
  const session = await getSession()
  if (!session?.workerId) redirect('/contractor/login')

  const workerId = Number(session.workerId)
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, firstName: true, employmentType: true, active: true },
  })
  if (!worker || !worker.active || worker.employmentType !== 'subcontractor') redirect('/worker/home')

  const agreement = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "SubcontractorAgreementAcceptance"
    WHERE "workerId" = ${workerId} AND "version" = ${SUBCONTRACTOR_AGREEMENT_VERSION}
    LIMIT 1
  `
  if (!agreement[0]) redirect('/contractor/agreement?next=/contractor')

  const rows = await prisma.$queryRaw<DashboardRow[]>`
    SELECT r."token", r."status", o."title", o."trade", o."roughArea", o."durationText", o."timingText",
      o."fixedPrice", o."pricingMode", j."visitDate", j."startTime", j."status" AS "jobStatus",
      wo."status" AS "workOrderStatus", wo."paymentStatus"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "SubcontractorOpportunity" o ON o."id" = r."opportunityId"
    LEFT JOIN "Job" j ON j."id" = o."sourceJobId"
    LEFT JOIN "SubcontractorWorkOrder" wo ON wo."recipientId" = r."id"
    WHERE r."workerId" = ${workerId}
    ORDER BY COALESCE(j."visitDate", o."createdAt") ASC, o."createdAt" DESC
  `

  const open = rows.filter((row) => !['declined'].includes(row.status) && row.paymentStatus !== 'paid')
  const accepted = open.filter((row) => row.status === 'accepted')
  const awaiting = open.filter((row) => ['sent', 'viewed', 'interested'].includes(row.status))
  const completed = rows.filter((row) => row.paymentStatus === 'paid' || row.workOrderStatus === 'signed_off')

  return <main className="min-h-dvh bg-[#eef2e9] px-4 py-6 text-[#162111] sm:px-6 sm:py-8">
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-[30px] bg-gradient-to-br from-[#13220f] via-[#223718] to-[#30491c] p-6 text-white shadow-xl sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-[#b8d874]">Subcontractor portal</div>
        <h1 className="mt-2 text-4xl font-black">Hi {worker.firstName}</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#dce6d6]">Your offered and accepted work in one place, so you can see what is coming up and plan your diary.</p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Accepted" value={accepted.length} />
          <Stat label="Need reply" value={awaiting.length} />
          <Stat label="Completed" value={completed.length} />
        </div>
      </section>

      {accepted.length ? <section className="space-y-3">
        <div><div className="text-xs font-black uppercase tracking-[0.14em] text-[#6d852f]">Your diary</div><h2 className="mt-1 text-2xl font-black">Accepted work</h2></div>
        <div className="grid gap-3 md:grid-cols-2">{accepted.map((row) => <JobCard key={row.token} row={row} />)}</div>
      </section> : null}

      {awaiting.length ? <section className="space-y-3">
        <div><div className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Waiting for you</div><h2 className="mt-1 text-2xl font-black">Open opportunities</h2></div>
        <div className="grid gap-3 md:grid-cols-2">{awaiting.map((row) => <JobCard key={row.token} row={row} />)}</div>
      </section> : null}

      {!open.length ? <section className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center"><h2 className="text-xl font-black">No current work</h2><p className="mt-2 text-sm font-semibold text-zinc-500">New opportunities sent to you will appear here automatically.</p></section> : null}
    </div>
  </main>
}

function JobCard({ row }: { row: DashboardRow }) {
  const status = row.workOrderStatus || row.status
  return <Link href={`/contractor/opportunity/${row.token}`} className="block rounded-3xl border border-[#dfe6d7] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.12em] text-[#6d852f]">{row.trade}</div><h3 className="mt-1 text-xl font-black">{row.title}</h3></div><span className="rounded-full bg-[#eef5dd] px-3 py-1 text-[11px] font-black uppercase text-[#4c6824]">{status.replaceAll('_', ' ')}</span></div>
    <div className="mt-4 grid gap-2 text-sm font-semibold text-zinc-600"><div>📍 {row.roughArea}</div><div>📅 {formatDate(row.visitDate)}{row.startTime ? ` · ${row.startTime}` : ''}</div><div>⏱ {row.durationText || 'Duration to be confirmed'}</div><div className="font-black text-[#233918]">💷 {row.pricingMode === 'price' ? money(row.fixedPrice) : 'Quote requested'}</div></div>
    <div className="mt-4 text-sm font-black text-[#506b28]">Open job →</div>
  </Link>
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-center"><div className="text-2xl font-black">{value}</div><div className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#cce1a0]">{label}</div></div>
}
