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

function normaliseIncomingImageDataUrl(value: unknown) {
  const cleaned = cleanString(value)

  if (!cleaned) return ""

  if (!cleaned.startsWith("data:image/")) {
    return ""
  }

  return cleaned
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

Main rule:
- If you are not 99% sure, do not guess.
- Always say: "Remember, if in doubt give Trev a shout."
- Wrong action is worse than waiting and checking first.

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

Critical caution rule:
- Never guess plant identification.
- Never approve cutting, pruning, removing, digging out, or spraying if you are not 99% sure.
- If you are not 99% sure, clearly say: "Remember, if in doubt give Trev a shout." and tell them to call Trev before going ahead.
- If a photo is unclear, say so and tell them to call Trev or send a clearer one.
- Be conservative. It is better to check than get it wrong.

Critical pricing rule:
- You can give a rough guide price when the worker asks for cost help.
- Never present any price as final or confirmed.
- Use a sensible range where possible.
- For very small jobs, explain it may fall under a minimum visit charge.
- Do not mention hourly rates unless asked.
- Always make clear that Kelly will confirm the final price.

How to format estimate-style replies:
- Start with: "Estimated price:"
- Give a short practical range.
- Briefly say what it includes.
- End by saying it is a guide and Kelly will confirm.

Landscaping knowledge:
- Be useful on turfing, fencing, patios, gravel, hedge cutting, pruning, weeding, and general maintenance.
- Only give firm answers on cutting/pruning/removal if you are 99% sure.
- Plant ID must be treated cautiously.

Tone:
- like a real office teammate
- practical
- calm
- helpful
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

function isHighRiskQuestion(question: string) {
  const text = question.toLowerCase()

  const keywords = [
    "what plant",
    "identify",
    "plant id",
    "is this",
    "cut",
    "prune",
    "remove",
    "rip out",
    "dig out",
    "pull out",
    "spray",
  ]

  return keywords.some((keyword) => text.includes(keyword))
}

function inferEscalation(answer: string) {
  const text = answer.toLowerCase()

  if (text.includes("give trev a shout") || text.includes("call trev") || text.includes("ring trev")) {
    return "trev"
  }

  return "none"
}

function inferConfidence(escalateTo: string, question: string) {
  if (escalateTo === "trev") return 0.2
  if (isHighRiskQuestion(question)) return 0.55
  return 0.9
}

function inferSafetyFlag(question: string, answer: string) {
  const text = `${question} ${answer}`.toLowerCase()

  const safetyPhrases = [
    "stop",
    "danger",
    "unsafe",
    "ppe",
    "chemical",
    "spray",
  ]

  return safetyPhrases.some((phrase) => text.includes(phrase))
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
      temperature: 0.3,
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
    const imageDataUrl = normaliseIncomingImageDataUrl(body.imageDataUrl)
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
        where: { company, worker, sessionId },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { question: true, answer: true, imageDataUrl: true },
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

    const escalateTo = inferEscalation(answer)
    const confidence = inferConfidence(escalateTo, question)
    const safetyFlag = inferSafetyFlag(question, answer)

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
          confidence,
          escalateTo,
          safetyFlag,
        },
      })
    } catch (error) {
      console.error("Failed to save CHAS message", error)
    }

    return NextResponse.json({
      ok: true,
      answer,
      intent: "general",
      confidence,
      escalateTo,
      safetyFlag,
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