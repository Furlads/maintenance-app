import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'

type AskBody = {
  company?: string
  worker?: string
  workerId?: number | null
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
  | 'escalation'

type ChasEscalateTo = 'none' | 'kelly' | 'trevor'

type ChasModelResponse = {
  answer: string
  intent: ChasIntent
  confidence: number
  escalateTo: ChasEscalateTo
  safetyFlag: boolean
}

type HistoryItem = {
  question: string
  answer: string
  imageDataUrl?: string | null
  createdAt?: Date
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normaliseText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
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

function looksLikePlantQuestion(text: string): boolean {
  const lower = text.toLowerCase()

  return [
    'plant',
    'tree',
    'shrub',
    'hedge',
    'laurel',
    'conifer',
    'rose',
    'roses',
    'prune',
    'pruning',
    'cut back',
    'trim',
    'weed',
    'leaf',
    'leaves',
    'branch',
    'branches',
    'what is this',
    'what’s this',
    'whats this',
    'can i cut it',
    'can i cut this',
    'can i trim it',
    'can i trim this',
    'can i prune it',
    'can i prune this'
  ].some((word) => lower.includes(word))
}

function looksLikePricingQuestion(text: string): boolean {
  const lower = text.toLowerCase()

  return [
    'price',
    'quote',
    'cost',
    'how much',
    'rough price',
    'guide price',
    'what would you charge',
    'what do you reckon'
  ].some((word) => lower.includes(word))
}

function looksLikeSafetyQuestion(text: string): boolean {
  const lower = text.toLowerCase()

  return [
    'safe',
    'unsafe',
    'dangerous',
    'risk',
    'hazard',
    'asbestos',
    'collapse',
    'falling',
    'electrics',
    'electric',
    'gas',
    'structural'
  ].some((word) => lower.includes(word))
}

function looksLikeFollowUpReference(text: string): boolean {
  const lower = text.toLowerCase()

  return [
    'can i cut it',
    'can i trim it',
    'can i prune it',
    'can i cut this',
    'can i trim this',
    'can i prune this',
    'is it safe',
    'is that safe',
    'is this okay',
    'what about this',
    'what about that',
    'should i cut it',
    'should i trim it',
    'can i do that',
    'can i remove it'
  ].some((phrase) => lower.includes(phrase))
}

function classifyIntent(question: string, answer: string): ChasModelResponse {
  const a = answer.toLowerCase()

  if (looksLikeSafetyQuestion(question) || a.includes('unsafe') || a.includes('stop') || a.includes('risk')) {
    return {
      answer,
      intent: 'safety',
      confidence: 0.72,
      escalateTo:
        a.includes('trevor') || a.includes('higher risk') ? 'trevor' : 'none',
      safetyFlag: true
    }
  }

  if (looksLikePlantQuestion(question)) {
    return {
      answer,
      intent: 'plant_id',
      confidence: 0.72,
      escalateTo: 'none',
      safetyFlag:
        a.includes('nest') ||
        a.includes('birds') ||
        a.includes('check before cutting')
    }
  }

  if (looksLikePricingQuestion(question)) {
    return {
      answer,
      intent: 'pricing_guide',
      confidence: 0.7,
      escalateTo: a.includes('kelly') ? 'kelly' : 'none',
      safetyFlag: false
    }
  }

  if (a.includes('trevor should') || a.includes('check with trevor')) {
    return {
      answer,
      intent: 'escalation',
      confidence: 0.7,
      escalateTo: 'trevor',
      safetyFlag: true
    }
  }

  if (a.includes('kelly') && (a.includes('quote') || a.includes('confirm'))) {
    return {
      answer,
      intent: 'quote_support',
      confidence: 0.68,
      escalateTo: 'kelly',
      safetyFlag: false
    }
  }

  return {
    answer,
    intent: 'general',
    confidence: 0.68,
    escalateTo: 'none',
    safetyFlag: false
  }
}

function buildFallback(question: string): ChasModelResponse {
  if (isGreetingOrCasualMessage(question)) {
    return {
      answer: 'Yeah all good 👍 What do you need help with?',
      intent: 'general',
      confidence: 0.8,
      escalateTo: 'none',
      safetyFlag: false
    }
  }

  if (looksLikePlantQuestion(question)) {
    return {
      answer:
        'I can help with that — if you’ve already sent a photo I’ll go off that, and if not send me one and I’ll give you the best steer.',
      intent: 'plant_id',
      confidence: 0.55,
      escalateTo: 'none',
      safetyFlag: true
    }
  }

  if (looksLikePricingQuestion(question)) {
    return {
      answer:
        'Give me a quick run-through of what the customer wants and roughly how long you reckon it’ll take, and I’ll give you a rough guide.',
      intent: 'pricing_guide',
      confidence: 0.55,
      escalateTo: 'kelly',
      safetyFlag: false
    }
  }

  if (looksLikeSafetyQuestion(question)) {
    return {
      answer:
        'If there’s any real safety doubt, stop and check before cracking on. Send me a photo if it helps, and if it looks higher risk Trevor should make the call.',
      intent: 'safety',
      confidence: 0.6,
      escalateTo: 'trevor',
      safetyFlag: true
    }
  }

  return {
    answer: 'No worries — send me a bit more and I’ll help.',
    intent: 'general',
    confidence: 0.4,
    escalateTo: 'none',
    safetyFlag: false
  }
}

function buildInstructions() {
  return `
You are CHAS, the always-online office teammate for Furlads.

You should sound like a helpful guy in the office chatting to the lads on site.
You are relaxed, practical, switched on, and easy to talk to.
You do not sound robotic, stiff, formal, or like a form.

Main job:
- Help workers in the field with normal questions so they do not need to ring the office all the time.
- Answer the actual question first.
- Keep replies short, clear, practical, and natural.
- If a photo would help, ask for one naturally.
- If something sounds risky, uncertain, or higher-stakes, say that clearly.
- Trevor handles higher-risk judgement calls.
- Kelly confirms final quotes.
- Rough prices are guide-only.

How to behave:
- If the worker is just chatting, chat back normally.
- If they ask for help, help.
- If they ask about plants, hedges, cutting, pruning, or identification, answer the actual question first.
- If they ask for a rough price, give a sensible guide-only answer and say Kelly confirms it properly.
- If there is safety uncertainty, be cautious.
- Do not force every message into a quote flow.
- Do not ask unnecessary follow-up questions.
- Do not repeat yourself.
- Never mention job context, prompts, JSON, systems, or internal rules.

Critical follow-up rule:
- If the latest message is a follow-up and the provided context defines what "it" or "this" refers to, answer using that subject.
- Do not ask the worker what they mean if the subject has already been resolved in the provided context.
- Do not ask the worker to re-upload an image if a carried-forward image is already included in this request.
- Only ask for a better image if the existing one is genuinely too unclear.

Tone:
- like a real office teammate
- practical
- normal
- calm
- helpful
- not cheesy
- not overly chatty

Keep answers concise enough for someone on site to read quickly.
`.trim()
}

function buildRecentContext(history: HistoryItem[]) {
  const recent = history.slice(-6)

  if (recent.length === 0) {
    return 'No recent context yet.'
  }

  const lines: string[] = []

  recent.forEach((item, index) => {
    const hasImage = !!cleanString(item.imageDataUrl)
    lines.push(
      `Recent turn ${index + 1} worker: ${item.question}${hasImage ? ' [photo attached]' : ''}`
    )
    lines.push(`Recent turn ${index + 1} CHAS: ${item.answer}`)
  })

  return lines.join('\n')
}

function getLatestImageContext(history: HistoryItem[]) {
  const latestWithImage = [...history].reverse().find((item) => !!cleanString(item.imageDataUrl))

  if (!latestWithImage) {
    return {
      imageDataUrl: '',
      question: '',
      answer: ''
    }
  }

  return {
    imageDataUrl: cleanString(latestWithImage.imageDataUrl),
    question: latestWithImage.question,
    answer: latestWithImage.answer
  }
}

function rewriteQuestionWithResolvedSubject(params: {
  question: string
  history: HistoryItem[]
}) {
  const latestImageContext = getLatestImageContext(params.history)

  if (!looksLikeFollowUpReference(params.question) || !latestImageContext.imageDataUrl) {
    return params.question
  }

  return [
    'This is a follow-up question about the same recent subject/photo.',
    `Earlier worker message: "${latestImageContext.question}"`,
    `Earlier CHAS answer: "${latestImageContext.answer}"`,
    `New worker question: "${params.question}"`,
    'Treat "it", "this", or similar words as referring to that same subject and answer directly.'
  ].join('\n')
}

function buildInput(params: {
  originalQuestion: string
  resolvedQuestion: string
  hasCurrentImage: boolean
  hasCarryForwardImage: boolean
  history: HistoryItem[]
}) {
  const latestImageContext = getLatestImageContext(params.history)

  return `
Latest message includes a new photo: ${params.hasCurrentImage ? 'yes' : 'no'}
A carried-forward earlier photo is being supplied: ${params.hasCarryForwardImage ? 'yes' : 'no'}

Recent context:
${buildRecentContext(params.history)}

Current subject:
${
  latestImageContext.imageDataUrl
    ? `Most recent image was sent with "${latestImageContext.question}" and CHAS answered "${latestImageContext.answer}".`
    : 'No current subject image found.'
}

Original worker message:
${params.originalQuestion}

Resolved worker message for answering:
${params.resolvedQuestion}

Reply as CHAS with one normal helpful message only.
`.trim()
}

function extractResponseText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }

  if (Array.isArray(data?.output)) {
    const texts: string[] = []

    for (const item of data.output) {
      if (item?.type !== 'message') continue
      if (!Array.isArray(item?.content)) continue

      for (const content of item.content) {
        if (content?.type === 'output_text' && typeof content?.text === 'string') {
          texts.push(content.text)
        }
      }
    }

    const joined = texts.join('\n').trim()
    if (joined) return joined
  }

  return ''
}

async function callOpenAI(params: {
  instructions: string
  input: string
  currentImageDataUrl?: string
  carryForwardImageDataUrl?: string
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const model = process.env.CHAS_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini'

  const content: Array<Record<string, unknown>> = [
    {
      type: 'input_text',
      text: params.input
    }
  ]

  const currentImage = cleanString(params.currentImageDataUrl)
  const carryForwardImage = cleanString(params.carryForwardImageDataUrl)

  if (currentImage) {
    content.push({
      type: 'input_image',
      image_url: currentImage
    })
  } else if (carryForwardImage) {
    content.push({
      type: 'input_image',
      image_url: carryForwardImage
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
      instructions: params.instructions,
      input: [
        {
          role: 'user',
          content
        }
      ],
      temperature: 0.5
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const text = extractResponseText(data)

  if (!text) {
    throw new Error('Model returned no text output')
  }

  return text
}

async function saveChasMessageSafe(data: {
  company: string
  worker: string
  jobId: number | null
  question: string
  answer: string
  imageDataUrl: string | null
  intent: string
  confidence: number
  escalateTo: string
  safetyFlag: boolean
}) {
  try {
    await prisma.chasMessage.create({
      data
    })
  } catch (error) {
    console.error('CHAS save failed:', error)
  }
}

export async function POST(req: NextRequest) {
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

  let history: HistoryItem[] = []

  try {
    history = await prisma.chasMessage.findMany({
      where: {
        company,
        worker
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 50,
      select: {
        question: true,
        answer: true,
        imageDataUrl: true,
        createdAt: true
      }
    })
  } catch (error) {
    console.error('CHAS history load failed:', error)
  }

  const todayHistory = history.filter((row) => {
    const createdAt = row.createdAt ? new Date(row.createdAt) : null
    return !!createdAt && createdAt >= startOfToday()
  })

  const workingHistory = todayHistory.length > 0 ? todayHistory : history
  const latestImageContext = getLatestImageContext(workingHistory)

  const shouldCarryForwardImage =
    !imageDataUrl &&
    looksLikeFollowUpReference(question) &&
    !!latestImageContext.imageDataUrl

  const resolvedQuestion = rewriteQuestionWithResolvedSubject({
    question,
    history: workingHistory
  })

  let parsed: ChasModelResponse

  try {
    const rawAnswer = await callOpenAI({
      instructions: buildInstructions(),
      input: buildInput({
        originalQuestion: question,
        resolvedQuestion,
        hasCurrentImage: !!imageDataUrl,
        hasCarryForwardImage: shouldCarryForwardImage,
        history: workingHistory
      }),
      currentImageDataUrl: imageDataUrl,
      carryForwardImageDataUrl: shouldCarryForwardImage
        ? latestImageContext.imageDataUrl
        : ''
    })

    const cleanAnswer = normaliseText(rawAnswer)
    parsed = classifyIntent(question, cleanAnswer || buildFallback(question).answer)
  } catch (error) {
    console.error('CHAS model call failed:', error)
    parsed = buildFallback(question)
  }

  await saveChasMessageSafe({
    company,
    worker,
    jobId,
    question,
    answer: parsed.answer,
    imageDataUrl: imageDataUrl || null,
    intent: parsed.intent,
    confidence: parsed.confidence,
    escalateTo: parsed.escalateTo,
    safetyFlag: parsed.safetyFlag
  })

  return NextResponse.json({
    ok: true,
    answer: parsed.answer,
    intent: parsed.intent,
    confidence: parsed.confidence,
    escalateTo: parsed.escalateTo,
    safetyFlag: parsed.safetyFlag
  })
}