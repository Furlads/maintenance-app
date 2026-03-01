import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, ReminderType } from "@prisma/client";
import webpush from "web-push";

const prisma = new PrismaClient();

function mustHaveCronSecret(req: NextRequest) {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;
  const got = req.headers.get("x-cron-secret") || "";
  return got === expected;
}

function initWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@furlads.com";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID keys");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function POST(req: NextRequest) {
  // Lock down so randoms can't spam your team
  if (!mustHaveCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    initWebPush();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "VAPID not configured" }, { status: 500 });
  }

  const now = new Date();

  // Fetch due reminders (small batch)
  const due = await prisma.reminder.findMany({
    where: {
      type: ReminderType.ARRIVAL_CHECK,
      dueAt: { lte: now },
      sentAt: null,
      clearedAt: null,
    },
    take: 50,
    orderBy: { dueAt: "asc" },
  });

  let sent = 0;
  let skippedArrived = 0;
  let noSub = 0;
  let cleanedDead = 0;

  for (const r of due) {
    const job = await prisma.job.findUnique({ where: { id: r.jobId } });
    if (!job) {
      await prisma.reminder.update({ where: { id: r.id }, data: { clearedAt: now } });
      continue;
    }

    // If they've already arrived, clear reminder
    if (job.arrivedAt) {
      skippedArrived++;
      await prisma.reminder.update({ where: { id: r.id }, data: { clearedAt: now } });
      continue;
    }

    // Find subscription for assignedTo
    const subs = await prisma.pushSubscription.findMany({
      where: { user: r.assignedTo },
      take: 5,
      orderBy: { updatedAt: "desc" },
    });

    if (subs.length === 0) {
      noSub++;
      // Mark as sent so it doesn't loop forever
      await prisma.reminder.update({ where: { id: r.id }, data: { sentAt: now } });
      continue;
    }

    const payload = JSON.stringify({
      title: "Furlads check-in",
      body: "Just checking you’re all good 👍 When you arrive, tap “I’m here” so Kelly’s report stays accurate.",
      data: { url: "/today" },
    });

    let deliveredToSomeone = false;

    for (const s of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          payload
        );
        deliveredToSomeone = true;
      } catch (err: any) {
        // If subscription is gone/invalid, remove it
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          cleanedDead++;
          await prisma.pushSubscription.delete({ where: { endpoint: s.endpoint } }).catch(() => {});
        }
      }
    }

    await prisma.reminder.update({ where: { id: r.id }, data: { sentAt: now } });

    if (deliveredToSomeone) sent++;
  }

  return NextResponse.json({
    ok: true,
    processed: due.length,
    sent,
    skippedArrived,
    noSub,
    cleanedDead,
  });
}