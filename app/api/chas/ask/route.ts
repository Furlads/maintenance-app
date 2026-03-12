import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ChasIntent =
  | "general"
  | "plant_id"
  | "pricing_guide"
  | "safety"
  | "quote_support"
  | "escalation";

type ChasEscalateTo = "none" | "kelly" | "trevor";

type ChasModelResponse = {
  answer: string;
  intent: ChasIntent;
  confidence: number;
  escalateTo: ChasEscalateTo;
  safetyFlag: boolean;
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type RequestBody = {
  message?: string;
  messages?: ChatMessage[];
  includeJobContext?: boolean;
  jobContext?: unknown;
};

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stripCodeFences(input: string): string {
  let text = input.trim();

  if (text.startsWith("```json")) {
    text = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  } else if (text.startsWith("```")) {
    text = text.replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  }

  return text.trim();
}

function normaliseAnswer(answer: unknown): string {
  if (typeof answer !== "string") return "";
  return answer.replace(/\s+/g, " ").trim();
}

function buildFallbackResponse(rawText: string): ChasModelResponse {
  const cleaned = stripCodeFences(rawText);

  return {
    answer:
      normaliseAnswer(cleaned) ||
      "I’m not fully sure on that one. It would be best to check with Kelly for pricing or Trevor if there’s any risk involved.",
    intent: "general",
    confidence: 0.35,
    escalateTo: "none",
    safetyFlag: false,
  };
}

function validateParsedResponse(parsed: unknown, rawText: string): ChasModelResponse {
  if (!isObject(parsed)) {
    return buildFallbackResponse(rawText);
  }

  const answer = normaliseAnswer(parsed.answer);
  const intent = typeof parsed.intent === "string" ? parsed.intent : "general";
  const confidence = clampConfidence(parsed.confidence);
  const escalateTo =
    parsed.escalateTo === "kelly" || parsed.escalateTo === "trevor" || parsed.escalateTo === "none"
      ? parsed.escalateTo
      : "none";
  const safetyFlag = typeof parsed.safetyFlag === "boolean" ? parsed.safetyFlag : false;

  return {
    answer:
      answer ||
      "I’m not fully sure on that one. It would be best to check with Kelly for pricing or Trevor if there’s any risk involved.",
    intent: ([
      "general",
      "plant_id",
      "pricing_guide",
      "safety",
      "quote_support",
      "escalation",
    ] as const).includes(intent as ChasIntent)
      ? (intent as ChasIntent)
      : "general",
    confidence,
    escalateTo,
    safetyFlag,
  };
}

function tryParseModelJson(rawText: string): ChasModelResponse {
  const cleaned = stripCodeFences(rawText);

  try {
    const parsed = JSON.parse(cleaned);
    return validateParsedResponse(parsed, rawText);
  } catch {
    // Handle cases where the model returns stringified JSON inside a JSON string
    try {
      const maybeString = JSON.parse(JSON.stringify(cleaned));
      const reparsed = JSON.parse(maybeString);
      return validateParsedResponse(reparsed, rawText);
    } catch {
      return buildFallbackResponse(rawText);
    }
  }
}

function getLatestUserMessage(body: RequestBody): string {
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message.trim();
  }

  if (Array.isArray(body.messages)) {
    const reversed = [...body.messages].reverse();
    const lastUserMessage = reversed.find(
      (msg) => msg.role === "user" && typeof msg.content === "string" && msg.content.trim()
    );
    if (lastUserMessage) return lastUserMessage.content.trim();
  }

  return "";
}

function buildPrompt(userMessage: string, includeJobContext: boolean, jobContext?: unknown): string {
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

You MUST return valid JSON only.
No markdown.
No code fences.
No extra commentary.

Return exactly this shape:
{
  "answer": "string",
  "intent": "general | plant_id | pricing_guide | safety | quote_support | escalation",
  "confidence": 0.0,
  "escalateTo": "none | kelly | trevor",
  "safetyFlag": false
}
`.trim();

  const safetyHints = `
Escalation guidance:
- Use "kelly" for final pricing, quote confirmation, or office follow-up.
- Use "trevor" for higher-risk judgement calls, unclear safety situations, structural concerns, major liability, or anything that should not be guessed.
- Use safetyFlag=true if there is any meaningful safety concern or the user may need to stop and check before continuing.

Answer style:
- Keep "answer" short, useful, and worker-friendly.
- No bullet lists unless genuinely needed.
- Prefer direct next-step guidance.
`.trim();

  if (!includeJobContext) {
    return `${baseRules}\n\n${safetyHints}\n\nUser message:\n${userMessage}`;
  }

  return `${baseRules}\n\n${safetyHints}\n\nincludeJobContext is true.\nYou may use the job context below only if it genuinely helps answer the question.\n\nJob context:\n${JSON.stringify(
    jobContext ?? {},
    null,
    2
  )}\n\nUser message:\n${userMessage}`;
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const model = process.env.CHAS_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const fallbackText =
    Array.isArray(data.output)
      ? data.output
          .flatMap((item: any) => {
            if (!item || !Array.isArray(item.content)) return [];
            return item.content
              .map((content: any) => {
                if (typeof content?.text === "string") return content.text;
                if (typeof content?.output_text === "string") return content.output_text;
                return "";
              })
              .filter(Boolean);
          })
          .join("\n")
          .trim()
      : "";

  if (fallbackText) return fallbackText;

  throw new Error("Model returned no text output");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;

    const userMessage = getLatestUserMessage(body);
    if (!userMessage) {
      return NextResponse.json(
        {
          error: "Message is required.",
        },
        { status: 400 }
      );
    }

    const includeJobContext = body.includeJobContext === true;
    const prompt = buildPrompt(userMessage, includeJobContext, body.jobContext);

    const rawModelText = await callOpenAI(prompt);
    const parsed = tryParseModelJson(rawModelText);

    return NextResponse.json(
      {
        answer: parsed.answer,
        intent: parsed.intent,
        confidence: parsed.confidence,
        escalateTo: parsed.escalateTo,
        safetyFlag: parsed.safetyFlag,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("CHAS ask route error:", error);

    return NextResponse.json(
      {
        answer:
          "I’m having a bit of trouble answering that right now. For anything important, check with Kelly on pricing or Trevor if there’s any risk involved.",
        intent: "general",
        confidence: 0.2,
        escalateTo: "none",
        safetyFlag: false,
      },
      { status: 200 }
    );
  }
}