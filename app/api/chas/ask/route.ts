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

async function callOpenAI(params: {
  question: string
  history: { question: string; answer: string }[]
  imageDataUrl?: string
}) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY")
  }

  const messages: any[] = [
    {
      role: "system",
      content: `
You are CHAS, a helpful office teammate for Furlads.

You help workers in the field so they don't need to ring the office.

How to behave:
- Answer the question clearly and practically.
- Keep replies short and useful for someone working on site.
- If a photo is provided, use it to help answer.
- Sound like a normal helpful person in the office.
- Trevor handles higher-risk judgement calls.
- Kelly confirms final quotes.
`
    }
  ]

  // Add previous conversation
  for (const item of params.history.slice(-30)) {
    messages.push({
      role: "user",
      content: item.question
    })

    messages.push({
      role: "assistant",
      content: item.answer
    })
  }

  // Add latest message
  if (params.imageDataUrl) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: params.question },
        {
          type: "image_url",
          image_url: { url: params.imageDataUrl }
        }
      ]
    })
  } else {
    messages.push({
      role: "user",
      content: params.question
    })
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.6
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(err)
  }

  const data = await response.json()

  return data.choices?.[0]?.message?.content || "Sorry, something went wrong."
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

    // Load conversation history
    let history: { question: string; answer: string }[] = []

    try {
      history = await prisma.chasMessage.findMany({
        where: {
          company,
          worker
        },
        orderBy: {
          createdAt: "asc"
        },
        take: 30,
        select: {
          question: true,
          answer: true
        }
      })
    } catch (error) {
      console.error("Failed to load CHAS history", error)
    }

    const answer = await callOpenAI({
      question,
      history,
      imageDataUrl
    })

    // Save message
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
          safetyFlag: false
        }
      })
    } catch (error) {
      console.error("Failed to save CHAS message", error)
    }

    return NextResponse.json({
      ok: true,
      answer
    })
  } catch (error) {
    console.error("CHAS error", error)

    return NextResponse.json(
      {
        ok: false,
        answer: "Something went wrong."
      },
      { status: 200 }
    )
  }
}