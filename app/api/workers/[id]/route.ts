import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Missing worker id in URL' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))

    // ARCHIVE
    if (body.archive === true) {
      const worker = await prisma.worker.update({
        where: { id },
        data: { archivedAt: new Date() },
      })
      return NextResponse.json({ worker })
    }

    // RESTORE
    if (body.restore === true) {
      const worker = await prisma.worker.update({
        where: { id },
        data: { archivedAt: null },
      })
      return NextResponse.json({ worker })
    }

    return NextResponse.json(
      { error: 'Nothing to update. Send { "archive": true } or { "restore": true }' },
      { status: 400 }
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Server error archiving/restoring worker' },
      { status: 500 }
    )
  }
}