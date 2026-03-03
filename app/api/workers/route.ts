import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export async function GET() {
  try {
    const workers = await prisma.worker.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return NextResponse.json(workers);
  } catch (err) {
    console.error("GET /api/workers failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Accept either single worker or array
    const items = Array.isArray(body) ? body : [body];

    for (const w of items) {
      const key = typeof w.key === "string" ? w.key.trim().toLowerCase() : "";
      const displayName = typeof w.displayName === "string" ? w.displayName.trim() : "";
      const active = typeof w.active === "boolean" ? w.active : true;
      const sortOrder = Number.isFinite(Number(w.sortOrder)) ? Number(w.sortOrder) : 0;

      if (!key || !displayName) continue;

      await prisma.worker.upsert({
        where: { key },
        update: { displayName, active, sortOrder },
        create: { key, displayName, active, sortOrder },
      });
    }

    const workers = await prisma.worker.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });

    return NextResponse.json(workers);
  } catch (err) {
    console.error("POST /api/workers failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}