import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = Number(params.id)

    if (!customerId) {
      return NextResponse.json(
        { error: 'Invalid customer id' },
        { status: 400 }
      )
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error('GET /api/customers/[id] error:', error)

    return NextResponse.json(
      { error: 'Failed to load customer' },
      { status: 500 }
    )
  }
}