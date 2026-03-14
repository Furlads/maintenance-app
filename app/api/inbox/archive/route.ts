import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { conversationId } = await req.json()

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "conversationId required" },
        { status: 400 }
      )
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        archived: true,
      },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("ARCHIVE ERROR:", error)

    return NextResponse.json(
      { success: false },
      { status: 500 }
    )
  }
}