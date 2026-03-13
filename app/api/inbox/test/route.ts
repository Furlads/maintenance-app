import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST() {

  const message = await prisma.inboxMessage.create({
    data: {
      source: "threecounties-email",
      senderName: "Test Customer",
      senderEmail: "test@example.com",
      subject: "Inbox Test",
      preview: "Inbox system working correctly",
      body: "This is a test message created from the API route."
    }
  })

  return NextResponse.json({
    success: true,
    message
  })
}