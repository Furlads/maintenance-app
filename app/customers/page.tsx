import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error('GET /api/customers error:', error)

    return NextResponse.json(
      { error: 'Failed to load customers' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        phone: body.phone ?? null,
        address: body.address ?? null,
        postcode: body.postcode ?? null
      }
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error('POST /api/customers error:', error)

    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}