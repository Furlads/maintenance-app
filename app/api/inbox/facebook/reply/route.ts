import { NextRequest, NextResponse } from "next/server";

const GRAPH_URL = "https://graph.facebook.com/v18.0/me/messages";

function getPageAccessToken(pageId: string) {
  const furladsPageId = process.env.FACEBOOK_PAGE_ID_FURLADS;
  const threeCountiesPageId = process.env.FACEBOOK_PAGE_ID_THREE_COUNTIES;

  if (pageId === furladsPageId) {
    return process.env.FACEBOOK_PAGE_TOKEN_FURLADS || null;
  }

  if (pageId === threeCountiesPageId) {
    return process.env.FACEBOOK_PAGE_TOKEN_THREE_COUNTIES || null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { externalThreadId, messageText } = await req.json();

    if (!externalThreadId || !messageText) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const [pageId, recipientPsid] = String(externalThreadId).split(":");

    if (!pageId || !recipientPsid) {
      return NextResponse.json(
        { error: "Invalid externalThreadId format" },
        { status: 400 }
      );
    }

    const pageAccessToken = getPageAccessToken(pageId);

    if (!pageAccessToken) {
      return NextResponse.json(
        { error: "No page access token found for pageId" },
        { status: 400 }
      );
    }

    const response = await fetch(`${GRAPH_URL}?access_token=${pageAccessToken}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        message: { text: messageText },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Facebook send error:", data);
      return NextResponse.json({ error: data }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Facebook reply error:", error);
    return NextResponse.json({ error: "Reply failed" }, { status: 500 });
  }
}
