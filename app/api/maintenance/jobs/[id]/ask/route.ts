import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  getMaintenanceControls,
  getMaintenancePropertyMemory,
  getPreviousMaintenanceNextVisitNote,
} from '@/lib/maintenance-controls'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

function validId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function fullName(firstName?: string | null, lastName?: string | null) {
  return `${firstName || ''} ${lastName || ''}`.trim()
}

function isJacob(firstName?: string | null, lastName?: string | null) {
  const name = fullName(firstName, lastName).toLowerCase()
  return name === 'jacob walters' || name === 'jacob'
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

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        assignments: { include: { worker: true }, orderBy: { createdAt: 'asc' } },
      },
    })

    const isMaintenanceType = String(job?.jobType || '').trim().toLowerCase().includes('maintenance')
    const assignedToJacob = Boolean(
      job?.assignments.some((assignment) =>
        isJacob(assignment.worker.firstName, assignment.worker.lastName)
      )
    )

    if (!job || (!isMaintenanceType && !assignedToJacob)) {
      return NextResponse.json({ ok: false, error: 'Three Counties job not found.' }, { status: 404 })
    }

    const [controls, previousMemory, previousNextVisit, session, recent] = await Promise.all([
      getMaintenanceControls(jobId),
      getMaintenancePropertyMemory(job.customerId, jobId),
      getPreviousMaintenanceNextVisitNote(job.customerId, jobId),
      getSession(),
      prisma.chasMessage.findMany({
        where: { jobId, intent: 'maintenance_property_help' },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { question: true, answer: true },
      }),
    ])

    const propertyMemory = controls.propertyMemory || previousMemory
    const nextVisitNote = controls.nextVisitNote || previousNextVisit
    const team = job.assignments
      .map((assignment) => fullName(assignment.worker.firstName, assignment.worker.lastName))
      .filter(Boolean)
    const opportunities = controls.extraWork.length
      ? controls.extraWork.map((item) => `- ${item.source === 'customer_requested' ? 'Customer requested' : 'Worker spotted'}: ${item.description} (${item.status})`).join('\n')
      : 'None recorded'
    const history = recent.reverse().map((row) => `Worker: ${row.question}\nCHAS: ${row.answer}`).join('\n\n')

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

    const workerName = String(session?.workerName || 'Worker').trim() || 'Worker'
    const workerId = session?.workerId ? Number(session.workerId) : null
    const openai = new OpenAI({ apiKey })
    const response = await openai.responses.create({
      model: process.env.CHAS_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: `You are CHAS, the practical in-app assistant for Three Counties Property Care and Furlads. You are helping a field worker with a Three Counties job. Three Counties jobs are not limited to recurring garden maintenance: they can include general property care, repairs, garden work, clearance, handyman tasks and other agreed work. Treat the job shown in the supplied context as a valid assigned job and never tell the worker it is not their job merely because it is not labelled maintenance. Keep replies short, useful and phone-friendly. Use the exact customer/property/job context supplied. Be safety-first. Be conservative with plant identification or anything that could damage a plant/property: say when you are unsure and ask for a clearer photo through the main Ask CHAS tool if needed. Do not give workers final customer prices. If the customer asks for extra work, tell the worker to log it as a CUSTOMER REQUESTED quote opportunity so Trev/Kelly can price it. If the worker merely notices possible work, tell them to log it as WORK SPOTTED. Consider seasonality and good horticultural/property-care practice where relevant, but do not invent facts about the property.`,
      input: `Three Counties job #${job.id}\nJob type: ${job.jobType || 'Property care'}\nCustomer: ${job.customer.name}\nAddress: ${job.address || job.customer.address || job.customer.postcode || 'Not saved'}\nVisit date: ${job.visitDate ? job.visitDate.toISOString().slice(0, 10) : 'Not booked'}\nAssigned team: ${team.length ? team.join(', ') : 'Not assigned'}\n\nToday's job brief:\n${job.notes || job.title}\n\nPersistent property memory:\n${propertyMemory || 'None saved'}\n\nNote from/for the next visit:\n${nextVisitNote || 'None saved'}\n\nCurrent quote opportunities / extras:\n${opportunities}\n\nRecent CHAS conversation for this property/job:\n${history || 'None'}\n\nQuestion from ${workerName}: ${question}`,
    })

    const answer = extractResponseText(response)
    if (!answer) throw new Error('CHAS returned no answer.')

    await prisma.chasMessage.create({
      data: {
        company: 'three-counties',
        worker: workerName,
        workerId: Number.isInteger(workerId) ? workerId : null,
        jobId,
        question,
        answer,
        intent: 'maintenance_property_help',
        confidence: 0.88,
        escalateTo: 'none',
        safetyFlag: false,
        sessionId: `three-counties-job-${jobId}`,
        customerName: job.customer.name,
        customerPhone: job.customer.phone,
        customerEmail: job.customer.email,
        customerAddress: job.address || job.customer.address,
        customerPostcode: job.customer.postcode,
      },
    })

    return NextResponse.json({ ok: true, answer })
  } catch (error) {
    console.error('THREE COUNTIES CHAS ERROR', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'CHAS could not answer that right now.' },
      { status: 500 }
    )
  }
}
