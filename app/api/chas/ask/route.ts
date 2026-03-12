export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import prisma from '@/lib/prisma'
import { buildChasSystemPrompt } from '@/lib/chasSystemPrompt'
import { buildChasPropertyContext } from '@/lib/chasPropertyContext'
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
    // 🌿 PLANT IDENTIFICATION PATH
    // ---------------------------

    if (imageDataUrl && isPlantQuestion(question)) {
      try {
        const results = await identifyPlantWithPlantNet({
          imageDataUrls: [imageDataUrl]
        })

        const plantReply = buildFriendlyPlantReply(results)

        await prisma.chasMessage.create({
          data: {
            company,
            worker,
            jobId,
            question,
            answer: plantReply.answer,
            imageDataUrl
          }
        })

        return NextResponse.json({
          answer: plantReply.answer,
          intent: 'plant_id',
          confidence: plantReply.confidence,
          escalateTo: null,
          safetyFlag: false
        })
      } catch (error) {
        console.error('Plant identification failed', error)
      }
    }

    // ---------------------------
    // NORMAL CHAS RESPONSE
    // ---------------------------

    const { currentJobText, relatedHistoryText } =
      await buildChasPropertyContext(jobId)

    const historyText = await getHistoryText(company, worker, jobId)

    const systemPrompt = buildChasSystemPrompt({
      company,
      worker,
      currentDateIso: new Date().toISOString(),
      currentJobText,
      relatedHistoryText,
      historyText
    })

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      instructions: systemPrompt,
      input: `Worker question:\n${question}`,
      max_output_tokens: 600
    })

    const answer =
      typeof response.output_text === 'string'
        ? response.output_text
        : 'Sorry, I could not generate a reply.'

    await prisma.chasMessage.create({
      data: {
        company,
        worker,
        jobId,
        question,
        answer,
        imageDataUrl
      }
    })

    return NextResponse.json({
      answer,
      intent: 'general',
      confidence: 'medium',
      escalateTo: null,
      safetyFlag: false
    })
  } catch (error) {
    console.error('POST /api/chas/ask failed', error)

    return NextResponse.json(
      { error: 'CHAS failed to respond.' },
      { status: 500 }
    )
  }
}