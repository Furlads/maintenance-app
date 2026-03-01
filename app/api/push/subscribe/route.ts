import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SubscriptionBody = {
  user: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
};

export async function POST(req: NextRequest) {
  let body: SubscriptionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const user = (body?.user || "").trim();
  const endpoint = (body?.subscription?.endpoint || "").trim();
  const p256dh = (body?.subscription?.keys?.p256dh || "").trim();
  const auth = (body?.subscription?.keys?.auth || "").trim();

  if (!user) return NextResponse.json({ error: "Missing user" }, { status: 400 });
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  // Keep endpoint unique; update if it already exists
  const saved = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { user, p256dh, auth },
    create: { user, endpoint, p256dh, auth },
  });

  return NextResponse.json({ ok: true, id: saved.id });
}