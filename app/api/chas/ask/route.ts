export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

type Body = {
  company: string;
  worker: string;
  question: string;
  imageDataUrl?: string;
  jobId?: number | null;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const company = (body.company || "").trim();
    const worker = (body.worker || "").trim();
    const question = (body.question || "").trim();
    const imageDataUrl = (body.imageDataUrl || "").trim();
    const jobId = body.jobId ?? null;

    if (!company || !worker) {
      return NextResponse.json({ error: "Missing company/worker." }, { status: 400 });
    }
    if (!question) {
      return NextResponse.json({ error: "Missing question." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set in env." }, { status: 500 });
    }

    const history = await prisma.chasMessage.findMany({
      where: {
        company,
        worker,
        createdAt: { gte: startOfToday(), lte: endOfToday() },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const input: any[] = [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              `You are Chas — a fast, practical teammate for a UK grounds maintenance company.\n` +
              `Help on-site with plant ID, hedge cutting, what to do next, customer questions.\n` +
              `Be concise and confident. If unsure, ask ONE question.\n` +
              `If it involves high-risk safety (chainsaws, ladders, electrics), tell them to stop and call Trev/Kelly.\n`,
          },
        ],
      },
    ];

    for (const msg of history) {
      input.push({ role: "user", content: [{ type: "input_text", text: msg.question }] });
      input.push({ role: "assistant", content: [{ type: "output_text", text: msg.answer }] });
    }

    const newTurn: any = {
      role: "user",
      content: [{ type: "input_text", text: question }],
    };

    if (imageDataUrl) {
      newTurn.content.push({ type: "input_image", image_url: imageDataUrl });
    }

    input.push(newTurn);

    const payload = {
      model: "gpt-4.1-mini",
      input,
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await r.text();

    if (!r.ok) {
      console.error("OpenAI failed:", r.status, raw);
      return NextResponse.json(
        {
          error: "OpenAI request failed",
          status: r.status,
          detail: raw,
        },
        { status: 500 }
      );
    }

    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("OpenAI returned non-JSON:", raw);
      return NextResponse.json(
        { error: "OpenAI returned non-JSON", detail: raw },
        { status: 500 }
      );
    }

    const answer =
      data?.output_text ||
      (Array.isArray(data?.output)
        ? data.output
            .flatMap((o: any) => o?.content || [])
            .filter((c: any) => c?.type === "output_text" && typeof c?.text === "string")
            .map((c: any) => c.text)
            .join("\n")
        : "") ||
      "Sorry — I couldn’t generate an answer that time.";

    await prisma.chasMessage.create({
      data: {
        company,
        worker,
        jobId: jobId ?? undefined,
        question,
        answer,
        imageDataUrl: imageDataUrl || "",
      },
    });

    return NextResponse.json({ answer });
  } catch (e: any) {
    console.error("POST /api/chas/ask failed:", e);
    return NextResponse.json(
      { error: "Server error", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}