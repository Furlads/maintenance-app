import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(customers)
}

export async function POST(request: Request) {
  const body = await request.json()

  const customer = await prisma.customer.create({
    data: {
      name: body.name,
      phone: body.phone,
      address: body.address
    }
  })

  return NextResponse.json(customer)
}