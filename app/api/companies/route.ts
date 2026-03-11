import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(companies)
  } catch {
    return NextResponse.json([])
  }
}