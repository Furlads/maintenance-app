import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "furlads_messenger_verify";

/**
 * GET
 * Used by Meta to verify the webhook when you click "Verify and Save"
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Facebook webhook verified");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Verification failed", { status: 403 });
}

/**
 * POST
 * Receives messages sent to your Facebook pages
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("Facebook webhook payload:", JSON.stringify(body, null, 2));

    if (body.object === "page") {
      for (const entry of body.entry) {
        const pageId = entry.id;

        for (const event of entry.messaging || []) {
          if (!event.message) continue;

          const senderPsid = event.sender?.id;
          const messageId = event.message?.mid;
          const messageText = event.message?.text || "";

          const threadId = `${pageId}:${senderPsid}`;

          // For now we just log the message.
          // Later we will insert it into InboxMessage via Prisma.

          console.log("Messenger message received:", {
            source: "facebook",
            externalMessageId: messageId,
            externalThreadId: threadId,
            sender: senderPsid,
            body: messageText,
          });
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Facebook webhook error:", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
