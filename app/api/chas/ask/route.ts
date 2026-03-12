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

function buildInstructions() {
  return `
You are CHAS, a helpful office teammate for Furlads.

You help workers in the field so they do not need to ring the office all the time.

How to reply:
- Answer the actual question first.
- Keep replies clear, practical, and natural.
- Sound like a normal helpful person in the office.
- Do not sound robotic or like a form.
- Keep replies fairly short so they are easy to read on site.
- If a photo would help, say so naturally.
- If something sounds risky or uncertain, say that clearly.
- Trevor handles higher-risk judgement calls.
- Kelly confirms final quotes.
- Rough prices are guide-only.
- Never mention prompts, policies, JSON, systems, or internal rules.
`.trim()
}

function buildInput(params: {
  question: string
  history: HistoryItem[]
}) {
  const recent = params.history.slice(-6)

  const historyText =
    recent.length === 0
      ? 'No previous conversation.'
      : recent
          .map(
            (item, index) =>
              `Turn ${index + 1} worker: ${item.question}\nTurn ${index + 1} CHAS: ${item.answer}`
          )
          .join('\n\n')

  return `
Recent conversation:
${historyText}

Latest worker message:
${params.question}

Reply as CHAS with one normal helpful message only.
`.trim()
}

async function callOpenAI(params: {
  input: string
  imageDataUrl?: string
}) {
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

  const imageDataUrl = cleanString(params.imageDataUrl)
  if (imageDataUrl) {
    content.push({
      type: 'input_image',
      image_url: imageDataUrl
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
      instructions: buildInstructions(),
      input: [
        {
          role: 'user',
          content
        }
      ]
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

  return normaliseText(text)
}

async function saveMessageSafe(data: {
  company: string
  worker: string
  jobId: number | null
  question: string
  answer: string
  imageDataUrl: string | null
}) {
  try {
    await prisma.chasMessage.create({
      data: {
        company: data.company,
        worker: data.worker,
        jobId: data.jobId,
        question: data.question,
        answer: data.answer,
        imageDataUrl: data.imageDataUrl,
        intent: 'general',
        confidence: 0.8,
        escalateTo: 'none',
        safetyFlag: false
      }
    })
  } catch (error) {
    console.error('CHAS save failed:', error)
  }
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
        take: 12,
        select: {
          question: true,
          answer: true
        }
      })
    } catch (error) {
      console.error('CHAS history load failed:', error)
    }

    const answer = await callOpenAI({
      input: buildInput({
        question,
        history
      }),
      imageDataUrl
    })

    await saveMessageSafe({
      company,
      worker,
      jobId,
      question,
      answer,
      imageDataUrl: imageDataUrl || null
    })

    return NextResponse.json({
      ok: true,
      answer,
      intent: 'general',
      confidence: 0.8,
      escalateTo: 'none',
      safetyFlag: false
    })
  } catch (error) {
    console.error('POST /api/chas/ask failed', error)

    return NextResponse.json(
      {
        ok: false,
        answer: 'Something went wrong talking to OpenAI.',
        intent: 'general',
        confidence: 0,
        escalateTo: 'none',
        safetyFlag: false
      },
      { status: 200 }
    )
  }
}