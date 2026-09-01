import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  SUBCONTRACTOR_AGREEMENT_ACCEPTANCE,
  SUBCONTRACTOR_AGREEMENT_SECTIONS,
  SUBCONTRACTOR_AGREEMENT_TITLE,
  SUBCONTRACTOR_AGREEMENT_VERSION,
} from '@/lib/subcontractor-agreement'
import AgreementForm from './AgreementForm'

export const dynamic = 'force-dynamic'

type Props = { searchParams?: Promise<{ next?: string }> }

function safeNext(value: string | undefined) {
  const next = String(value || '').trim()
  return next.startsWith('/contractor') ? next : '/contractor'
}

export default async function ContractorAgreementPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {}
  const nextPath = safeNext(params.next)
  const session = await getSession()
  if (!session?.workerId) redirect(`/login?next=${encodeURIComponent(`/contractor/agreement?next=${encodeURIComponent(nextPath)}`)}`)

  const workerId = Number(session.workerId)
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { firstName: true, lastName: true, employmentType: true, active: true },
  })
  if (!worker || !worker.active || worker.employmentType !== 'subcontractor') redirect('/worker/home')

  const accepted = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "SubcontractorAgreementAcceptance"
    WHERE "workerId" = ${workerId} AND "version" = ${SUBCONTRACTOR_AGREEMENT_VERSION}
    LIMIT 1
  `
  if (accepted[0]) redirect(nextPath)

  return <main className="min-h-dvh bg-[#eef2e9] px-4 py-6 text-[#162111] sm:px-6 sm:py-8">
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="rounded-[30px] bg-gradient-to-br from-[#13220f] via-[#223718] to-[#30491c] p-6 text-white shadow-xl sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-[#b8d874]">Subcontractor terms · version {SUBCONTRACTOR_AGREEMENT_VERSION}</div>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl">{SUBCONTRACTOR_AGREEMENT_TITLE}</h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#dce6d6]">These are the standing terms for working with Furlads. Each job you choose to accept will still have its own Work Order with the scope, price and timing for that particular job.</p>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="space-y-7">
          {SUBCONTRACTOR_AGREEMENT_SECTIONS.map((section) => <div key={section.heading}>
            <h2 className="text-xl font-black">{section.heading}</h2>
            <div className="mt-3 space-y-3">
              {section.paragraphs.map((paragraph) => <p key={paragraph} className="text-sm font-medium leading-6 text-zinc-700">{paragraph}</p>)}
            </div>
          </div>)}
        </div>
      </section>

      <AgreementForm
        title={SUBCONTRACTOR_AGREEMENT_TITLE}
        version={SUBCONTRACTOR_AGREEMENT_VERSION}
        acceptanceText={SUBCONTRACTOR_AGREEMENT_ACCEPTANCE}
        fullName={`${worker.firstName} ${worker.lastName}`.trim()}
        nextPath={nextPath}
      />

      <p className="text-center text-xs font-semibold text-zinc-500">Keep a copy for your records. If these terms are updated, you may be asked to accept the new version before accepting further work.</p>
    </div>
  </main>
}
