import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VERIFY_TOKEN =
  process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "furlads_messenger_verify";

type FacebookPageConfig = {
  pageId: string;
  key: string;
  label: string;
  business: "furlads" | "three_counties";
};

function getFacebookPages(): FacebookPageConfig[] {
  const pages: FacebookPageConfig[] = [];

  const furladsPageId = String(process.env.FACEBOOK_PAGE_ID_FURLADS || "").trim();
  const threeCountiesPageId = String(
    process.env.FACEBOOK_PAGE_ID_THREE_COUNTIES || ""
  ).trim();

  if (furladsPageId) {
    pages.push({
      pageId: furladsPageId,
      key: "facebook_furlads",
      label: "Furlads Facebook",
      business: "furlads",
    });
  }

  if (threeCountiesPageId) {
    pages.push({
      pageId: threeCountiesPageId,
      key: "facebook_threecounties",
      label: "Three Counties Facebook",
      business: "three_counties",
    });
  }

  return pages;
}

function getPageConfig(pageId: string): FacebookPageConfig {
  const pages = getFacebookPages();
  const found = pages.find((page) => page.pageId === pageId);

  if (found) return found;

  return {
    pageId,
    key: "facebook_unknown",
    label: "Facebook",
    business: "furlads",
  };
}

function makeConversationRef(pageId: string, senderPsid: string) {
  return `${pageId}:${senderPsid}`;
}

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
    const payload = await req.json();

    console.log("FACEBOOK WEBHOOK PAYLOAD:", JSON.stringify(payload, null, 2));

    if (payload.object !== "page") {
      return NextResponse.json({ ignored: true });
    }

    for (const entry of payload.entry || []) {
      const pageId = String(entry?.id || "").trim();
      const pageConfig = getPageConfig(pageId);

      for (const event of entry.messaging || []) {
        const senderPsid = String(event?.sender?.id || "").trim();
        const messageId = String(event?.message?.mid || "").trim();
        const messageText = String(event?.message?.text || "").trim();

        if (!pageId || !senderPsid || !messageId) {
          console.log("FACEBOOK WEBHOOK SKIP:", {
            reason: "missing_page_or_sender_or_message_id",
            pageId,
            senderPsid,
            messageId,
          });
          continue;
        }

        const existingMessage = await prisma.inboxMessage.findFirst({
          where: {
            externalMessageId: messageId,
          },
          select: {
            id: true,
          },
        });

        if (existingMessage) {
          console.log("FACEBOOK WEBHOOK DUPLICATE SKIP:", {
            messageId,
            pageId,
          });
          continue;
        }

        const conversationRef = makeConversationRef(pageId, senderPsid);

        let conversation = await prisma.conversation.findFirst({
          where: {
            source: "facebook",
            contactRef: conversationRef,
          },
          select: {
            id: true,
          },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              source: "facebook",
              contactName: pageConfig.label,
              contactRef: conversationRef,
              archived: false,
            },
            select: {
              id: true,
            },
          });

          console.log("FACEBOOK CONVERSATION CREATED:", {
            conversationId: conversation.id,
            pageId,
            pageKey: pageConfig.key,
            business: pageConfig.business,
            contactRef: conversationRef,
          });
        }

        const body =
          messageText && messageText.length > 0
            ? messageText
            : "[Facebook message with no text]";

        await prisma.inboxMessage.create({
          data: {
            source: "facebook",
            senderName: pageConfig.label,
            senderPhone: senderPsid,
            senderEmail: null,
            preview: body.slice(0, 120),
            body,
            status: "unread",
            conversationId: conversation.id,
            externalMessageId: messageId,
          },
        });

        console.log("FACEBOOK MESSAGE SAVED:", {
          pageId,
          pageKey: pageConfig.key,
          business: pageConfig.business,
          messageId,
          conversationId: conversation.id,
          senderPsid,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("FACEBOOK WEBHOOK ERROR:", error);
    return new NextResponse("Server error", { status: 500 });
  }
}