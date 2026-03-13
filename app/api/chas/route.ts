import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
        enquiryReadyForKelly: data.enquiryReadyForKelly ?? false
      }
    })

    // 🔹 AUTOMATIC INBOX CREATION
    if (message.enquiryReadyForKelly) {

      await prisma.inboxMessage.create({
        data: {
          source: "worker-quote",
          senderName: message.worker,
          subject: message.customerName ?? "Worker Quote Request",
          preview: message.enquirySummary ?? message.workSummary ?? "",
          body: message.workSummary ?? "",
          status: "unread",
          assignedTo: "Kelly"
        }
      })

    }

    return NextResponse.json({
      success: true,
      message
    })

  } catch (error) {

    console.error("CHAS API ERROR:", error)

    return NextResponse.json({
      success: false
    }, { status: 500 })

  }

}