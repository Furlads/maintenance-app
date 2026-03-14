import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildContactKey } from "@/lib/inbox/contactKey"

export async function POST(req: Request) {
  try {
    const data = await req.json()

    const message = await prisma.chasMessage.create({
      data: {
        company: data.company,
        worker: data.worker,
        sessionId: data.sessionId,
        jobId: data.jobId,
        question: data.question,
        answer: data.answer,
        imageDataUrl: data.imageDataUrl,
        responseId: data.responseId,
        conversationId: data.conversationId,
        intent: data.intent,
        confidence: data.confidence,
        escalateTo: data.escalateTo,
        safetyFlag: data.safetyFlag ?? false,

        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        customerAddress: data.customerAddress,
        customerPostcode: data.customerPostcode,

        workSummary: data.workSummary,
        estimatedHours: data.estimatedHours,
        roughPriceText: data.roughPriceText,
        enquirySummary: data.enquirySummary,
        enquiryReadyForKelly: data.enquiryReadyForKelly ?? false,
      },
    })

    if (message.enquiryReadyForKelly) {
      const contactKey = buildContactKey({
        senderPhone: message.customerPhone,
        senderEmail: message.customerEmail,
        contactRef: message.customerName,
        conversationId: message.conversationId,
      })

      let conversation = null

      if (contactKey) {
        conversation = await prisma.conversation.findFirst({
          where: {
            source: "worker-quote",
            contactRef: contactKey,
          },
          orderBy: {
            createdAt: "desc",
          },
        })
      }

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            source: "worker-quote",
            contactName: message.customerName ?? message.worker ?? "Unknown customer",
            contactRef:
              contactKey ??
              message.customerEmail ??
              message.customerPhone ??
              message.customerName ??
              message.conversationId ??
              `worker-quote-${message.id}`,
          },
        })
      }

      await prisma.inboxMessage.create({
        data: {
          conversation: {
            connect: {
              id: conversation.id,
            },
          },
          source: "worker-quote",
          senderName: message.customerName ?? message.worker,
          senderEmail: message.customerEmail ?? undefined,
          senderPhone: message.customerPhone ?? undefined,
          subject: message.customerName ?? "Worker Quote Request",
          preview: message.enquirySummary ?? message.workSummary ?? "",
          body: message.workSummary ?? "",
          status: "unread",
          assignedTo: "Kelly",
        },
      })
    }

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    console.error("CHAS API ERROR:", error)

    return NextResponse.json(
      {
        success: false,
      },
      { status: 500 }
    )
  }
}