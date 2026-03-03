import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function toNumberOrNull(v: any) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function safePhotoUrls(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => clean(x)).filter(Boolean).slice(0, 24);
  if (typeof v === "string") {
    const one = clean(v);
    return one ? [one] : [];
  }
  return [];
}

function stamp(author: string, msg: string) {
  const d = new Date().toLocaleString("en-GB");
  const a = (author || "unknown").trim();
  return `[${d}] ${a}: ${msg}`;
}

const ALLOWED_STATUS = new Set(["unscheduled", "todo", "done", "onhold", "cancelled"]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jobId = Number(id);

  if (!jobId || Number.isNaN(jobId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.deletedAt) return NextResponse.json({ error: "Job is deleted" }, { status: 410 });

  const data: any = {};

  // ✅ Status
  const setStatusRaw = clean(body?.setStatus).toLowerCase();
  if (setStatusRaw) {
    if (!ALLOWED_STATUS.has(setStatusRaw)) {
      return NextResponse.json({ error: `Invalid status "${setStatusRaw}"` }, { status: 400 });
    }
    data.status = setStatusRaw;
  }

  // ✅ Editable fields
  if (body?.title !== undefined || body?.customerName !== undefined) {
    const nextTitle = clean(body.title) || clean(body.customerName);
    if (nextTitle) data.title = nextTitle;
  }

  if (body?.overview !== undefined) data.overview = clean(body.overview);
  if (body?.address !== undefined) {
    const a = clean(body.address);
    if (a) data.address = a;
  }
  if (body?.postcodeFull !== undefined) data.postcodeFull = clean(body.postcodeFull);

  // Assignment: update assignedTo AND assignedWorkerId consistently
  if (body?.assignedTo !== undefined) {
    const assignedToKey = clean(body.assignedTo).toLowerCase();
    if (!assignedToKey) {
      data.assignedTo = null;
      data.assignedWorkerId = null;
    } else {
      const worker = await prisma.worker.findFirst({
        where: { company: job.company as any, key: assignedToKey },
        select: { id: true, key: true },
      });

      if (!worker) {
        return NextResponse.json(
          { error: `Assigned worker "${assignedToKey}" not found for company "${job.company}".` },
          { status: 400 }
        );
      }

      data.assignedTo = worker.key;
      data.assignedWorkerId = worker.id;
    }
  }

  // Scheduling
  if (body?.fixed !== undefined) data.fixed = !!body.fixed;

  if (body?.visitDate !== undefined) {
    const vd = clean(body.visitDate);
    data.visitDate = vd ? new Date(vd) : null;
  }

  if (body?.startTime !== undefined) {
    const st = clean(body.startTime);
    data.startTime = st || null;
  }

  if (body?.durationMins !== undefined) {
    const dm = toNumberOrNull(body.durationMins);
    if (typeof dm === "number") data.durationMins = Math.max(15, Math.round(dm));
  }

  // Hard-to-find + W3W
  if (body?.hardToFind !== undefined) data.hardToFind = !!body.hardToFind;
  if (body?.what3wordsLink !== undefined) data.what3wordsLink = clean(body.what3wordsLink);

  // Latitude/Longitude
  if (body?.latitude !== undefined) data.latitude = toNumberOrNull(body.latitude);
  if (body?.longitude !== undefined) data.longitude = toNumberOrNull(body.longitude);

  // ✅ Photos (replace entire array)
  if (body?.photoUrls !== undefined) {
    data.photoUrls = safePhotoUrls(body.photoUrls) as any;
  }

  // ✅ Notes locked: only allow appending to notesLog
  const appendNote = clean(body?.appendNote);
  const noteAuthor = clean(body?.noteAuthor) || "unknown";
  if (appendNote) {
    const line = stamp(noteAuthor, appendNote);
    const next = job.notesLog ? `${job.notesLog}\n${line}` : line;
    data.notesLog = next;
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data,
  });

  return NextResponse.json(updated);
}

// ✅ Soft delete
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jobId = Number(id);

  if (!jobId || Number.isNaN(jobId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.deletedAt) return NextResponse.json({ ok: true });

  await prisma.job.update({
    where: { id: jobId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}