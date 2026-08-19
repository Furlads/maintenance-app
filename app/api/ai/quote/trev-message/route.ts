import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RequestBody = {
  customerName?: string
  scope?: string
  priceExVat?: number
  vatRate?: number
  depositPercent?: number
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function extractJson(value: string) {
  const trimmed = value.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('The AI did not return valid JSON.')
    }

    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))
  }
}

function messageNeedsRewrite(value: unknown) {
  const text = cleanText(value)
  const lower = text.toLowerCase()

  return (
    !text ||
    lower.includes('kelly') ||
    lower.includes('cost breakdown') ||
    lower.includes('cost (ex. vat)') ||
    (!lower.includes('trev') && !lower.includes('trevor')) ||
    !lower.includes('furlads')
  )
}

async function generateMessage({
  customerName,
  scope,
  priceExVat,
  vatRate,
  vatAmount,
  totalIncVat,
  depositPercent,
  depositAmount,
  correction = false,
}: {
  customerName: string
  scope: string
  priceExVat: number
  vatRate: number
  vatAmount: number
  totalIncVat: number
  depositPercent: number
  depositAmount: number
  correction?: boolean
}) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY has not been added to the app environment variables.')
  }

  const openai = new OpenAI({ apiKey })

  const instructions = `
You write customer-facing landscaping quotation messages for Furlads.

This version is specifically written by Trev AFTER he has personally been out to see the customer and their garden. It is used when Trev is handling the customer directly rather than Kelly.

VOICE:
- Write as Trev in the first person.
- Warm, friendly, enthusiastic and down-to-earth.
- It should feel personal because Trev has actually visited the property, seen the space and discussed the job with the customer.
- Open naturally by thanking them for their time when Trev came out, or saying it was good to meet them and see the garden.
- Refer naturally to what was discussed or what Trev saw, but do not invent details beyond the supplied scope.
- Help the customer picture the finished result and feel excited about the improvement.
- Sound like a trusted local landscaper following up after a visit, not an office template or formal tender.
- Use 2–4 suitable emojis across the whole message.
- Keep it easy to read on WhatsApp with short paragraphs and friendly headings.
- It should feel noticeably different from a Kelly office-follow-up message.

CUSTOMER NAME:
- Use the customer's friendly first name when clearly available.
- If supplied as something like “Mr Trevor A Fudger”, use “Trevor”.
- Do not use a stiff title/surname greeting when a clear first name is available.

STRUCTURE:
1. Friendly personal greeting.
2. Brief line about having been out to see them / the garden and enjoying talking the project through.
3. Exciting description of what the finished work should do for the space.
4. “✨ What we talked through” or similar, with clear tick-point scope.
5. A calm quick note for any provisional assumptions that genuinely appear in the supplied scope.
6. “💷 Your project price” with Price, VAT and Total.
7. Explain the deposit simply as the next step if they want to go ahead.
8. Invite them to reply directly to Trev with questions, changes or approval.
9. Sign off warmly from “Trev” and “Furlads”.

COMMERCIAL RULES:
- Keep the supplied figures exact.
- VAT is ${vatRate}%.
- Do not expose internal margins, hard costs, rate-card workings or estimator language.
- For a straightforward single quote, do not give a line-by-line calculation such as square metres × rate unless the customer genuinely needs it to understand separate work items.
- Do not lead with money.
- Do not use “Cost breakdown” or make the message feel like an invoice.
- Do not claim a diary space is reserved.
- Do not invent guarantees, materials, scope or timescales.
- Do not mention Kelly in this Trev version.

${correction ? 'QUALITY CORRECTION: The first draft failed the Trev style. Rewrite it completely and obey every rule above, especially the personal post-site-visit opening, Trev sign-off, no Kelly, and no invoice-style cost breakdown.' : ''}

Return only valid JSON:
{
  "whatsappQuote": "Complete customer-ready WhatsApp message from Trev"
}
`.trim()

  const prompt = `
Customer name:
${customerName || 'Customer'}

Confirmed scope:
${scope}

Price excluding VAT: £${priceExVat.toFixed(2)}
VAT (${vatRate}%): £${vatAmount.toFixed(2)}
Total including VAT: £${totalIncVat.toFixed(2)}
Deposit (${depositPercent}%): £${depositAmount.toFixed(2)}

Write the finished post-site-visit Furlads quotation message from Trev.
`.trim()

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions,
    input: prompt,
  })

  if (!response.output_text?.trim()) {
    throw new Error('The AI returned an empty response.')
  }

  return extractJson(response.output_text)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody
    const customerName = cleanText(body.customerName)
    const scope = cleanText(body.scope)
    const priceExVat = cleanNumber(body.priceExVat)
    const vatRate = 20
    const depositPercent = cleanNumber(body.depositPercent, 25)

    if (!scope) {
      return NextResponse.json({ error: 'The quote needs a scope before it can be rewritten.' }, { status: 400 })
    }

    if (priceExVat <= 0) {
      return NextResponse.json({ error: 'The quote needs a valid price before it can be rewritten.' }, { status: 400 })
    }

    const vatAmount = Number(((priceExVat * vatRate) / 100).toFixed(2))
    const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))
    const depositAmount = Number(((totalIncVat * depositPercent) / 100).toFixed(2))

    let result = await generateMessage({
      customerName,
      scope,
      priceExVat,
      vatRate,
      vatAmount,
      totalIncVat,
      depositPercent,
      depositAmount,
    })

    if (messageNeedsRewrite(result.whatsappQuote)) {
      result = await generateMessage({
        customerName,
        scope,
        priceExVat,
        vatRate,
        vatAmount,
        totalIncVat,
        depositPercent,
        depositAmount,
        correction: true,
      })
    }

    if (messageNeedsRewrite(result.whatsappQuote)) {
      throw new Error('The regenerated draft still did not meet the Trev quote style. Please try again.')
    }

    return NextResponse.json({
      whatsappQuote: cleanText(result.whatsappQuote),
      priceExVat,
      vatRate,
      vatAmount,
      totalIncVat,
      depositPercent,
      depositAmount,
    })
  } catch (error) {
    console.error('Trev quote message error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not regenerate the Trev customer message.',
      },
      { status: 500 }
    )
  }
}
