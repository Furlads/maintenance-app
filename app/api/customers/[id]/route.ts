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

export async function PUT(
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

    const body = await request.json()

    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!name) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      )
    }

    const existingCustomer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        name,
        phone:
          typeof body.phone === 'string' && body.phone.trim()
            ? body.phone.trim()
            : null,
        email:
          typeof body.email === 'string' && body.email.trim()
            ? body.email.trim()
            : null,
        address:
          typeof body.address === 'string' && body.address.trim()
            ? body.address.trim()
            : null,
        postcode:
          typeof body.postcode === 'string' && body.postcode.trim()
            ? body.postcode.trim().toUpperCase()
            : null,
        notes:
          typeof body.notes === 'string' && body.notes.trim()
            ? body.notes.trim()
            : null
      }
    })

    return NextResponse.json(updatedCustomer)
  } catch (error) {
    console.error('PUT /api/customers/[id] error:', error)

    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

export async function POST(
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

    const body = await request.json()
    const action = body?.action

    if (action !== 'archive' && action !== 'restore') {
      return NextResponse.json(
        { error: 'Invalid action' },
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

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        archived: action === 'archive'
      }
    })

    return NextResponse.json(updatedCustomer)
  } catch (error) {
    console.error('POST /api/customers/[id] error:', error)

    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
      where: { id: customerId },
      include: {
        jobs: {
          select: { id: true }
        },
        inboxMessages: {
          select: { id: true }
        }
      }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    if (customer.jobs.length > 0 || customer.inboxMessages.length > 0) {
      return NextResponse.json(
        {
          error:
            'This customer has linked jobs or inbox messages and cannot be deleted. Archive them instead.'
        },
        { status: 400 }
      )
    }

    await prisma.customer.delete({
      where: { id: customerId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/customers/[id] error:', error)

    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}