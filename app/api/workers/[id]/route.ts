export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

type Ctx = { params: Promise<{ id: string }> };

function s(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}
function b(v: unknown) {
  return typeof v === "boolean" ? v : undefined;
}
function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
}

function withNameAlias<T extends { displayName: string | null }>(w: T) {
  return {
    ...w,
    name: w.displayName ?? "",
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const workerId = Number(id);
    if (!workerId) return NextResponse.json({ error: "Invalid worker id" }, { status: 400 });

    const w = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        company: true,
        key: true,
        displayName: true,
        role: true,
        jobTitle: true,
        photoUrl: true,
        schedulable: true,
        phone: true, // ✅ NEW
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!w) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    return NextResponse.json(withNameAlias(w));
  } catch (err) {
    console.error("GET /api/workers/[id] failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const workerId = Number(id);
    if (!workerId) return NextResponse.json({ error: "Invalid worker id" }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));

    // ✅ Compatibility: UI sends `name`, DB expects `displayName`
    const displayName = s(body.displayName) || s(body.name);

    // ✅ NEW: accept phone (and phoneNumber just in case)
    const phone = s(body.phone) || s(body.phoneNumber);

    const updated = await prisma.worker.update({
      where: { id: workerId },
      data: {
        ...(displayName ? { displayName } : {}),
        ...(s(body.role) ? { role: s(body.role) } : {}),
        ...(s(body.jobTitle) ? { jobTitle: s(body.jobTitle) } : {}),
        ...(s(body.photoUrl) ? { photoUrl: s(body.photoUrl) } : {}),
        ...(phone !== "" ? { phone } : {}), // ✅ NEW (allows clearing to "")
        ...(b(body.schedulable) !== undefined ? { schedulable: b(body.schedulable) } : {}),
        ...(b(body.active) !== undefined ? { active: b(body.active) } : {}),
        ...(s(body.key) ? { key: s(body.key).toLowerCase() } : {}),
        ...(n(body.sortOrder) !== undefined ? { sortOrder: n(body.sortOrder) } : {}),
        // company: only update if explicitly provided
        ...(s(body.company) ? { company: s(body.company) } : {}),
      },
      select: {
        id: true,
        company: true,
        key: true,
        displayName: true,
        role: true,
        jobTitle: true,
        photoUrl: true,
        schedulable: true,
        phone: true, // ✅ NEW
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // ✅ Return `name` too so locked UI doesn’t need changing
    return NextResponse.json(withNameAlias(updated));
  } catch (err) {
    console.error("PATCH /api/workers/[id] failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Some clients use PUT
export async function PUT(req: Request, ctx: Ctx) {
  return PATCH(req, ctx);
}