import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

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

function sessionKey(quoteId: number) {
  return `quote-review-${quoteId}`
}

async function loadQuote(id: number) {
  return prisma.quote.findUnique({
    where: { id },
    select: {
      id: true,
      jobId: true,
      customerName: true,
      customerPostcode: true,
      scope: true,
      internalNotes: true,
      quoteWorking: true,
      customerMessage: true,
      priceExVat: true,
      vatAmount: true,
      totalIncVat: true,
      depositPercent: true,
      depositAmount: true,
      estimatedDays: true,
      estimatedTeamSize: true,
      status: true,
    },
  })
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid quote id.' }, { status: 400 })

    const quote = await loadQuote(id)
    if (!quote) return NextResponse.json({ ok: false, error: 'Quote not found.' }, { status: 404 })

    const messages = await prisma.chasMessage.findMany({
      where: {
        company: 'furlads',
        sessionId: sessionKey(id),
      },
      orderBy: { createdAt: 'asc' },
      take: 30,
      select: {
        id: true,
        question: true,
        answer: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ ok: true, messages })
  } catch (error) {
    console.error('GET QUOTE CHAS ERROR', error)
    return NextResponse.json({ ok: false, error: 'Could not load quote review chat.' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid quote id.' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const question = cleanText(body.question)
    if (!question) return NextResponse.json({ ok: false, error: 'Ask CHAS a question first.' }, { status: 400 })

    const [quote, session] = await Promise.all([loadQuote(id), getSession()])
    if (!quote) return NextResponse.json({ ok: false, error: 'Quote not found.' }, { status: 404 })

    const history = await prisma.chasMessage.findMany({
      where: {
        company: 'furlads',
        sessionId: sessionKey(id),
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { question: true, answer: true },
    })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

    const openai = new OpenAI({ apiKey })
    const recentConversation = history
      .reverse()
      .map((row) => `User: ${row.question}\nCHAS: ${row.answer}`)
      .join('\n\n')

    const context = [
      `Quote #${quote.id}`,
      `Status: ${quote.status}`,
      `Customer: ${quote.customerName || 'Not entered'}`,
      `Postcode: ${quote.customerPostcode || 'Not entered'}`,
      `Scope: ${quote.scope}`,
      `Price ex VAT: £${quote.priceExVat.toFixed(2)}`,
      `VAT: £${quote.vatAmount.toFixed(2)}`,
      `Total inc VAT: £${quote.totalIncVat.toFixed(2)}`,
      `Deposit: ${quote.depositPercent}% / £${quote.depositAmount.toFixed(2)}`,
      `Estimated duration: ${quote.estimatedDays ?? 'Not set'} working days`,
      `Estimated team: ${quote.estimatedTeamSize ?? 'Not set'} people`,
      `Internal notes: ${quote.internalNotes || 'None'}`,
      `How the quote was priced / CHAS working: ${quote.quoteWorking || 'No stored pricing working'}`,
      `Current customer message: ${quote.customerMessage || 'Not drafted'}`,
      `Linked accepted job: ${quote.jobId || 'None yet'}`,
    ].join('\n')

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: `You are CHAS reviewing one Furlads landscaping quote with Trev or Kelly in the office.

Use the supplied quote as the source of truth. Answer questions about the price, scope, duration, team size, assumptions, omissions, risk and customer wording.

Important rules:
- Do not silently change anything. You are reviewing and explaining only.
- Never invent work, materials or extras that are not in the accepted/current scope.
- When explaining price, use the stored CHAS quote working where available. If the working does not support a number, say that clearly instead of making up a calculation.
- Distinguish what is definitely in the quote from what you are suggesting should be checked.
- If something looks wrong, state the issue and give a concise suggested correction, but say that no change has been applied.
- Treat accepted quotes as a protected commercial baseline. If an accepted quote needs changing, remind the user that it should be deliberately reopened for amendment and the linked job pack may then need regenerating.
- Keep replies practical, short and commercially useful. This is an internal Furlads conversation, not customer-facing wording unless explicitly requested.
- Kelly confirms final customer-facing quotes and Trev makes higher-risk commercial/site judgement calls.`,
      input: `CURRENT QUOTE\n${context}\n\n${recentConversation ? `RECENT REVIEW CHAT\n${recentConversation}\n\n` : ''}LATEST QUESTION\n${question}`,
    })

    const answer = cleanText(response.output_text) || 'CHAS could not produce a useful answer.'
    const worker = cleanText(session?.workerName) || 'Office'
    const workerId = session?.workerId && Number.isInteger(Number(session.workerId))
      ? Number(session.workerId)
      : null

    const saved = await prisma.chasMessage.create({
      data: {
        company: 'furlads',
        worker,
        workerId,
        jobId: quote.jobId || null,
        question,
        answer,
        sessionId: sessionKey(id),
        conversationId: sessionKey(id),
        intent: 'quote_review',
        confidence: 0.9,
        safetyFlag: false,
      },
      select: {
        id: true,
        question: true,
        answer: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ ok: true, message: saved })
  } catch (error) {
    console.error('QUOTE CHAS ERROR', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Could not ask CHAS about this quote.' },
      { status: 500 }
    )
  }
}
