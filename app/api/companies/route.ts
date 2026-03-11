export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export async function GET() {
  try {
    const workers = await prisma.worker.findMany({
      where: { active: true },
      select: { company: true },
      orderBy: { company: "asc" },
    });

    const seen = new Set<string>();
    const companies: { id: number; name: string }[] = [];

    for (const worker of workers) {
      const name = (worker.company ?? "").trim();
      if (!name) continue;
      if (seen.has(name.toLowerCase())) continue;

      seen.add(name.toLowerCase());
      companies.push({
        id: companies.length + 1,
        name,
      });
    }

    return NextResponse.json(companies);
  } catch (err: any) {
    console.error("GET /api/companies failed:", err);

    return NextResponse.json(
      {
        error: "Failed to load companies",
        message: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}