export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

function toInt(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = toInt(searchParams.get("companyId"));
    const q = (searchParams.get("q") || "").trim();

    const staff = await prisma.staff.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        active: true,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, companyId: true },
    });

    return NextResponse.json(staff);
  } catch (err: any) {
    console.error("GET /api/staff failed:", err);
    return NextResponse.json(
      { error: "Failed to load staff", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}