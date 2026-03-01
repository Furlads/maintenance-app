import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
export const runtime = 'nodejs'

export async function GET() {
  try {
    const workers = await prisma.worker.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ workers })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to load archived workers' },
      { status: 500 }
    )
  }
}