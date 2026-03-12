export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import prisma from '@/lib/prisma'
import { buildChasSystemPrompt } from '@/lib/chasSystemPrompt'
import { identifyPlantWithPlantNet, buildFriendlyPlantReply } from '@/lib/plantnet'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

type AskBody = {
  company?: string
  worker?: string
  jobId?: number | null
  question?: string
  imageDataUrl?: string
}

type ChasApiResult = {
  answer: string
  intent:
    | 'plant_id'
    | 'task_advice'
    | 'hedge_advice'
    | 'safety'
    | 'customer_explanation'
    | 'job_next_step'
    | 'pricing'
    | 'damage_or_problem'
    | 'escalation_required'
    | 'general'
  confidence: 'high' | 'medium' | 'low'
  escalateTo: 'trevor' | 'kelly' | null
  saveToJobNotesSuggested: boolean
  followUpSuggested: boolean
  safetyFlag: boolean
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isPlantQuestion(question: string) {
  const q = question.toLowerCase()

  return (
    q.includes('plant') ||
    q.includes('tree') ||
    q.includes('shrub') ||
    q.includes('what is this') ||
    q.includes('identify') ||
    q.includes('what plant') ||
    q.includes('what tree')
  )
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

function stripMarkdownFences(value: string) {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normaliseChasResult(input: Partial<ChasApiResult> | null): ChasApiResult {
  const validIntentValues: ChasApiResult['intent'][] = [
    'plant_id',
    'task_advice',
    'hedge_advice',
    'safety',
    'customer_explanation',
    'job_next_step',
    'pricing',
    'damage_or_problem',
    'escalation_required',
    'general'
  ]

  const validConfidenceValues: ChasApiResult['confidence'][] = ['high', 'medium', 'low']

  let escalateTo: 'trevor' | 'kelly' | null = null

  if (input?.escalateTo === 'trevor' || input?.escalateTo === 'kelly') {
    escalateTo = input.escalateTo
  }

  const intent = validIntentValues.includes(input?.intent as ChasApiResult['intent'])
    ? (input?.intent as ChasApiResult['intent'])
    : 'general'

  const confidence = validConfidenceValues.includes(
    input?.confidence as ChasApiResult['confidence']
  )
    ? (input?.confidence as ChasApiResult['confidence'])
    : 'medium'

  const answer = cleanString(input?.answer) || 'Sorry, I could not generate a proper reply.'

  return {
    answer,
    intent,
    confidence,
    escalateTo,
    saveToJobNotesSuggested: Boolean(input?.saveToJobNotesSuggested),
    followUpSuggested: Boolean(input?.followUpSuggested),
    safetyFlag: Boolean(input?.safetyFlag)
  }
}

async function getHistoryText(company: string, worker: string, jobId: number | null) {
  const where =
    jobId
      ? {
          company,
          worker,
          jobId,
          createdAt: {
            gte: startOfToday(),
            lte: endOfToday()
          }
        }
      : {
          company,
          worker,
          createdAt: {
            gte: startOfToday(),
            lte: endOfToday()
          }
        }

  const messages = await prisma.chasMessage.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 12
  })

  if (!messages.length) return 'No previous CHAS messages today.'

  return messages
    .map((m) => `Worker: ${m.question}\nCHAS: ${m.answer}`)
    .join('\n\n')
}

function extractResponseText(response: OpenAI.Responses.Response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim()
  }

  const joined = response.output
    .flatMap((item) => {
      if (item.type !== 'message') return []

      return item.content
        .filter((contentItem) => contentItem.type === 'output_text')
        .map((contentItem) => contentItem.text)
    })
    .join('\n')
    .trim()

  return joined
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AskBody

    const company = cleanString(body.company) || 'Furlads'
    const worker = cleanString(body.worker)
    const question = cleanString(body.question)
    const imageDataUrl = cleanString(body.imageDataUrl)
    const jobId = typeof body.jobId === 'number' ? body.jobId : null

    if (!worker) {
      return NextResponse.json({ error: 'Missing worker' }, { status: 400 })
    }

    if (!question) {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 })
    }

    // ---------------------------
    // PLANT IDENTIFICATION PATH
    // ---------------------------

    if (imageDataUrl && isPlantQuestion(question)) {
      try {
        const results = await identifyPlantWithPlantNet({
          imageDataUrls: [imageDataUrl]
        })

        const plantReply = buildFriendlyPlantReply(results)

        const plantResult: ChasApiResult = {
          answer: plantReply.answer,
          intent: 'plant_id',
          confidence: plantReply.confidence,
          escalateTo: null,
          saveToJobNotesSuggested: false,
          followUpSuggested: plantReply.confidence !== 'high',
          safetyFlag: false
        }

        await prisma.chasMessage.create({
          data: {
            company,
            worker,
            jobId,
            question,
            answer: plantResult.answer,
            imageDataUrl
          }
        })

        return NextResponse.json(plantResult)
      } catch (error) {
        console.error('Plant identification failed', error)
      }
    }

    // ---------------------------
    // NORMAL CHAS RESPONSE
    // ---------------------------

    const historyText = await getHistoryText(company, worker, jobId)

    const systemPrompt = buildChasSystemPrompt({
      company,
      worker,
      currentDateIso: new Date().toISOString(),
      currentJobText: 'No job context supplied.',
      relatedHistoryText: 'No related job history supplied.',
      historyText
    })

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions: systemPrompt,
      input: `Worker question:\n${question}`,
      max_output_tokens: 700
    })

    const rawText = extractResponseText(response)
    const parsed = safeJsonParse<Partial<ChasApiResult>>(stripMarkdownFences(rawText))
    const result = normaliseChasResult(parsed)

    await prisma.chasMessage.create({
      data: {
        company,
        worker,
        jobId,
        question,
        answer: result.answer,
        imageDataUrl
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/chas/ask failed', error)

    return NextResponse.json(
      { error: 'CHAS failed to respond.' },
      { status: 500 }
    )
  }
}