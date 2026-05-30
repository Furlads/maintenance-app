export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ActivityLogBody = {
  workerId?: number | null;
  workerName?: string | null;
  jobId?: number | null;
  eventType?: string | null;
  page?: string | null;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
};

function cleanString(value: unknown, maxLength = 500) {
  const text = String(value || "").trim();

  if (!text) return null;

  return text.slice(0, maxLength);
}

function cleanNumber(value: unknown) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) return null;

  return parsed;
}

function safeJson(value: unknown) {
  if (!value || typeof value !== "object") return null;

  try {
    return JSON.stringify(value).slice(0, 5000);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body: ActivityLogBody = await req.json().catch(() => ({}));

    const eventType = cleanString(body.eventType, 120);

    if (!eventType) {
      return NextResponse.json(
        { ok: false, error: "eventType is required" },
        { status: 400 }
      );
    }

    const workerId = cleanNumber(body.workerId);
    const jobId = cleanNumber(body.jobId);

    await prisma.activityLog.create({
      data: {
        workerId,
        workerName: cleanString(body.workerName, 160),
        jobId,
        eventType,
        page: cleanString(body.page, 180),
        details: cleanString(body.details, 1000),
        metadataJson: safeJson(body.metadata),
        userAgent: cleanString(req.headers.get("user-agent"), 500),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/activity-log failed:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to save activity log" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const logs = await prisma.activityLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return NextResponse.json({
      ok: true,
      items: logs,
    });
  } catch (error) {
    console.error("GET /api/activity-log failed:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to load activity logs" },
      { status: 500 }
    );
  }
}