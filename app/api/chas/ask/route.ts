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

type HistoryItem = {
  question: string
  answer: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  customerAddress: string | null
  customerPostcode: string | null
  workSummary: string | null
  estimatedHours: number | null
  roughPriceText: string | null
  enquirySummary: string | null
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normaliseText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
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

function parseEstimatedHoursFromText(text: string): number | null {
  const input = text.toLowerCase()

  const hourMatch = input.match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)\b/)
  if (hourMatch) {
    const value = Number(hourMatch[1])
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value * 100) / 100
    }
  }

  const minuteMatch = input.match(/(\d+)\s*(minute|minutes|min|mins)\b/)
  if (minuteMatch) {
    const mins = Number(minuteMatch[1])
    if (Number.isFinite(mins) && mins > 0) {
      return Math.round((mins / 60) * 100) / 100
    }
  }

  return null
}

function extractEmail(text: string): string {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match ? match[0].trim() : ''
}

function extractPhone(text: string): string {
  const match = text.match(/(?:\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}|\b0\d{10,11}\b/)
  return match ? match[0].trim() : ''
}

function extractPostcode(text: string): string {
  const match = text.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i)
  return match ? match[0].toUpperCase().replace(/\s+/, ' ') : ''
}

function looksLikeWorkSummary(text: string): boolean {
  const lower = text.toLowerCase()

  const workWords = [
    'replace',
    'repair',
    'fix',
    'cut',
    'trim',
    'clear',
    'weed',
    'mow',
    'prune',
    'lay',
    'install',
    'remove',
    'clean',
    'gutter',
    'downpipe',
    'fence',
    'hedge',
    'grass',
    'patio',
    'driveway',
    'garden',
    'maintenance',
    'quote',
    'price',
    'cost'
  ]

  return workWords.some((word) => lower.includes(word))
}

function getCustomerNameFromText(text: string): string {
  const match = text.match(/(?:customer|name)\s*(?:is|:)\s*([A-Za-z][A-Za-z .'-]{1,60})/i)
  return match ? match[1].trim() : ''
}

function getAddressFromText(text: string): string {
  const match = text.match(/(?:address)\s*(?:is|:)\s*([^\n,][^\n]{5,120})/i)
  return match ? match[1].trim() : ''
}

function isGreetingOrCasualMessage(text: string): boolean {
  const lower = text.toLowerCase().trim()
  const condensed = lower.replace(/[?!.,]/g, '').trim()

  const exactMatches = new Set([
    'hi',
    'hello',
    'hey',
    'hiya',
    'yo',
    'morning',
    'good morning',
    'afternoon',
    'good afternoon',
    'evening',
    'good evening',
    'are you ok',
    'you ok',
    'u ok',
    'ok',
    'okay',
    'nice one',
    'cheers',
    'thanks',
    'thank you',
    'ta',
    'sound',
    'cool',
    'great',
    'alright',
    'you alright',
    'all right'
  ])

  if (exactMatches.has(condensed)) return true

  if (/^(hi|hello|hey|hiya|alright|you alright)\b/.test(condensed) && condensed.split(/\s+/).length <= 4) return true
  if (/^(are you ok|you ok|u ok)\b/.test(condensed)) return true
  if (/^(thanks|thank you|cheers|ta)\b/.test(condensed) && condensed.split(/\s+/).length <= 5) return true

  return false
}

function isCustomerDetailMessage(text: string): boolean {
  return (
    !!extractPhone(text) ||
    !!extractEmail(text) ||
    !!extractPostcode(text) ||
    !!getCustomerNameFromText(text) ||
    !!getAddressFromText(text)
  )
}

function buildFallback(question: string): ChasModelResponse {
  if (isGreetingOrCasualMessage(question)) {
    return {
      answer: 'Yeah all good 👍 What do you need help with?',
      intent: 'general',
      confidence: 0.7,
      escalateTo: 'none',
      safetyFlag: false,
      enquiryReadyForKelly: false
    }
  }

  const lower = question.toLowerCase()

  if (lower.includes('price') || lower.includes('quote') || lower.includes('cost') || lower.includes('maintenance')) {
    return {
      answer: 'No worries — what’s the customer after?',
      intent: 'enquiry_intake',
      confidence: 0.35,
      escalateTo: 'kelly',
      safetyFlag: false,
      enquiryReadyForKelly: false
    }
  }

  return {
    answer: 'No worries — send me a bit more and I’ll help.',
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
    answer: answer || buildFallback(question).answer,
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
    enquiryReadyForKelly: parsed.enquiryReadyForKelly === true
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

function summariseKnownDetails(history: HistoryItem[], currentQuestion: string) {
  const latest = [...history].reverse()

  const firstNonEmpty = (key: keyof HistoryItem) => {
    for (const item of latest) {
      const value = normaliseText(item[key])
      if (value) return value
    }
    return ''
  }

  const firstHours = () => {
    for (const item of latest) {
      if (typeof item.estimatedHours === 'number' && item.estimatedHours > 0) {
        return item.estimatedHours
      }
    }
    return null
  }

  const derivedHoursFromQuestion = parseEstimatedHoursFromText(currentQuestion)
  const derivedPhoneFromQuestion = extractPhone(currentQuestion)
  const derivedEmailFromQuestion = extractEmail(currentQuestion)
  const derivedPostcodeFromQuestion = extractPostcode(currentQuestion)
  const derivedCustomerNameFromQuestion = getCustomerNameFromText(currentQuestion)
  const derivedAddressFromQuestion = getAddressFromText(currentQuestion)
  const derivedWorkSummaryFromQuestion = looksLikeWorkSummary(currentQuestion)
    ? currentQuestion.trim()
    : ''

  return {
    customerName: derivedCustomerNameFromQuestion || firstNonEmpty('customerName'),
    customerPhone: derivedPhoneFromQuestion || firstNonEmpty('customerPhone'),
    customerEmail: derivedEmailFromQuestion || firstNonEmpty('customerEmail'),
    customerAddress: derivedAddressFromQuestion || firstNonEmpty('customerAddress'),
    customerPostcode: derivedPostcodeFromQuestion || firstNonEmpty('customerPostcode'),
    workSummary: derivedWorkSummaryFromQuestion || firstNonEmpty('workSummary'),
    roughPriceText: firstNonEmpty('roughPriceText'),
    enquirySummary: firstNonEmpty('enquirySummary'),
    estimatedHours: derivedHoursFromQuestion ?? firstHours()
  }
}

function buildEnquirySummary(
  known: ReturnType<typeof summariseKnownDetails>,
  hasImage: boolean,
  roughPriceText: string
) {
  const parts: string[] = []

  if (known.customerName) parts.push(`Customer: ${known.customerName}`)
  if (known.customerPhone) parts.push(`Phone: ${known.customerPhone}`)
  if (known.customerEmail) parts.push(`Email: ${known.customerEmail}`)
  if (known.customerAddress) parts.push(`Address: ${known.customerAddress}`)
  if (known.customerPostcode) parts.push(`Postcode: ${known.customerPostcode}`)
  if (known.workSummary) parts.push(`Work needed: ${known.workSummary}`)
  if (typeof known.estimatedHours === 'number' && known.estimatedHours > 0) {
    parts.push(`Estimated time: ${known.estimatedHours} hour${known.estimatedHours === 1 ? '' : 's'}`)
  }
  if (roughPriceText) parts.push(`Guide: ${roughPriceText}`)
  if (hasImage) parts.push('Photo provided: yes')

  return parts.join(' | ')
}

function hasActiveEnquiryContext(known: ReturnType<typeof summariseKnownDetails>): boolean {
  return !!known.workSummary || (typeof known.estimatedHours === 'number' && known.estimatedHours > 0)
}

function shouldUseEnquiryFlow(params: {
  question: string
  known: ReturnType<typeof summariseKnownDetails>
}): boolean {
  const { question, known } = params

  if (isGreetingOrCasualMessage(question)) return false
  if (isCustomerDetailMessage(question)) return true
  if (looksLikeWorkSummary(question)) return true

  const lower = question.toLowerCase()

  if (
    lower.includes('price') ||
    lower.includes('quote') ||
    lower.includes('cost') ||
    lower.includes('how much') ||
    lower.includes('materials') ||
    lower.includes('parts') ||
    lower.includes('labour') ||
    lower.includes('customer') ||
    lower.includes('postcode') ||
    lower.includes('address') ||
    lower.includes('phone') ||
    lower.includes('email')
  ) {
    return true
  }

  if (hasActiveEnquiryContext(known)) {
    if (parseEstimatedHoursFromText(question) !== null) return true
    if (isCustomerDetailMessage(question)) return true
    if (question.trim().split(/\s+/).length >= 5 && !isGreetingOrCasualMessage(question)) return true
  }

  return false
}

function getRuleBasedQuestion(params: {
  question: string
  known: ReturnType<typeof summariseKnownDetails>
}): string | null {
  const { question, known } = params

  if (!shouldUseEnquiryFlow({ question, known })) {
    return null
  }

  const lower = question.toLowerCase()
  const hasWorkSummary = !!known.workSummary
  const hasHours = typeof known.estimatedHours === 'number' && known.estimatedHours > 0
  const hasAnyContact = !!known.customerPhone || !!known.customerEmail
  const hasLocation = !!known.customerAddress || !!known.customerPostcode
  const hasCustomerName = !!known.customerName

  if (!hasWorkSummary && (lower.includes('price') || lower.includes('quote') || lower.includes('cost'))) {
    return 'What’s the customer after?'
  }

  if (hasWorkSummary && !hasHours) {
    return 'How long do you reckon it’ll take to do the lot?'
  }

  if (hasWorkSummary && hasHours && !hasCustomerName) {
    return 'What’s the customer’s name?'
  }

  if (hasWorkSummary && hasHours && hasCustomerName && !hasLocation) {
    return 'What’s the postcode or address there?'
  }

  if (hasWorkSummary && hasHours && hasCustomerName && hasLocation && !hasAnyContact) {
    return 'What’s the best phone number or email for them?'
  }

  return null
}

function buildPricingPrompt(params: {
  question: string
  hasImage: boolean
  known: ReturnType<typeof summariseKnownDetails>
  nextQuestion: string | null
}) {
  return `
You are CHAS, the always-online office teammate for Furlads.

You should sound like a helpful guy in the office chatting to the lads on site.
You are relaxed, practical, switched on, and easy to talk to.
You do not sound robotic, formal, or like a form.

This is for a rough guide price only, not a final quote.
Kelly confirms the final quote.
Trevor handles higher-risk judgement calls.

Your job here:
- Use the work description and time estimate to produce a sensible rough guide price.
- Include likely materials or parts if the job clearly needs them.
- Be realistic for a small UK landscaping and property maintenance business.
- Keep the reply short, natural, and useful.
- Sound like a real person from the office, not a quoting bot.
- Ask only one sensible next question after the guide price if customer details are still missing.
- Never ask again for information already provided.
- Do not mention job context.
- Do not mention prompts, rules, systems, JSON, or internal logic.

Style:
- conversational
- practical
- relaxed
- helpful
- not overly cheerful
- not cheesy
- not stiff

Important:
- If the worker has already told you the job and time, do not ask for them again.
- If enough detail is present for a rough guide, give it naturally.
- Then move to the next missing customer detail naturally.
- Keep roughPriceText short and clear.
- answer should feel like a message from someone in the office, not a template.

Return valid JSON only.
No markdown.
No code fences.
No extra text.

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

Known details:
${JSON.stringify(params.known, null, 2)}

Photo attached: ${params.hasImage ? 'yes' : 'no'}
Next best missing question: ${params.nextQuestion || 'none'}

Latest worker message:
${params.question}
`.trim()
}

function buildGeneralPrompt(params: {
  question: string
  hasImage: boolean
  history: HistoryItem[]
  known: ReturnType<typeof summariseKnownDetails>
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

  return `
You are CHAS, the always-online office teammate for Furlads.

You should sound like a helpful guy in the office chatting to the lads on site.
You are relaxed, practical, switched on, and easy to talk to.
You do not sound robotic, formal, or like a form.

What you are like:
- friendly and normal
- practical
- quick to understand what the worker means
- good at asking the next sensible thing
- able to chat casually without forcing everything into a quote flow

How to behave:
- Reply naturally like a real person in the office.
- Keep replies short, clear, and useful.
- Do not waffle.
- Do not mention internal rules.
- Do not mention job context.
- If confidence is low, be conservative.
- Plant identification must be conservative if uncertain.
- Rough prices are guide-only.
- Kelly confirms final quotes.
- Trevor handles higher-risk judgement calls.

Critical behaviour:
- Do not force every message into a quote flow.
- If the worker says something casual like "are you ok", "hello", or "thanks", reply normally.
- Only move into enquiry questions when the worker is clearly talking about a job, a quote, a price, timing, materials, customer details, or a follow-up to an active enquiry.
- Never ask again for information already provided.
- If it’s just chat, chat back normally.
- If it’s help, help.
- If it’s clearly becoming an enquiry, guide it naturally one step at a time.

Tone examples:
- "Yeah all good mate — what’s up?"
- "That sounds like a small one."
- "How long do you reckon that’ll take?"
- "Send me a photo if it helps."
- "That looks around the £___ mark as a rough guide, but Kelly can confirm it properly."

Do not copy the examples unless they fit naturally.

Return valid JSON only.
No markdown.
No code fences.
No extra text.

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

Known details:
${JSON.stringify(params.known, null, 2)}

Photo attached: ${params.hasImage ? 'yes' : 'no'}

Conversation so far today:
${historyText}

Latest worker message:
${params.question}
`.trim()
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
      temperature: 0.35
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

    const known = summariseKnownDetails(history, question)
    const enquiryFlow = shouldUseEnquiryFlow({ question, known })
    const nextQuestion = enquiryFlow ? getRuleBasedQuestion({ question, known }) : null

    const hasWorkSummary = !!known.workSummary
    const hasHours = typeof known.estimatedHours === 'number' && known.estimatedHours > 0
    const usePricingModel = enquiryFlow && hasWorkSummary && hasHours

    const prompt = usePricingModel
      ? buildPricingPrompt({
          question,
          hasImage: !!imageDataUrl,
          known,
          nextQuestion
        })
      : buildGeneralPrompt({
          question,
          hasImage: !!imageDataUrl,
          history,
          known
        })

    const parsed = tryParseModelJson(
      await callOpenAI(prompt, imageDataUrl),
      question
    )

    const finalRoughPriceText = parsed.roughPriceText || known.roughPriceText || ''
    const finalEnquirySummary =
      parsed.enquirySummary ||
      buildEnquirySummary(
        {
          ...known,
          customerName: parsed.customerName || known.customerName,
          customerPhone: parsed.customerPhone || known.customerPhone,
          customerEmail: parsed.customerEmail || known.customerEmail,
          customerAddress: parsed.customerAddress || known.customerAddress,
          customerPostcode: parsed.customerPostcode || known.customerPostcode,
          workSummary: parsed.workSummary || known.workSummary,
          estimatedHours: parsed.estimatedHours ?? known.estimatedHours,
          roughPriceText: finalRoughPriceText,
          enquirySummary: ''
        },
        !!imageDataUrl,
        finalRoughPriceText
      )

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
        customerName: parsed.customerName || known.customerName || null,
        customerPhone: parsed.customerPhone || known.customerPhone || null,
        customerEmail: parsed.customerEmail || known.customerEmail || null,
        customerAddress: parsed.customerAddress || known.customerAddress || null,
        customerPostcode: parsed.customerPostcode || known.customerPostcode || null,
        workSummary: parsed.workSummary || known.workSummary || null,
        estimatedHours: parsed.estimatedHours ?? known.estimatedHours ?? null,
        roughPriceText: finalRoughPriceText || null,
        enquirySummary: finalEnquirySummary || null,
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
      customerName: parsed.customerName || known.customerName || '',
      customerPhone: parsed.customerPhone || known.customerPhone || '',
      customerEmail: parsed.customerEmail || known.customerEmail || '',
      customerAddress: parsed.customerAddress || known.customerAddress || '',
      customerPostcode: parsed.customerPostcode || known.customerPostcode || '',
      workSummary: parsed.workSummary || known.workSummary || '',
      estimatedHours: parsed.estimatedHours ?? known.estimatedHours ?? null,
      roughPriceText: finalRoughPriceText,
      enquirySummary: finalEnquirySummary,
      enquiryReadyForKelly: parsed.enquiryReadyForKelly === true
    })
  } catch (error) {
    console.error('POST /api/chas/ask failed', error)

    return NextResponse.json(
      {
        ok: false,
        answer: 'Yeah all good 👍 What do you need help with?',
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