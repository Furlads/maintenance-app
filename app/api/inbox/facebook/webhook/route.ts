import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VERIFY_TOKEN =
  process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "furlads_messenger_verify";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Verification failed", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.object !== "page") {
      return NextResponse.json({ ignored: true });
    }

    for (const entry of body.entry) {
      const pageId = entry.id;

      for (const event of entry.messaging || []) {
        if (!event.message) continue;

        const senderPsid = event.sender?.id;
        const messageId = event.message?.mid;
        const messageText = event.message?.text || "";

        if (!senderPsid || !messageId) continue;

        const threadId = `${pageId}:${senderPsid}`;

        await prisma.inboxMessage.upsert({
          where: {
            externalMessageId: messageId,
          },
          update: {},
          create: {
            source: "facebook",
            externalMessageId: messageId,
            externalThreadId: threadId,
            sender: senderPsid,
            body: messageText,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Facebook webhook error:", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
