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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

  const words = [
    'plant',
    'tree',
    'shrub',
    'hedge',
    'laurel',
    'conifer',
    'prune',
    'pruning',
    'cut back',
    'trim',
    'weed',
    'leaf',
    'leaves',
    'branch',
    'branches'
  ]

  return words.some((word) => lower.includes(word))
}

function looksLikePricingQuestion(text: string): boolean {
  const lower = text.toLowerCase()

  const words = [
    'price',
    'quote',
    'cost',
    'how much',
    'rough price',
    'guide price',
    'what would you charge',
    'what do you reckon'
  ]

  return words.some((word) => lower.includes(word))
}

function looksLikeSafetyQuestion(text: string): boolean {
  const lower = text.toLowerCase()

  const words = [
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
  ]

  return words.some((word) => lower.includes(word))
}

function buildFallback(question: string): ChasModelResponse {
  const lower = question.toLowerCase()

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
        'I can help with that — send me a photo if you can and I’ll give you the best steer. If there are nests or anything sensitive going on, check before cutting.',
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

function validateModelResponse(parsed: unknown, question: string): ChasModelResponse {
  if (!isObject(parsed)) {
    return buildFallback(question)
  }

  const answer = normaliseText(parsed.answer)
  const intent = normaliseText(parsed.intent)
  const escalateTo = normaliseText(parsed.escalateTo)

  const safeIntent: ChasIntent = (
    [
      'general',
      'plant_id',
      'pricing_guide',
      'safety',
      'quote_support',
      'escalation'
    ] as const
  ).includes(intent as ChasIntent)
    ? (intent as ChasIntent)
    : 'general'

  const safeEscalateTo: ChasEscalateTo =
    escalateTo === 'kelly' || escalateTo === 'trevor' || escalateTo === 'none'
      ? (escalateTo as ChasEscalateTo)
      : 'none'

  return {
    answer: answer || buildFallback(question).answer,
    intent: safeIntent,
    confidence: clampConfidence(parsed.confidence),
    escalateTo: safeEscalateTo,
    safetyFlag: typeof parsed.safetyFlag === 'boolean' ? parsed.safetyFlag : false
  }
}

function buildMessages(params: {
  question: string
  hasImage: boolean
  history: HistoryItem[]
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

  const developerMessage = `
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

Tone:
- like a real office teammate
- practical
- normal
- calm
- helpful
- not cheesy
- not overly chatty

Important:
- A worker asking something like "can I cut laurel?" should get an actual useful answer, not a generic fallback.
- If you are unsure, say so honestly and ask for a photo if that would genuinely help.
- Keep answers concise enough for someone on site to read quickly.
`.trim()

  const userMessage = `
Photo attached: ${params.hasImage ? 'yes' : 'no'}

Conversation so far today:
${historyText}

Latest worker message:
${params.question}
`.trim()

  return { developerMessage, userMessage }
}

async function callOpenAIStructured(params: {
  developerMessage: string
  userMessage: string
  imageDataUrl?: string
}): Promise<ChasModelResponse> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const model = process.env.CHAS_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini'

  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: params.userMessage
    }
  ]

  const cleanImage = cleanString(params.imageDataUrl)
  if (cleanImage) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: cleanImage
      }
    })
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'chas_response',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              answer: { type: 'string' },
              intent: {
                type: 'string',
                enum: [
                  'general',
                  'plant_id',
                  'pricing_guide',
                  'safety',
                  'quote_support',
                  'escalation'
                ]
              },
              confidence: { type: 'number' },
              escalateTo: {
                type: 'string',
                enum: ['none', 'kelly', 'trevor']
              },
              safetyFlag: { type: 'boolean' }
            },
            required: ['answer', 'intent', 'confidence', 'escalateTo', 'safetyFlag']
          }
        }
      },
      messages: [
        {
          role: 'developer',
          content: params.developerMessage
        },
        {
          role: 'user',
          content: userContent
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Model returned no structured content')
  }

  const parsed = JSON.parse(content)
  return validateModelResponse(parsed, params.userMessage)
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
      take: 12,
      select: {
        question: true,
        answer: true
      }
    })

    const promptParts = buildMessages({
      question,
      hasImage: !!imageDataUrl,
      history
    })

    const parsed = await callOpenAIStructured({
      developerMessage: promptParts.developerMessage,
      userMessage: promptParts.userMessage,
      imageDataUrl
    })

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
        safetyFlag: parsed.safetyFlag
      }
    })

    return NextResponse.json({
      ok: true,
      answer: parsed.answer,
      intent: parsed.intent,
      confidence: parsed.confidence,
      escalateTo: parsed.escalateTo,
      safetyFlag: parsed.safetyFlag
    })
  } catch (error) {
    console.error('POST /api/chas/ask failed', error)

    const safeFallback: ChasModelResponse = {
      answer: 'No worries — send me a bit more and I’ll help.',
      intent: 'general',
      confidence: 0.2,
      escalateTo: 'none',
      safetyFlag: false
    }

    return NextResponse.json(
      {
        ok: false,
        answer: safeFallback.answer,
        intent: safeFallback.intent,
        confidence: safeFallback.confidence,
        escalateTo: safeFallback.escalateTo,
        safetyFlag: safeFallback.safetyFlag
      },
      { status: 200 }
    )
  }
}