export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import prisma from '@/lib/prisma'
import { buildChasSystemPrompt } from '@/lib/chasSystemPrompt'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

type AskBody = {
  company?: string
  worker?: string
  workerId?: number | null
  jobId?: number | null
  question?: string
  imageDataUrl?: string
}

type ParsedChasResponse = {
  answer: string
  intent:
    | 'plant_id'
    | 'task_advice'
    | 'hedge_advice'
    | 'safety'
    | 'customer_explanation'
    | 'job_next_step'
    | 'materials_or_tools'
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

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function stripMarkdownFences(value: string) {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function normaliseParsedResponse(input: Partial<ParsedChasResponse> | null): ParsedChasResponse {
  const allowedIntentValues: ParsedChasResponse['intent'][] = [
    'plant_id',
    'task_advice',
    'hedge_advice',
    'safety',
    'customer_explanation',
    'job_next_step',
    'materials_or_tools',
    'damage_or_problem',
    'escalation_required',
    'general'
  ]

  const allowedConfidenceValues: ParsedChasResponse['confidence'][] = ['high', 'medium', 'low']
  const allowedEscalateValues: Array<ParsedChasResponse['escalateTo']> = ['trevor', 'kelly', null]

  const intent = allowedIntentValues.includes(input?.intent as ParsedChasResponse['intent'])
    ? (input?.intent as ParsedChasResponse['intent'])
    : 'general'

  const confidence = allowedConfidenceValues.includes(
    input?.confidence as ParsedChasResponse['confidence']
  )
    ? (input?.confidence as ParsedChasResponse['confidence'])
    : 'medium'

  const escalateTo = allowedEscalateValues.includes(
    (input?.escalateTo as ParsedChasResponse['escalateTo']) ?? null
  )
    ? ((input?.escalateTo as ParsedChasResponse['escalateTo']) ?? null)
    : null

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

async function getJobContextText(jobId: number | null | undefined) {
  if (!jobId || !Number.isInteger(jobId)) {
    return 'No specific job selected.'
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true
    }
  })

  if (!job) {
    return 'Selected job was not found.'
  }

  const lines = [
    `Job ID: ${job.id}`,
    `Title: ${job.title || ''}`,
    `Status: ${job.status || ''}`,
    `Job type: ${job.jobType || ''}`,
    `Address: ${job.address || ''}`,
    `Customer: ${job.customer?.name || ''}`,
    `Customer phone: ${job.customer?.phone || ''}`,
    `Customer postcode: ${job.customer?.postcode || ''}`,
    `Job notes: ${job.notes || ''}`
  ].filter(Boolean)

  return lines.join('\n')
}

async function getHistoryText(company: string, worker: string, jobId: number | null | undefined) {
  const where =
    jobId && Number.isInteger(jobId)
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
    orderBy: {
      createdAt: 'asc'
    },
    take: 12
  })

  if (!messages.length) {
    return 'No previous CHAS messages today.'
  }

  return messages
    .map((message) => {
      const parts = [
        `Worker: ${message.question}`,
        `CHAS: ${message.answer}`
      ]

      if (message.imageDataUrl) {
        parts.push('Worker attached an image with that message.')
      }

      return parts.join('\n')
    })
    .join('\n\n')
}

function buildUserMessage(question: string) {
  return `Worker question:\n${question}`.trim()
}

function extractTextFromResponse(response: OpenAI.Responses.Response) {
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

    const company = cleanString(body.company) || 'furlads'
    const worker = cleanString(body.worker)
    const question = cleanString(body.question)
    const imageDataUrl = cleanString(body.imageDataUrl)
    const jobId =
      typeof body.jobId === 'number' && Number.isInteger(body.jobId) ? body.jobId : null

    if (!worker) {
      return NextResponse.json({ error: 'Missing worker.' }, { status: 400 })
    }

    if (!question) {
      return NextResponse.json({ error: 'Missing question.' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not set on the server.' },
        { status: 500 }
      )
    }

    const jobContextText = await getJobContextText(jobId)
    const historyText = await getHistoryText(company, worker, jobId)

    const systemPrompt = buildChasSystemPrompt({
      company,
      worker,
      currentDateIso: new Date().toISOString(),
      jobContextText,
      historyText
    })

    const content: Array<
      | { type: 'input_text'; text: string }
      | { type: 'input_image'; image_url: string }
    > = [
      {
        type: 'input_text',
        text: buildUserMessage(question)
      }
    ]

    if (imageDataUrl) {
      content.push({
        type: 'input_image',
        image_url: imageDataUrl
      })
    }

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: systemPrompt
            }
          ]
        },
        {
          role: 'user',
          content
        }
      ],
      max_output_tokens: 700
    })

    const rawText = extractTextFromResponse(response)
    const parsed = safeJsonParse<ParsedChasResponse>(stripMarkdownFences(rawText))
    const result = normaliseParsedResponse(parsed)

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
    console.error('POST /api/chas/ask failed:', error)

    return NextResponse.json(
      {
        error: 'CHAS failed to respond.'
      },
      { status: 500 }
    )
  }
}