import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function normaliseText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

function normalisePostcode(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, '').trim().toUpperCase()
}

function normalisePhone(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.replace(/\D/g, '')
}

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      where: {
        archived: false
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(customers, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      }
    })
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
    const phone =
      typeof body.phone === 'string' && body.phone.trim()
        ? body.phone.trim()
        : null
    const email =
      typeof body.email === 'string' && body.email.trim()
        ? body.email.trim()
        : null
    const address =
      typeof body.address === 'string' && body.address.trim()
        ? body.address.trim()
        : null
    const postcode =
      typeof body.postcode === 'string' && body.postcode.trim()
        ? body.postcode.trim().toUpperCase()
        : null
    const notes =
      typeof body.notes === 'string' && body.notes.trim()
        ? body.notes.trim()
        : null
    const forceCreate = body.forceCreate === true

    if (!name) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      )
    }

    const incomingName = normaliseText(name)
    const incomingEmail = normaliseText(email)
    const incomingPhone = normalisePhone(phone)
    const incomingAddress = normaliseText(address)
    const incomingPostcode = normalisePostcode(postcode)

    const existingCustomers = await prisma.customer.findMany({
      where: {
        archived: false
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        postcode: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const duplicates = existingCustomers.filter((customer) => {
      const existingName = normaliseText(customer.name)
      const existingEmail = normaliseText(customer.email)
      const existingPhone = normalisePhone(customer.phone)
      const existingAddress = normaliseText(customer.address)
      const existingPostcode = normalisePostcode(customer.postcode)

      const sameEmail =
        incomingEmail && existingEmail && incomingEmail === existingEmail

      const samePhone =
        incomingPhone && existingPhone && incomingPhone === existingPhone

      const sameNameAndPostcode =
        incomingName &&
        existingName &&
        incomingPostcode &&
        existingPostcode &&
        incomingName === existingName &&
        incomingPostcode === existingPostcode

      const sameAddressAndPostcode =
        incomingAddress &&
        existingAddress &&
        incomingPostcode &&
        existingPostcode &&
        incomingAddress === existingAddress &&
        incomingPostcode === existingPostcode

      return Boolean(
        sameEmail || samePhone || sameNameAndPostcode || sameAddressAndPostcode
      )
    })

    if (duplicates.length > 0 && !forceCreate) {
      return NextResponse.json(
        {
          error: 'Possible duplicate customer found',
          requiresConfirmation: true,
          duplicates
        },
        { status: 409 }
      )
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        email,
        address,
        postcode,
        notes,
        archived: false
      }
    })

    return NextResponse.json(customer, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      }
    })
  } catch (error) {
    console.error('POST /api/customers error:', error)

    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}