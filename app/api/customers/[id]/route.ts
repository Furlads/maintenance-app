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