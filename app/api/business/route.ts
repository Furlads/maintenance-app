import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export async function GET() {
  try {
    const business = await prisma.business.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    return NextResponse.json(business);
  } catch (err) {
    console.error("GET /api/business failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const dayStart = typeof body.dayStart === "string" ? body.dayStart.trim() : undefined;
    const dayEnd = typeof body.dayEnd === "string" ? body.dayEnd.trim() : undefined;
    const prepMins =
      Number.isFinite(Number(body.prepMins)) && Number(body.prepMins) >= 0 ? Math.round(Number(body.prepMins)) : undefined;

    const business = await prisma.business.upsert({
      where: { id: 1 },
      update: {
        name,
        dayStart,
        dayEnd,
        prepMins,
      },
      create: {
        id: 1,
        name: name ?? "Furlads",
        dayStart: dayStart ?? "08:00",
        dayEnd: dayEnd ?? "17:00",
        prepMins: prepMins ?? 30,
      },
    });

    return NextResponse.json(business);
  } catch (err) {
    console.error("POST /api/business failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}