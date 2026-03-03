export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const company = (url.searchParams.get("company") || "").trim();
    const worker = (url.searchParams.get("worker") || "").trim();

    if (!company || !worker) {
      return NextResponse.json({ error: "Missing company/worker." }, { status: 400 });
    }

    const items = await prisma.chasMessage.findMany({
      where: {
        company,
        worker,
        createdAt: { gte: startOfToday(), lte: endOfToday() },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return NextResponse.json(items);
  } catch (e: any) {
    console.error("GET /api/chas/thread failed:", e);
    return NextResponse.json(
      { error: "Server error", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}