export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

function cleanString(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function asBoolOrUndef(v: unknown) {
  return typeof v === "boolean" ? v : undefined;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const workerId = Number(id);
    if (!Number.isFinite(workerId)) {
      return NextResponse.json({ error: "Invalid worker id" }, { status: 400 });
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        company: true,
        key: true,
        name: true,
        role: true,
        jobTitle: true,
        photoUrl: true,
        schedulable: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    return NextResponse.json(worker);
  } catch (err) {
    console.error("GET /api/workers/[id] failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const workerId = Number(id);
    if (!Number.isFinite(workerId)) {
      return NextResponse.json({ error: "Invalid worker id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    // Build data object WITHOUT undefined keys
    const data: any = {};

    if (typeof body.name === "string") data.name = cleanString(body.name);
    if (typeof body.role === "string") data.role = cleanString(body.role);
    if (typeof body.jobTitle === "string") data.jobTitle = cleanString(body.jobTitle);
    if (typeof body.photoUrl === "string") data.photoUrl = cleanString(body.photoUrl);

    const active = asBoolOrUndef(body.active);
    if (active !== undefined) data.active = active;

    const schedulable = asBoolOrUndef(body.schedulable);
    if (schedulable !== undefined) data.schedulable = schedulable;

    const updated = await prisma.worker.update({
      where: { id: workerId },
      data,
      select: {
        id: true,
        company: true,
        key: true,
        name: true,
        role: true,
        jobTitle: true,
        photoUrl: true,
        schedulable: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/workers/[id] failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}