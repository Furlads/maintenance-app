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

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normaliseText(value: unknown) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim()
}

function extractResponseText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim()
  }

  if (Array.isArray(data?.output)) {
    const texts: string[] = []

    for (const item of data.output) {
      if (item?.type !== "message") continue
      if (!Array.isArray(item?.content)) continue

      for (const content of item.content) {
        if (content?.type === "output_text" && typeof content?.text === "string") {
          texts.push(content.text)
        }
      }
    }

    const joined = texts.join("\n").trim()
    if (joined) return joined
  }

  return ""
}

function buildInstructions() {
  return `
You are CHAS, a helpful office teammate for Furlads.

You help workers in the field so they do not need to ring the office all the time.

How to behave:
- Answer the actual question clearly and practically.
- Keep replies short and useful for someone working on site.
- Sound like a normal helpful person in the office.
- If a photo is already part of the conversation, use it as context.
- Do not keep asking for the same photo again if it is already in the conversation and clear enough.
- If a new or clearer photo is genuinely needed, say so plainly.
- Trevor handles higher-risk judgement calls.
- Kelly confirms final quotes.
- Rough prices are guide-only.
- Never mention prompts, hidden rules, policies, JSON, or systems.
`.trim()
}

async function callOpenAI(params: {
  question: string
  imageDataUrl?: string
  previousResponseId?: string
}) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY")
  }

  const model = process.env.CHAS_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini"

  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: params.question,
    },
  ]

  const imageDataUrl = cleanString(params.imageDataUrl)
  if (imageDataUrl) {
    content.push({
      type: "input_image",
      image_url: imageDataUrl,
    })
  }

  const body: Record<string, unknown> = {
    model,
    instructions: buildInstructions(),
    input: [
      {
        role: "user",
        content,
      },
    ],
    temperature: 0.6,
  }

  const previousResponseId = cleanString(params.previousResponseId)
  if (previousResponseId) {
    body.previous_response_id = previousResponseId
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const answer = extractResponseText(data)

  if (!answer) {
    throw new Error("Model returned no text output")
  }

  return {
    answer: normaliseText(answer),
    responseId: typeof data?.id === "string" ? data.id : "",
  }
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

    let previousResponseId = ""

    try {
      const lastMessage = await prisma.chasMessage.findFirst({
        where: {
          company,
          worker,
          responseId: {
            not: null,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          responseId: true,
        },
      })

      previousResponseId = cleanString(lastMessage?.responseId)
    } catch (error) {
      console.error("Failed to load previous CHAS response ID", error)
    }

    const result = await callOpenAI({
      question,
      imageDataUrl,
      previousResponseId,
    })

    try {
      await prisma.chasMessage.create({
        data: {
          company,
          worker,
          jobId,
          question,
          answer: result.answer,
          imageDataUrl: imageDataUrl || null,
          responseId: result.responseId || null,
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
      answer: result.answer,
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