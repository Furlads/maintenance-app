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

    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!name) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      )
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone:
          typeof body.phone === 'string' && body.phone.trim()
            ? body.phone.trim()
            : null,
        address:
          typeof body.address === 'string' && body.address.trim()
            ? body.address.trim()
            : null,
        postcode:
          typeof body.postcode === 'string' && body.postcode.trim()
            ? body.postcode.trim().toUpperCase()
            : null
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