import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { inboxMessageId } = body

    if (!inboxMessageId) {
      return NextResponse.json(
        { error: "Missing inboxMessageId" },
        { status: 400 }
      )
    }

    const message = await prisma.inboxMessage.findUnique({
      where: { id: inboxMessageId }
    })

    if (!message) {
      return NextResponse.json(
        { error: "Inbox message not found" },
        { status: 404 }
      )
    }

    const customer = await prisma.customer.create({
      data: {
        name: message.senderName || "Unknown Customer",
        email: message.senderEmail || undefined,
        notes: message.body || undefined
      }
    })

    await prisma.inboxMessage.update({
      where: { id: inboxMessageId },
      data: {
        customerId: customer.id,
        status: "customer_created"
      }
    })

    return NextResponse.json({
      success: true,
      customer
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    )
  }
}