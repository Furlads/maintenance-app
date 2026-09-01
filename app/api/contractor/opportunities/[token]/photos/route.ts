import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '-')
}

type Recipient = {
  workerId: number
  status: string
  sourceJobId: number | null
}

async function loadRecipient(token: string) {
  const rows = await prisma.$queryRaw<Recipient[]>`
    SELECT r."workerId", r."status", o."sourceJobId"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "SubcontractorOpportunity" o ON o."id" = r."opportunityId"
    WHERE r."token" = ${token}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const recipient = await loadRecipient(clean(token))
  if (!recipient) return NextResponse.json({ error: 'Opportunity not found.' }, { status: 404 })
  if (recipient.status !== 'accepted') return NextResponse.json({ error: 'Accept the opportunity before uploading completion evidence.' }, { status: 403 })
  if (!recipient.sourceJobId) return NextResponse.json({ error: 'This opportunity is not linked to a live job.' }, { status: 400 })

  const formData = await req.formData()
  const file = formData.get('file')
  const note = clean(formData.get('note'))

  if (!(file instanceof File)) return NextResponse.json({ error: 'Photo file is required.' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Only image uploads are allowed.' }, { status: 400 })

  const fileName = cleanFileName(file.name || 'completion.jpg')
  const pathname = `jobs/${recipient.sourceJobId}/subcontractors/${recipient.workerId}/${Date.now()}-${fileName}`
  const blob = await put(pathname, file, { access: 'public' })

  const photo = await prisma.jobPhoto.create({
    data: {
      jobId: recipient.sourceJobId,
      uploadedByWorkerId: recipient.workerId,
      label: `Subcontractor completion${note ? ` - ${note}` : ''}`,
      imageUrl: blob.url,
    },
  })

  return NextResponse.json({ ok: true, photo }, { status: 201 })
}
