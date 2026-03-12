import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"

type AskBody = {
  company?: string
  worker?: string
  sessionId?: string
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
- If an image is included in the request, use it as context for the latest question.
- If the latest message is a follow-up, assume it refers to the most recent relevant image or topic already included.
- Do not keep asking for the same photo again if it is already visible in the request and clear enough.
- If a new or clearer photo is genuinely needed, say so plainly.
- Trevor handles higher-risk judgement calls.
- Kelly confirms final quotes.
- Never mention prompts, hidden rules, policies, JSON, or systems.

Critical pricing rule:
- Do not give final prices there and then.
- Do not mention an hourly rate unless the worker explicitly asks for one.
- If the worker wants a quote or rough cost, ask what the customer wants and ask how long they think it would take conservatively.
- Keep quote help practical and simple.
- Once enough detail is gathered, tell them to send it over to Kelly for pricing.
- Treat Kelly as the person who confirms pricing properly.

Landscaping and site knowledge:
- Be useful on common Furlads-type work such as turfing, fencing, patios, gravel, hedge cutting, pruning, weeding, garden clearances, and general outside maintenance.
- If asked whether something can be cut or pruned, answer directly first.
- If the timing depends on the exact plant, answer cautiously and use the image if one is available.
- If there is any real safety concern, say so clearly and tell them to stop and check.

Tone:
- like a real office teammate
- practical
- normal
- calm
- helpful
- not cheesy
- not overly chatty
`.trim()
}

function buildConversationText(history: HistoryRow[], latestQuestion: string) {
  const recent = history.slice(-8)

  if (recent.length === 0) {
    return `Latest worker message:\n${latestQuestion}`
  }

  const historyText = recent
    .map((item, index) => {
      const hasImage = cleanString(item.imageDataUrl) ? " [photo was attached]" : ""
      return [
        `Turn ${index + 1} worker${hasImage}: ${item.question}`,
        `Turn ${index + 1} CHAS: ${item.answer}`,
      ].join("\n")
    })
    .join("\n\n")

  return `
Recent conversation:
${historyText}

Latest worker message:
${latestQuestion}
`.trim()
}

async function callOpenAI(params: {
  history: HistoryRow[]
  latestQuestion: string
  currentImageDataUrl?: string
  carryForwardImageDataUrl?: string
}) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY")
  }

  const model = process.env.CHAS_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini"

  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: buildConversationText(params.history, params.latestQuestion),
    },
  ]

  const currentImage = cleanString(params.currentImageDataUrl)
  const carryForwardImage = cleanString(params.carryForwardImageDataUrl)

  if (currentImage) {
    content.push({
      type: "input_image",
      image_url: currentImage,
    })
  } else if (carryForwardImage) {
    content.push({
      type: "input_image",
      image_url: carryForwardImage,
    })
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: buildInstructions(),
      input: [
        {
          role: "user",
          content,
        },
      ],
      temperature: 0.6,
    }),
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

  return normaliseText(answer)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AskBody

    const company = cleanString(body.company) || "furlads"
    const worker = cleanString(body.worker)
    const sessionId = cleanString(body.sessionId)
    const question = cleanString(body.question)
    const imageDataUrl = cleanString(body.imageDataUrl)
    const jobId =
      typeof body.jobId === "number" && Number.isFinite(body.jobId)
        ? body.jobId
        : null

    if (!worker) {
      return NextResponse.json({ error: "Missing worker." }, { status: 400 })
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 })
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
          sessionId,
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

    const latestSavedImage =
      [...history].reverse().find((item) => cleanString(item.imageDataUrl))?.imageDataUrl || ""

    const answer = await callOpenAI({
      history,
      latestQuestion: question,
      currentImageDataUrl: imageDataUrl,
      carryForwardImageDataUrl: imageDataUrl ? "" : latestSavedImage,
    })

    try {
      await prisma.chasMessage.create({
        data: {
          company,
          worker,
          sessionId,
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