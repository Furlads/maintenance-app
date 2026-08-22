import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function DELETE() {
  try {
    const session = await getSession()
    if (!session?.workerId) {
      return NextResponse.json(
        { ok: false, error: 'You must be signed in.' },
        { status: 401 }
      )
    }

    const result = await prisma.quote.deleteMany({
      where: {
        status: 'archived',
      },
    })

    return NextResponse.json({ ok: true, deleted: result.count })
  } catch (error) {
    console.error('CLEAR QUOTE ARCHIVE ERROR', error)
    return NextResponse.json(
      { ok: false, error: 'Could not clear the quote archive.' },
      { status: 500 }
    )
  }
}
