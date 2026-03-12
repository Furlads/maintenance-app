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

function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
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
    'prune',
    'pruning',
    'cut back',
    'trim',
    'weed',
    'leaf',
    'leaves',
    'branch',
    'branches',
    'can i cut it',
    'can i cut this',
    'what is this',
    'what’s this',
    'whats this',
    'can i trim it',
    'can i trim this'
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
    'can i cut this',
    'can i trim this',
    'is it safe',
    'is that safe',
    'what about this',
    'what about that',
    'can i do that',
    'can i remove it',
    'can i prune it',
    'should i cut it',
    'should i trim it',
    'is this okay',
    'is that okay'
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
        'I can help with that — send me a photo if you can and I’ll give you the best steer. If there are nests or birds about, check before cutting.',
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

function tokenise(text: string): string[] {
  return normaliseText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
}

function scoreQuestionSimilarity(currentQuestion: string, previousQuestion: string): number {
  const currentTokens = new Set(tokenise(currentQuestion))
  const previousTokens = new Set(tokenise(previousQuestion))

  if (currentTokens.size === 0 || previousTokens.size === 0) return 0

  let overlap = 0

  for (const token of currentTokens) {
    if (previousTokens.has(token)) {
      overlap += 1
    }
  }

  const baseScore = overlap / Math.max(currentTokens.size, previousTokens.size)

  const currentNormalised = normaliseText(currentQuestion).toLowerCase()
  const previousNormalised = normaliseText(previousQuestion).toLowerCase()

  if (currentNormalised === previousNormalised) {
    return 1
  }

  if (
    currentNormalised.includes(previousNormalised) ||
    previousNormalised.includes(currentNormalised)
  ) {
    return Math.max(baseScore, 0.8)
  }

  return baseScore
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

Memory rules:
- Use the recent context provided.
- Use the relevant past Q&A provided if it helps answer the question.
- If the worker asks something they have asked before, it is good to answer consistently.
- If there is a clearly relevant previous answer, you can reuse it naturally instead of acting like this is brand new.
- If the worker asks a follow-up like "can I cut it?", "what about this?", "is that okay?", "can I trim that?", or "is it safe?", assume they are referring to the current subject in recent context unless they clearly change topic.
- If recent context says there was a photo and CHAS already identified or discussed it, do not ask them to upload it again unless the image is unclear and you genuinely need a better one.

Tone:
- like a real office teammate
- practical
- normal
- calm
- helpful
- not cheesy
- not overly chatty

Important:
- Keep answers concise enough for someone on site to read quickly.
- Do not say you cannot remember if relevant memory has been provided in context.
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

  const latestWithImage = [...recent].reverse().find((item) => !!cleanString(item.imageDataUrl))
  if (latestWithImage) {
    lines.push('')
    lines.push('CURRENT SUBJECT:')
    lines.push(`Latest photo question: ${latestWithImage.question}`)
    lines.push(`Latest photo answer: ${latestWithImage.answer}`)
    lines.push('Assume follow-up words like "it", "this", "that", or "them" refer to this current subject unless the worker clearly changes topic.')
  }

  return lines.join('\n')
}

function buildRelevantPastAnswers(question: string, history: HistoryItem[]) {
  const scored = history
    .map((item) => ({
      item,
      score: scoreQuestionSimilarity(question, item.question)
    }))
    .filter((entry) => entry.score >= 0.22)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (scored.length === 0) {
    return 'No strong past matches found.'
  }

  return scored
    .map(
      (entry, index) =>
        `Past match ${index + 1} (score ${entry.score.toFixed(2)}): Worker asked "${entry.item.question}" and CHAS answered "${entry.item.answer}"`
    )
    .join('\n')
}

function findBestPastAnswer(question: string, history: HistoryItem[]) {
  const scored = history
    .map((item) => ({
      item,
      score: scoreQuestionSimilarity(question, item.question)
    }))
    .sort((a, b) => b.score - a.score)

  return scored[0] ?? null
}

function buildInput(params: {
  question: string
  hasImage: boolean
  recentHistory: HistoryItem[]
  fullHistory: HistoryItem[]
}) {
  const followUpNote = looksLikeFollowUpReference(params.question)
    ? 'The latest worker message looks like a follow-up reference. Resolve "it/this/that" using the current subject in recent context.'
    : 'Answer using recent context and past matches if relevant.'

  return `
Photo attached with latest message: ${params.hasImage ? 'yes' : 'no'}

Recent context:
${buildRecentContext(params.recentHistory)}

Relevant past Q&A:
${buildRelevantPastAnswers(params.question, params.fullHistory)}

Follow-up resolution note:
${followUpNote}

Latest worker message:
${params.question}

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
  imageDataUrl?: string
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const model = process.env.CHAS_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini'

  const inputItems: Array<Record<string, unknown>> = [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: params.input
        }
      ]
    }
  ]

  const cleanImage = cleanString(params.imageDataUrl)
  if (cleanImage) {
    ;(inputItems[0].content as Array<Record<string, unknown>>).push({
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
      instructions: params.instructions,
      input: inputItems,
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

  let fullHistory: HistoryItem[] = []
  let recentHistory: HistoryItem[] = []

  try {
    const rows = await prisma.chasMessage.findMany({
      where: {
        company,
        worker
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 200,
      select: {
        question: true,
        answer: true,
        imageDataUrl: true,
        createdAt: true
      }
    })

    fullHistory = rows
    recentHistory = rows.filter((row) => {
      const createdAt = new Date(row.createdAt)
      return createdAt >= startOfToday() && createdAt <= endOfToday()
    })
  } catch (error) {
    console.error('CHAS history load failed:', error)
  }

  let parsed: ChasModelResponse

  try {
    const bestPast = findBestPastAnswer(question, fullHistory)

    if (bestPast && bestPast.score >= 0.92 && !imageDataUrl) {
      parsed = classifyIntent(question, bestPast.item.answer)
    } else {
      const rawAnswer = await callOpenAI({
        instructions: buildInstructions(),
        input: buildInput({
          question,
          hasImage: !!imageDataUrl,
          recentHistory,
          fullHistory
        }),
        imageDataUrl
      })

      const cleanAnswer = normaliseText(rawAnswer)
      parsed = classifyIntent(question, cleanAnswer || buildFallback(question).answer)
    }
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