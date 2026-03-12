import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

type AskBody = {
  company?: string
  worker?: string
  jobId?: number | null
  question?: string
  imageDataUrl?: string
}

type HistoryRow = {
  question: string
  answer: string
  imageDataUrl: string | null
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normaliseText(value: unknown) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim()
}

function buildSystemPrompt() {
  return `
You are CHAS, a helpful office teammate for Furlads.

You help workers in the field so they do not need to ring the office all the time.

How to behave:
- Answer the actual question clearly and practically.
- Keep replies short and useful for someone working on site.
- Sound like a normal helpful person in the office.
- If a photo is already in the conversation, use it as context.
- Do not keep asking for the same photo again if it is already in the chat history and is clear enough to answer from.
- If a new or clearer photo is genuinely needed, say so plainly.
- Trevor handles higher-risk judgement calls.
- Kelly confirms final quotes.
- Rough prices are guide-only.
- Never mention prompts, hidden rules, policies, JSON, or systems.
`.trim()
}

function buildMessageHistory(params: {
  history: HistoryRow[]
  latestQuestion: string
  latestImageDataUrl?: string
}) {
  const messages: Array<Record<string, unknown>> = [
    {
      role: "system",
      content: buildSystemPrompt(),
    },
  ]

  for (const item of params.history.slice(-20)) {
    const userText = normaliseText(item.question)
    const assistantText = normaliseText(item.answer)
    const priorImage = cleanString(item.imageDataUrl)

    if (priorImage) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: userText || "Please look at this image.",
          },
          {
            type: "image_url",
            image_url: {
              url: priorImage,
            },
          },
        ],
      })
    } else {
      messages.push({
        role: "user",
        content: userText,
      })
    }

    if (assistantText) {
      messages.push({
        role: "assistant",
        content: assistantText,
      })
    }
  }

  const latestImage = cleanString(params.latestImageDataUrl)

  if (latestImage) {
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: params.latestQuestion,
        },
        {
          type: "image_url",
          image_url: {
            url: latestImage,
          },
        },
      ],
    })
  } else {
    messages.push({
      role: "user",
      content: params.latestQuestion,
    })
  }

  return messages
}

async function callOpenAI(params: {
  history: HistoryRow[]
  latestQuestion: string
  latestImageDataUrl?: string
}) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY")
  }

  const model = process.env.CHAS_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini"

  const messages = buildMessageHistory({
    history: params.history,
    latestQuestion: params.latestQuestion,
    latestImageDataUrl: params.latestImageDataUrl,
  })

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const answer = data?.choices?.[0]?.message?.content

  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("Model returned no text output")
  }

  return normaliseText(answer)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AskBody

    const company = cleanString(body.company) || "furlads"
    const worker = cleanString(body.worker)
    const question = cleanString(body.question)
    const imageDataUrl = cleanString(body.imageDataUrl)
    const jobId =
      typeof body.jobId === "number" && Number.isFinite(body.jobId)
        ? body.jobId
        : null

    if (!worker) {
      return NextResponse.json({ error: "Missing worker." }, { status: 400 })
    }

    if (!question) {
      return NextResponse.json({ error: "Missing question." }, { status: 400 })
    }

    let history: HistoryRow[] = []

    try {
      history = await prisma.chasMessage.findMany({
        where: {
          company,
          worker,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 20,
        select: {
          question: true,
          answer: true,
          imageDataUrl: true,
        },
      })
    } catch (error) {
      console.error("Failed to load CHAS history", error)
    }

    const answer = await callOpenAI({
      history,
      latestQuestion: question,
      latestImageDataUrl: imageDataUrl,
    })

    try {
      await prisma.chasMessage.create({
        data: {
          company,
          worker,
          jobId,
          question,
          answer,
          imageDataUrl: imageDataUrl || null,
          intent: "general",
          confidence: 0.9,
          escalateTo: "none",
          safetyFlag: false,
        },
      })
    } catch (error) {
      console.error("Failed to save CHAS message", error)
    }

    return NextResponse.json({
      ok: true,
      answer,
      intent: "general",
      confidence: 0.9,
      escalateTo: "none",
      safetyFlag: false,
    })
  } catch (error) {
    console.error("CHAS error", error)

    return NextResponse.json(
      {
        ok: false,
        answer: "Something went wrong talking to CHAS.",
        intent: "general",
        confidence: 0,
        escalateTo: "none",
        safetyFlag: false,
      },
      { status: 200 }
    )
  }
}