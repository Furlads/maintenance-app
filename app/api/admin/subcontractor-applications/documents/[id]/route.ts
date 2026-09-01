import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }
function clean(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function isAdmin(role?: string | null) { return ['admin', 'office', 'manager', 'owner'].includes(clean(role).toLowerCase()) }

export async function GET(_: Request, ctx: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  if (!isAdmin(session.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id: rawId } = await ctx.params
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid document.' }, { status: 400 })

  const rows = await prisma.$queryRaw<Array<{ documentUrl: string; documentName: string; contentType: string | null }>>`
    SELECT "documentUrl", "documentName", "contentType"
    FROM "SubcontractorApplicationDocument"
    WHERE "id"=${id}
    LIMIT 1
  `
  const doc = rows[0]
  if (!doc) return NextResponse.json({ error: 'Document not found.' }, { status: 404 })

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return NextResponse.json({ error: 'Private document access is not configured.' }, { status: 500 })

  const response = await fetch(doc.documentUrl, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok || !response.body) return NextResponse.json({ error: 'Could not retrieve document.' }, { status: 502 })

  return new Response(response.body, {
    headers: {
      'Content-Type': doc.contentType || response.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${doc.documentName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
