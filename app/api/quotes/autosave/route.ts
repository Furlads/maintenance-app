import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readSurveyPhotos(req: NextRequest) {
  return req.cookies
    .getAll()
    .filter((cookie) => cookie.name.startsWith('chas_quote_photo_'))
    .map((cookie) => {
      try {
        const decoded = Buffer.from(cookie.value, 'base64url').toString('utf8')
        const parsed = JSON.parse(decoded)
        const url = text(parsed?.url)
        const fileName = text(parsed?.fileName) || 'Site photo'
        return url.startsWith('https://') ? { url, fileName } : null
      } catch {
        return null
      }
    })
    .filter((photo): photo is { url: string; fileName: string } => photo !== null)
}

function mergePhotoWorking(existingWorking: string, req: NextRequest) {
  const photos = readSurveyPhotos(req)
  if (!photos.length) return existingWorking || null

  let parsed: Record<string, unknown> = {}
  try {
    parsed = existingWorking ? JSON.parse(existingWorking) : {}
  } catch {
    parsed = { legacyWorking: existingWorking }
  }

  const existingPhotos = Array.isArray(parsed.surveyPhotos)
    ? parsed.surveyPhotos
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const row = item as Record<string, unknown>
          const url = text(row.url)
          const fileName = text(row.fileName) || 'Site photo'
          return url.startsWith('https://') ? { url, fileName } : null
        })
        .filter((photo): photo is { url: string; fileName: string } => photo !== null)
    : []

  const byUrl = new Map<string, { url: string; fileName: string }>()
  for (const photo of [...existingPhotos, ...photos]) byUrl.set(photo.url, photo)

  parsed.surveyPhotos = Array.from(byUrl.values()).slice(0, 12)
  return JSON.stringify(parsed)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const conversationId = text(body.conversationId)
    const customerName = text(body.customerName)
    const customerPostcode = text(body.customerPostcode)
    const scope =
      text(body.scope) ||
      (customerName ? `Quote in progress for ${customerName}` : 'Quote in progress')

    if (!conversationId || !customerName) {
      return NextResponse.json(
        { ok: false, error: 'Draft key and customer are required.' },
        { status: 400 }
      )
    }

    let customer = null
    const customerId = Number(body.customerId)

    if (Number.isInteger(customerId) && customerId > 0) {
      customer = await prisma.customer.findUnique({ where: { id: customerId } })
    }

    if (!customer && customerPostcode) {
      customer = await prisma.customer.findFirst({
        where: {
          archived: false,
          name: customerName,
          postcode: customerPostcode,
        },
        orderBy: { createdAt: 'desc' },
      })
    }

    await prisma.conversation.upsert({
      where: { id: conversationId },
      update: {
        contactName: customerName,
        contactRef: customerPostcode || customer?.postcode || null,
        archived: false,
      },
      create: {
        id: conversationId,
        source: 'chas_quote_draft',
        contactName: customerName,
        contactRef: customerPostcode || customer?.postcode || null,
        archived: false,
      },
    })

    const existing = await prisma.quote.findFirst({
      where: {
        conversationId,
        status: 'in_progress',
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    })

    const quoteWorking = mergePhotoWorking(
      text(body.quoteWorking) || text(existing?.quoteWorking),
      req
    )

    const data = {
      customerId: customer?.id ?? null,
      conversationId,
      customerName: customerName || customer?.name || null,
      customerPhone: text(body.customerPhone) || customer?.phone || null,
      customerEmail: text(body.customerEmail) || customer?.email || null,
      customerAddress: text(body.customerAddress) || customer?.address || null,
      customerPostcode: customerPostcode || customer?.postcode || null,
      scope,
      quoteWorking,
      status: 'in_progress',
      archivedAt: null,
    }

    const quote = existing
      ? await prisma.quote.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.quote.create({
          data: {
            ...data,
            priceExVat: 0,
            vatRate: 20,
            vatAmount: 0,
            totalIncVat: 0,
            depositPercent: 25,
            depositAmount: 0,
          },
        })

    const response = NextResponse.json({ ok: true, quote })
    for (const cookie of req.cookies.getAll()) {
      if (cookie.name.startsWith('chas_quote_photo_')) {
        response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 })
      }
    }
    return response
  } catch (error) {
    console.error('QUOTE AUTOSAVE ERROR', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'Could not autosave quote.',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
