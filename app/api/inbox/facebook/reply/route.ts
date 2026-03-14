import { NextRequest, NextResponse } from "next/server";

const GRAPH_URL = "https://graph.facebook.com/v18.0/me/messages";

export async function POST(req: NextRequest) {
  try {
    const { recipientPsid, messageText, pageAccessToken } = await req.json();

    if (!recipientPsid || !messageText || !pageAccessToken) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
