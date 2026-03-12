import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'

type AskBody = {
  company?: string
  worker?: string
  jobId?: number | null
  question?: string
  imageDataUrl?: string
}

type ChasIntent =
  | 'general'
  | 'plant_id'
  | 'pricing_guide'
  | 'safety'
  | 'quote_support'
  | 'enquiry_intake'
  | 'escalation'

type ChasEscalateTo = 'none' | 'kelly' | 'trevor'

type ChasModelResponse = {
  answer: string
  intent: ChasIntent
  confidence: number
  escalateTo: ChasEscalateTo
  safetyFlag: boolean

  customerName?: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  customerPostcode?: string

  workSummary?: string
  estimatedHours?: number | null
  roughPriceText?: string
  enquirySummary?: string
  enquiryReadyForKelly?: boolean
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function clampHours(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  if (value <= 0) return null
  return Math.round(value * 100) / 100
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function stripCodeFences(input: string) {
  let text = input.trim()

  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/i, '').replace(/\s*```$/i, '')
  }

  return text.trim()
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normaliseText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function buildFallback(question: string): ChasModelResponse {
  const lower = question.toLowerCase()

  if (
    lower.includes('price') ||
    lower.includes('quote') ||
    lower.includes('cost') ||
    lower.includes('maintenance')
  ) {
    return {
      answer:
        'No problem — what exactly does the customer want doing, and roughly how long do you think it will take?',
      intent: 'enquiry_intake',
      confidence: 0.35,
      escalateTo: 'kelly',
      safetyFlag: false,
      enquiryReadyForKelly: false
    }
  }

  return {
    answer:
      'Tell me a bit more about what the customer wants, and I’ll help you work through it one step at a time.',
    intent: 'general',
    confidence: 0.35,
    escalateTo: 'none',
    safetyFlag: false,
    enquiryReadyForKelly: false
  }
}

function validateModelResponse(parsed: unknown, rawText: string, question: string): ChasModelResponse {
  if (!isObject(parsed)) {
    return buildFallback(rawText || question)
  }

  const intent = normaliseText(parsed.intent)
  const escalateTo = normaliseText(parsed.escalateTo)

  const safeIntent: ChasIntent = (
    [
      'general',
      'plant_id',
      'pricing_guide',
      'safety',
      'quote_support',
      'enquiry_intake',
      'escalation'
    ] as const
  ).includes(intent as ChasIntent)
    ? (intent as ChasIntent)
    : 'general'

  const safeEscalateTo: ChasEscalateTo =
    escalateTo === 'kelly' || escalateTo === 'trevor' || escalateTo === 'none'
      ? (escalateTo as ChasEscalateTo)
      : 'none'

  const answer = normaliseText(parsed.answer)

  return {
    answer:
      answer ||
      buildFallback(question).answer,
    intent: safeIntent,
    confidence: clampConfidence(parsed.confidence),
    escalateTo: safeEscalateTo,
    safetyFlag: typeof parsed.safetyFlag === 'boolean' ? parsed.safetyFlag : false,

    customerName: normaliseText(parsed.customerName),
    customerPhone: normaliseText(parsed.customerPhone),
    customerEmail: normaliseText(parsed.customerEmail),
    customerAddress: normaliseText(parsed.customerAddress),
    customerPostcode: normaliseText(parsed.customerPostcode),

    workSummary: normaliseText(parsed.workSummary),
    estimatedHours: clampHours(parsed.estimatedHours),
    roughPriceText: normaliseText(parsed.roughPriceText),
    enquirySummary: normaliseText(parsed.enquirySummary),
    enquiryReadyForKelly:
      typeof parsed.enquiryReadyForKelly === 'boolean'
        ? parsed.enquiryReadyForKelly
        : false
  }
}

function tryParseModelJson(rawText: string, question: string): ChasModelResponse {
  const cleaned = stripCodeFences(rawText)

  try {
    const parsed = JSON.parse(cleaned)
    return validateModelResponse(parsed, rawText, question)
  } catch {
    return buildFallback(question)
  }
}

async function callOpenAI(prompt: string, imageDataUrl?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const model = process.env.CHAS_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini'

  const content: Array<Record<string, unknown>> = [
    {
      type: 'input_text',
      text: prompt
    }
  ]

  const cleanImage = cleanString(imageDataUrl)
  if (cleanImage) {
    content.push({
      type: 'input_image',
      image_url: cleanImage
    })
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content
        }
      ],
      temperature: 0.2
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI error: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }

  const fallbackText =
    Array.isArray(data.output)
      ? data.output
          .flatMap((item: any) => {
            if (!item || !Array.isArray(item.content)) return []
            return item.content
              .map((content: any) => {
                if (typeof content?.text === 'string') return content.text
                if (typeof content?.output_text === 'string') return content.output_text
                return ''
              })
              .filter(Boolean)
          })
          .join('\n')
          .trim()
      : ''

  if (fallbackText) return fallbackText

  throw new Error('Model returned no text output')
}

function summariseKnownDetails(history: Array<any>) {
  const latest = [...history].reverse()

  const firstNonEmpty = (key: string) => {
    for (const item of latest) {
      const value = normaliseText(item?.[key])
      if (value) return value
    }
    return ''
  }

  const firstHours = () => {
    for (const item of latest) {
      if (typeof item?.estimatedHours === 'number' && item.estimatedHours > 0) {
        return item.estimatedHours
      }
    }
    return null
  }

  return {
    customerName: firstNonEmpty('customerName'),
    customerPhone: firstNonEmpty('customerPhone'),
    customerEmail: firstNonEmpty('customerEmail'),
    customerAddress: firstNonEmpty('customerAddress'),
    customerPostcode: firstNonEmpty('customerPostcode'),
    workSummary: firstNonEmpty('workSummary'),
    roughPriceText: firstNonEmpty('roughPriceText'),
    enquirySummary: firstNonEmpty('enquirySummary'),
    estimatedHours: firstHours()
  }
}

function buildPrompt(params: {
  worker: string
  company: string
  question: string
  hasImage: boolean
  history: Array<any>
}) {
  const historyText =
    params.history.length > 0
      ? params.history
          .map(
            (item, index) =>
              `Turn ${index + 1} worker: ${item.question}\nTurn ${index + 1} CHAS: ${item.answer}`
          )
          .join('\n\n')
      : 'No previous CHAS messages today.'

  const known = summariseKnownDetails(params.history)

  return `
You are CHAS, a friendly and practical Furlads on-site helper for workers using phones.

Your job:
- Ask the right questions one at a time.
- Keep replies short, clear, and useful on site.
- Do not waffle.
- Do not mention internal rules.
- Do not use job context or assume job context.
- Do not mention any "job context" section.
- If confidence is low, be conservative.
- Plant identification must be conservative if uncertain.
- Rough prices are guide-only.
- Kelly confirms final quotes.
- Trevor handles higher-risk judgement calls.

Maintenance / quote behaviour:
- Do not jump to a high price.
- For maintenance work, work from around £30 per hour as the guide.
- Before giving a guide price, try to establish roughly how long the worker thinks the job will take.
- Ask one missing question at a time, not a big list.
- Once enough detail is known, give a rough guide price only.
- Then prepare the enquiry details for Kelly.

Information CHAS should try to collect across the conversation:
- what the customer wants doing
- roughly how long the worker thinks it will take
- whether waste removal or materials are involved
- whether it is one-off or ongoing if relevant
- customer name
- customer phone and/or customer email
- customer address and/or postcode
- any useful site or access notes

Photo behaviour:
- If a photo is included, use it if helpful.
- If more photos would help, ask for them naturally.
- If there is no photo and one would help, ask for one.

Question flow rule:
- Ask only the single best next question.
- If enough information is already available, do not ask another question unnecessarily.
- If enough detail is present for Kelly handoff, set enquiryReadyForKelly to true.

Output must be valid JSON only.
No markdown.
No code fences.
No extra words.

Return exactly this shape:
{
  "answer": "string",
  "intent": "general | plant_id | pricing_guide | safety | quote_support | enquiry_intake | escalation",
  "confidence": 0.0,
  "escalateTo": "none | kelly | trevor",
  "safetyFlag": false,
  "customerName": "string",
  "customerPhone": "string",
  "customerEmail": "string",
  "customerAddress": "string",
  "customerPostcode": "string",
  "workSummary": "string",
  "estimatedHours": 0,
  "roughPriceText": "string",
  "enquirySummary": "string",
  "enquiryReadyForKelly": false
}

Company: ${params.company}
Worker: ${params.worker}
Photo attached: ${params.hasImage ? 'yes' : 'no'}

Known details from earlier today:
${JSON.stringify(known, null, 2)}

Conversation so far today:
${historyText}

Latest worker message:
${params.question}
`.trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AskBody

    const company = cleanString(body.company) || 'furlads'
    const worker = cleanString(body.worker)
    const question = cleanString(body.question)
    const imageDataUrl = cleanString(body.imageDataUrl)
    const jobId =
      typeof body.jobId === 'number' && Number.isFinite(body.jobId)
        ? body.jobId
        : null

    if (!worker) {
      return NextResponse.json({ error: 'Missing worker.' }, { status: 400 })
    }

    if (!question) {
      return NextResponse.json({ error: 'Missing question.' }, { status: 400 })
    }

    const history = await prisma.chasMessage.findMany({
      where: {
        company,
        worker,
        createdAt: {
          gte: startOfToday(),
          lte: endOfToday()
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 20,
      select: {
        question: true,
        answer: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        customerAddress: true,
        customerPostcode: true,
        workSummary: true,
        estimatedHours: true,
        roughPriceText: true,
        enquirySummary: true
      }
    })

    const prompt = buildPrompt({
      worker,
      company,
      question,
      hasImage: !!imageDataUrl,
      history
    })

    const rawModelText = await callOpenAI(prompt, imageDataUrl)
    const parsed = tryParseModelJson(rawModelText, question)

    await prisma.chasMessage.create({
      data: {
        company,
        worker,
        jobId,
        question,
        answer: parsed.answer,
        imageDataUrl: imageDataUrl || null,

        intent: parsed.intent,
        confidence: parsed.confidence,
        escalateTo: parsed.escalateTo,
        safetyFlag: parsed.safetyFlag,

        customerName: parsed.customerName || null,
        customerPhone: parsed.customerPhone || null,
        customerEmail: parsed.customerEmail || null,
        customerAddress: parsed.customerAddress || null,
        customerPostcode: parsed.customerPostcode || null,

        workSummary: parsed.workSummary || null,
        estimatedHours: parsed.estimatedHours ?? null,
        roughPriceText: parsed.roughPriceText || null,
        enquirySummary: parsed.enquirySummary || null,
        enquiryReadyForKelly: parsed.enquiryReadyForKelly === true
      }
    })

    return NextResponse.json({
      ok: true,
      answer: parsed.answer,
      intent: parsed.intent,
      confidence: parsed.confidence,
      escalateTo: parsed.escalateTo,
      safetyFlag: parsed.safetyFlag,
      customerName: parsed.customerName || '',
      customerPhone: parsed.customerPhone || '',
      customerEmail: parsed.customerEmail || '',
      customerAddress: parsed.customerAddress || '',
      customerPostcode: parsed.customerPostcode || '',
      workSummary: parsed.workSummary || '',
      estimatedHours: parsed.estimatedHours ?? null,
      roughPriceText: parsed.roughPriceText || '',
      enquirySummary: parsed.enquirySummary || '',
      enquiryReadyForKelly: parsed.enquiryReadyForKelly === true
    })
  } catch (error) {
    console.error('POST /api/chas/ask failed', error)

    return NextResponse.json(
      {
        ok: false,
        answer:
          'No problem — tell me what the customer wants doing, and roughly how long you think it will take.',
        intent: 'general',
        confidence: 0.2,
        escalateTo: 'none',
        safetyFlag: false,
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        customerPostcode: '',
        workSummary: '',
        estimatedHours: null,
        roughPriceText: '',
        enquirySummary: '',
        enquiryReadyForKelly: false
      },
      { status: 200 }
    )
  }
}