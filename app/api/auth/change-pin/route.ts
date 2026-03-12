import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const workerId = Number(body.workerId)
    const currentPin = String(body.currentPin || '')
    const newPin = String(body.newPin || '')

    if (!workerId || !currentPin || !newPin) {
      return NextResponse.json(
        { error: 'Missing fields.' },
        { status: 400 }
      )
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId }
    })

    if (!worker) {
      return NextResponse.json(
        { error: 'Worker not found.' },
        { status: 404 }
      )
    }

    if (worker.pinHash !== currentPin) {
      return NextResponse.json(
        { error: 'Current PIN is incorrect.' },
        { status: 401 }
      )
    }

    await prisma.worker.update({
      where: { id: workerId },
      data: {
        pinHash: newPin
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Failed to change PIN.' },
      { status: 500 }
    )
  }
}