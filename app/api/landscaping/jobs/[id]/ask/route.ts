import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getLatestLandscapingPlan } from '@/lib/landscaping-plan'
import { getLatestLandscapingControls } from '@/lib/landscaping-controls'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: {
    id: string
  }
}

function validId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function extractResponseText(data: any) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim()
  if (!Array.isArray(data?.output)) return ''

  const parts: string[] = []
  for (const item of data.output) {
    if (item?.type !== 'message' || !Array.isArray(item?.content)) continue
    for (const content of item.content) {
      if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text)
    }
  }
  return parts.join('\n').trim()
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const jobId = validId(params.id)
    if (!jobId) return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const question = cleanText(body.question)
    if (!question) return NextResponse.json({ ok: false, error: 'Ask CHAS a question first.' }, { status: 400 })

    const [job, plan, controls, session] = await Promise.all([
      prisma.job.findUnique({
        where: { id: jobId },
        include: {
          customer: true,
          quotes: { orderBy: [{ acceptedAt: 'desc' }, { updatedAt: 'desc' }], take: 1 },
          assignments: { include: { worker: true }, orderBy: { createdAt: 'asc' } },
        },
      }),
      getLatestLandscapingPlan(jobId),
      getLatestLandscapingControls(jobId),
      getSession(),
    ])

    if (!job || !String(job.jobType || '').toLowerCase().includes('land')) {
      return NextResponse.json({ ok: false, error: 'Landscaping job not found.' }, { status: 404 })
    }
    if (!plan) {
      return NextResponse.json({ ok: false, error: 'Generate the landscaping pack first.' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

    const workerName = session?.workerName || 'Trev/Kelly'
    const workerId = session?.workerId ? Number(session.workerId) : null
    const recent = await prisma.chasMessage.findMany({
      where: { jobId, intent: 'landscaping_plan_review' },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { question: true, answer: true },
    })

    const materialText = plan.materials.map((material) => {
      const tracking = controls.materials[material.item]
      return [
        `- ${material.item}`,
        `  Needed: ${material.neededQuantity || material.quantity}`,
        `  Order now: ${material.orderQuantity || material.neededQuantity || material.quantity}`,
        `  Projected ex VAT: £${material.estimatedCostExVat.toFixed(2)}`,
        `  Actual ex VAT: ${material.actualCostExVat == null ? 'not entered' : `£${material.actualCostExVat.toFixed(2)}`}`,
        `  Order status: ${tracking?.status || 'not_ordered'}`,
        `  Supplier: ${tracking?.supplier || 'not entered'}`,
        `  Delivery: ${tracking?.deliveryDate || 'not entered'}`,
        material.note ? `  Note: ${material.note}` : '',
      ].filter(Boolean).join('\n')
    }).join('\n')

    const dayText = plan.dayPlan.map((day) =>
      `Day ${day.day} — ${day.heading}\nTarget: ${day.target}\nTasks: ${day.tasks.join('; ')}\nIf ahead: ${day.ifAhead.join('; ')}`
    ).join('\n\n')

    const historyText = recent.reverse().map((row) => `User: ${row.question}\nCHAS: ${row.answer}`).join('\n\n')
    const quote = job.quotes[0]
    const team = job.assignments.map((assignment) => `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim()).filter(Boolean)

    const openai = new OpenAI({ apiKey })
    const response = await openai.responses.create({
      model: process.env.CHAS_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: `You are CHAS reviewing an INTERNAL Furlads landscaping job plan with Trev or Kelly. Answer questions about the exact job context provided. Be practical, concise and commercially aware. Explain calculations clearly when challenged. Never invent materials or scope that are not in the accepted quote. Treat projected costs as a frozen baseline; only actual costs change after planning. Travis Perkins is the fallback projected material benchmark. If you think something is wrong, say exactly what looks wrong and suggest a correction, but do not claim you changed the plan. Do not silently approve changes. Keep replies easy to scan on a phone.`,
      input: `Job #${job.id}\nCustomer: ${job.customer.name}\nAccepted scope: ${quote?.scope || plan.scope}\nInternal notes: ${quote?.internalNotes || ''}\nSelling price ex VAT: £${plan.projectedCosts.sellingPriceExVat.toFixed(2)}\nProjected total cost ex VAT: £${plan.projectedCosts.totalCostExVat.toFixed(2)}\nProjected GP: £${plan.projectedCosts.projectedGrossProfitExVat.toFixed(2)} (${plan.projectedCosts.projectedGrossProfitPercent.toFixed(1)}%)\nProgramme: ${plan.totalDays} working day(s), ${plan.teamSize}-person team\nAssigned team: ${team.length ? team.join(', ') : 'not booked'}\nBooked start: ${job.visitDate ? job.visitDate.toISOString().slice(0, 10) : 'not booked'}\n\nMaterials:\n${materialText}\n\nDay plan:\n${dayText}\n\nPlant/tools: ${plan.plantTools.join('; ')}\nSite checks: ${plan.siteChecks.join('; ')}\nRisks: ${plan.risks.join('; ')}\n\nRecent plan-review conversation:\n${historyText || 'None'}\n\nQuestion from ${workerName}: ${question}`,
    })

    const answer = extractResponseText(response)
    if (!answer) throw new Error('CHAS returned no answer.')

    await prisma.chasMessage.create({
      data: {
        company: 'furlads',
        worker: workerName,
        workerId: Number.isInteger(workerId) ? workerId : null,
        jobId,
        question,
        answer,
        intent: 'landscaping_plan_review',
        confidence: 0.9,
        escalateTo: 'none',
        safetyFlag: false,
        sessionId: `landscaping-job-${jobId}`,
      },
    })

    return NextResponse.json({ ok: true, answer })
  } catch (error) {
    console.error('LANDSCAPING CHAS ERROR', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'CHAS could not answer that right now.' },
      { status: 500 }
    )
  }
}
