export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Body = {
  company?: string
  worker?: string
  workerId?: number | null
  question?: string
  imageDataUrl?: string
  jobId?: number | null
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

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body

    const company = clean(body.company) || 'furlads'
    const worker = clean(body.worker)
    const question = clean(body.question)
    const imageDataUrl = clean(body.imageDataUrl)
    const jobId =
      typeof body.jobId === 'number' && Number.isFinite(body.jobId)
        ? body.jobId
        : null

    if (!worker) {
      return NextResponse.json(
        { error: 'Missing worker.' },
        { status: 400 }
      )
    }

    if (!question) {
      return NextResponse.json(
        { error: 'Missing question.' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not set in env.' },
        { status: 500 }
      )
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
      orderBy: { createdAt: 'asc' },
      take: 20
    })

    const input: any[] = [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              `You are Chas — a fast, practical teammate for a UK grounds maintenance company.\n` +
              `Help workers on-site with plant ID, hedge cutting, what to do next, customer questions, and practical grounds maintenance advice.\n` +
              `Keep answers concise, clear, and practical.\n` +
              `If unsure, ask one short follow-up question.\n` +
              `If the task involves dangerous safety risk (chainsaws, ladders, electrics, unsafe trees, unstable structures), tell them to stop and call Trev or Kelly.\n` +
              `Use UK English.\n`
          }
        ]
      }
    ]

    for (const msg of history) {
      input.push({
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: msg.question
          }
        ]
      })

      input.push({
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: msg.answer
          }
        ]
      })
    }

    const newTurn: any = {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: question
        }
      ]
    }

    if (imageDataUrl) {
      newTurn.content.push({
        type: 'input_image',
        image_url: imageDataUrl
      })
    }

    input.push(newTurn)

    const payload = {
      model: 'gpt-4.1-mini',
      input
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    })

    const raw = await response.text()

    if (!response.ok) {
      console.error('OpenAI error:', raw)

      return NextResponse.json(
        {
          error: 'OpenAI request failed',
          status: response.status,
          detail: raw
        },
        { status: 500 }
      )
    }

    let data: any = null

    try {
      data = JSON.parse(raw)
    } catch {
      console.error('OpenAI returned non-JSON:', raw)

      return NextResponse.json(
        {
          error: 'OpenAI returned non-JSON',
          detail: raw
        },
        { status: 500 }
      )
    }

    const answer =
      data?.output_text ||
      (Array.isArray(data?.output)
        ? data.output
            .flatMap((item: any) => item?.content || [])
            .filter(
              (content: any) =>
                content?.type === 'output_text' &&
                typeof content?.text === 'string'
            )
            .map((content: any) => content.text)
            .join('\n')
        : '') ||
      "Sorry — I couldn't generate an answer that time."

    await prisma.chasMessage.create({
      data: {
        company,
        worker,
        jobId: jobId ?? undefined,
        question,
        answer,
        imageDataUrl: imageDataUrl || ''
      }
    })

    return NextResponse.json({ ok: true, answer })
  } catch (error: any) {
    console.error('POST /api/chas/ask failed:', error)

    return NextResponse.json(
      {
        error: 'Server error',
        detail: String(error?.message || error)
      },
      { status: 500 }
    )
  }
}