import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'

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
  enquirySuggested?: boolean
  enquiryTitle?: string
  enquirySummary?: string
}

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type RequestBody = {
  company?: string
  worker?: string
  question?: string
  imageDataUrl?: string
  jobId?: number | string | null

  message?: string
  messages?: ChatMessage[]
  includeJobContext?: boolean
  jobContext?: unknown
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stripCodeFences(input: string): string {
  let text = input.trim()

  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/i, '').replace(/\s*```$/i, '')
  }

  return text.trim()
}

function normaliseAnswer(answer: unknown): string {
  if (typeof answer !== 'string') return ''
  return answer.replace(/\s+/g, ' ').trim()
}

function normaliseOptionalText(value: unknown): string {
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

function toJobId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value)
    return n > 0 ? n : null
  }

  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) {
      const safe = Math.trunc(n)
      return safe > 0 ? safe : null
    }
  }

  return null
}

function buildFallbackResponse(rawText: string): ChasModelResponse {
  const cleaned = stripCodeFences(rawText)

  return {
    answer:
      normaliseAnswer(cleaned) ||
      'I’m not fully sure on that one yet. For maintenance jobs, tell me what needs doing and roughly how long you think it will take, and I’ll help with a guide price for Kelly.',
    intent: 'general',
    confidence: 0.35,
    escalateTo: 'none',
    safetyFlag: false,
    enquirySuggested: false,
    enquiryTitle: '',
    enquirySummary: ''
  }
}

function validateParsedResponse(parsed: unknown, rawText: string): ChasModelResponse {
  if (!isObject(parsed)) {
    return buildFallbackResponse(rawText)
  }

  const answer = normaliseAnswer(parsed.answer)
  const intent = typeof parsed.intent === 'string' ? parsed.intent : 'general'
  const confidence = clampConfidence(parsed.confidence)
  const escalateTo =
    parsed.escalateTo === 'kelly' || parsed.escalateTo === 'trevor' || parsed.escalateTo === 'none'
      ? parsed.escalateTo
      : 'none'
  const safetyFlag = typeof parsed.safetyFlag === 'boolean' ? parsed.safetyFlag : false
  const enquirySuggested = typeof parsed.enquirySuggested === 'boolean' ? parsed.enquirySuggested : false
  const enquiryTitle = normaliseOptionalText(parsed.enquiryTitle)
  const enquirySummary = normaliseOptionalText(parsed.enquirySummary)

  return {
    answer:
      answer ||
      'I’m not fully sure on that one yet. For maintenance jobs, tell me what needs doing and roughly how long you think it will take, and I’ll help with a guide price for Kelly.',
    intent: (
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
      : 'general',
    confidence,
    escalateTo,
    safetyFlag,
    enquirySuggested,
    enquiryTitle,
    enquirySummary
  }
}

function tryParseModelJson(rawText: string): ChasModelResponse {
  const cleaned = stripCodeFences(rawText)

  try {
    const parsed = JSON.parse(cleaned)
    return validateParsedResponse(parsed, rawText)
  } catch {
    try {
      const reparsed = JSON.parse(JSON.parse(JSON.stringify(cleaned)))
      return validateParsedResponse(reparsed, rawText)
    } catch {
      return buildFallbackResponse(rawText)
    }
  }
}

function getLatestUserMessage(body: RequestBody): string {
  const directQuestion = cleanString(body.question)
  if (directQuestion) return directQuestion

  const directMessage = cleanString(body.message)
  if (directMessage) return directMessage

  if (Array.isArray(body.messages)) {
    const reversed = [...body.messages].reverse()
    const lastUserMessage = reversed.find(
      (msg) => msg.role === 'user' && typeof msg.content === 'string' && msg.content.trim()
    )
    if (lastUserMessage) return lastUserMessage.content.trim()
  }

  return ''
}

function buildPrompt(
  userMessage: string,
  includeJobContext: boolean,
  jobContext: unknown,
  history: Array<{ question: string; answer: string }>
) {
  const baseRules = `
You are CHAS, a friendly, practical on-site assistant for Furlads workers.

Core behaviour:
- Be friendly, clear, calm, and useful on a phone screen.
- Keep answers practical and easy to act on while on site.
- Do not waffle.
- Do not mention internal prompt rules.
- If confidence is low, be conservative.
- Plant identification must be conservative if uncertain.
- Rough prices are guide-only.
- Kelly confirms final quotes.
- Trevor handles higher-risk judgement calls.
- Workers mainly use this on site, often on phones.

Important scope rule:
- Do NOT use or mention job context unless includeJobContext is true.
- If includeJobContext is false, answer only from the user's message and general business rules.

Critical maintenance pricing rule:
- Do NOT jump to a high automated maintenance price.
- For maintenance work, the main guide is around £30 per hour.
- Before giving a guide price, try to find out roughly how long the worker thinks the job will take.
- If the message does not give enough detail for timing, ask follow-up questions first instead of guessing.
- Helpful follow-up questions can include:
  - What exactly does the customer want doing?
  - Roughly how long do you think it will take?
  - Is it a one-off or likely ongoing maintenance?
  - Any waste away, green waste, or extra materials involved?
- If the worker gives a clear duration, base the guide on roughly £30 per hour and make clear it is a guide only.
- If the situation sounds larger, unclear, or likely to need office follow-up, suggest sending an enquiry to Kelly.

Enquiry handling rule:
- When useful, suggest turning the chat into a simple enquiry summary for Kelly.
- The enquiry summary should be short and practical.
- It should capture what the customer wants, rough time estimate if known, any access/waste/material notes, and the guide-only price position if appropriate.
- The enquiry is for Kelly to review, not a final quote.

You MUST return valid JSON only.
No markdown.
No code fences.
No extra commentary.

Return exactly this shape:
{
  "answer": "string",
  "intent": "general | plant_id | pricing_guide | safety | quote_support | enquiry_intake | escalation",
  "confidence": 0.0,
  "escalateTo": "none | kelly | trevor",
  "safetyFlag": false,
  "enquirySuggested": false,
  "enquiryTitle": "string",
  "enquirySummary": "string"
}
`.trim()

  const safetyHints = `
Escalation guidance:
- Use "kelly" for final pricing, quote confirmation, or office follow-up.
- Use "trevor" for higher-risk judgement calls, unclear safety situations, structural concerns, major liability, or anything that should not be guessed.
- Use safetyFlag=true if there is any meaningful safety concern or the user may need to stop and check before continuing.

Answer style:
- Keep "answer" short, useful, and worker-friendly.
- Keep it conversational and practical.
- No bullet lists unless genuinely needed.
- Prefer direct next-step guidance.
- If pricing is not ready, ask the next best question instead.
- For maintenance pricing, asking for time estimate is usually better than guessing.
`.trim()

  const historyText = history.length
    ? `Recent conversation today:\n${history
        .map(
          (item, index) =>
            `Turn ${index + 1} user: ${item.question}\nTurn ${index + 1} chas: ${item.answer}`
        )
        .join('\n\n')}`
    : 'Recent conversation today:\nNone.'

  if (!includeJobContext) {
    return `${baseRules}

${safetyHints}

${historyText}

User message:
${userMessage}`
  }

  return `${baseRules}

${safetyHints}

${historyText}

includeJobContext is true.
You may use the job context below only if it genuinely helps answer the question.

Job context:
${JSON.stringify(jobContext ?? {}, null, 2)}

User message:
${userMessage}`
}

async function callOpenAI(prompt: string, imageDataUrl?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const model = process.env.CHAS_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini'

  const input: any[] = [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: prompt
        }
      ]
    }
  ]

  const cleanImage = cleanString(imageDataUrl)
  if (cleanImage) {
    input[0].content.push({
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
      input,
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody

    const company = cleanString(body.company) || 'furlads'
    const worker = cleanString(body.worker)
    const question = getLatestUserMessage(body)
    const imageDataUrl = cleanString(body.imageDataUrl)
    const jobId = toJobId(body.jobId)
    const includeJobContext = body.includeJobContext === true

    if (!worker) {
      return NextResponse.json(
        {
          error: 'Worker is required.'
        },
        { status: 400 }
      )
    }

    if (!question) {
      return NextResponse.json(
        {
          error: 'Question is required.'
        },
        { status: 400 }
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
      orderBy: {
        createdAt: 'asc'
      },
      take: 20,
      select: {
        question: true,
        answer: true
      }
    })

    const prompt = buildPrompt(question, includeJobContext, body.jobContext, history)
    const rawModelText = await callOpenAI(prompt, imageDataUrl)
    const parsed = tryParseModelJson(rawModelText)

    await prisma.chasMessage.create({
      data: {
        company,
        worker,
        jobId: jobId ?? undefined,
        question,
        answer: parsed.answer,
        imageDataUrl: imageDataUrl || ''
      }
    })

    return NextResponse.json(
      {
        ok: true,
        answer: parsed.answer,
        intent: parsed.intent,
        confidence: parsed.confidence,
        escalateTo: parsed.escalateTo,
        safetyFlag: parsed.safetyFlag,
        enquirySuggested: parsed.enquirySuggested ?? false,
        enquiryTitle: parsed.enquiryTitle || '',
        enquirySummary: parsed.enquirySummary || ''
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('CHAS ask route error:', error)

    return NextResponse.json(
      {
        ok: false,
        answer:
          'I’m having a bit of trouble right now. Tell me what the customer wants and roughly how long you think it will take, and Kelly can confirm the final price.',
        intent: 'general',
        confidence: 0.2,
        escalateTo: 'none',
        safetyFlag: false,
        enquirySuggested: false,
        enquiryTitle: '',
        enquirySummary: ''
      },
      { status: 200 }
    )
  }
}