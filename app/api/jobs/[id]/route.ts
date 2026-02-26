export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

type Ctx = { params: Promise<{ id: string }> };

function nowGB() {
  return new Date().toLocaleString("en-GB");
}

function clean(s: unknown) {
  return typeof s === "string" ? s.trim() : "";
}

function isValidISODateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidHHMM(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function outwardPostcode(address: string) {
  const upper = (address || "").toUpperCase();
  const match = upper.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/);
  if (!match) return "";
  return match[1];
}

function addWeeks(d: Date, weeks: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + weeks * 7);
  return x;
}

function adjustToDOWOnOrAfter(d: Date, dow: number) {
  // dow: 0=Sun ... 6=Sat
  const x = new Date(d);
  for (let i = 0; i < 7; i++) {
    if (x.getDay() === dow) return x;
    x.setDate(x.getDate() + 1);
  }
  return x;
}

async function rebuild(worker: string, fromDate: string) {
  // Call our rebuild endpoint internally (no web request)
  // We'll just run the same logic by invoking Prisma directly in rebuild route? Simpler:
  // Here we re-use by creating a fetch to local API (works in Next runtime).
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/schedule/rebuild`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worker, fromDate, includeToday: true }),
  }).catch(() => null);
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const jobId = parseInt(id, 10);
    if (!jobId) {
      return NextResponse.json({ error: "Invalid job id", received: id }, { status: 400 });
    }

    const body = await req.json().catch(() => ({} as any));
    const existing = await prisma.job.findUnique({ where: { id: jobId } });
    if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // ===== Status logic: toggle only when asked =====
    let newStatus = existing.status;

    const requestedStatus = clean(body.status);
    if (requestedStatus === "todo" || requestedStatus === "done" || requestedStatus === "unscheduled") {
      newStatus = requestedStatus as any;
    } else if (body.toggleStatus === true) {
      newStatus = existing.status === "done" ? ("todo" as any) : ("done" as any);
    }

    // ===== Append notes =====
    const appendNote = clean(body.appendNote);
    const noteAuthor = clean(body.noteAuthor) || "unknown";
    let newNotesLog: string | undefined = undefined;
    if (appendNote) {
      const line = `[${nowGB()}] ${noteAuthor}: ${appendNote}`;
      newNotesLog = existing.notesLog ? `${existing.notesLog}\n${line}` : line;
    }

    // ===== Scheduling inputs =====
    // Customer insists: set fixed=true + date + optional time
    const fixedRequested = body.fixed === true;
    const visitDateRaw = clean(body.visitDate);
    const startTimeRaw = clean(body.startTime);

    let visitDateUpdate: Date | null | undefined = undefined;
    let startTimeUpdate: string | null | undefined = undefined;
    let fixedUpdate: boolean | undefined = undefined;

    if (visitDateRaw === "null") visitDateUpdate = null;
    if (visitDateRaw && visitDateRaw !== "null") {
      if (!isValidISODateOnly(visitDateRaw)) {
        return NextResponse.json({ error: "visitDate must be YYYY-MM-DD if provided" }, { status: 400 });
      }
      visitDateUpdate = new Date(visitDateRaw);
    }

    if (startTimeRaw) {
      if (!isValidHHMM(startTimeRaw)) {
        return NextResponse.json({ error: "startTime must be HH:MM if provided" }, { status: 400 });
      }
      startTimeUpdate = startTimeRaw;
    } else if ("startTime" in body && !startTimeRaw) {
      startTimeUpdate = null;
    }

    if ("fixed" in body) {
      fixedUpdate = fixedRequested;
    }

    // ===== Extend time (overrun) =====
    const extendMins =
      Number.isFinite(Number(body.extendMins)) && Number(body.extendMins) > 0
        ? Math.round(Number(body.extendMins))
        : 0;

    let overrunUpdate: number | undefined = undefined;
    if (extendMins > 0) {
      overrunUpdate = (existing.overrunMins ?? 0) + extendMins;
    }

    // ===== Address update => postcode =====
    let postcodeUpdate: string | undefined = undefined;
    if (typeof body.address === "string") {
      postcodeUpdate = outwardPostcode(body.address);
    }

    // ===== Duration update =====
    let durationUpdate: number | undefined = undefined;
    if (Number.isFinite(Number(body.durationMins)) && Number(body.durationMins) > 0) {
      durationUpdate = Math.round(Number(body.durationMins));
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: newStatus as any,
        title: typeof body.title === "string" ? body.title : undefined,
        address: typeof body.address === "string" ? body.address : undefined,
        postcode: postcodeUpdate,
        assignedTo:
          typeof body.assignedTo === "string"
            ? body.assignedTo.toLowerCase()
            : body.assignedTo === null
            ? null
            : undefined,
        visitDate: visitDateUpdate,
        fixed: fixedUpdate,
        startTime: startTimeUpdate,
        notesLog: typeof newNotesLog === "string" ? newNotesLog : undefined,
        durationMins: durationUpdate,
        overrunMins: overrunUpdate,

        // recurrence updates (optional)
        recurrenceActive: typeof body.recurrenceActive === "boolean" ? body.recurrenceActive : undefined,
        recurrenceEveryWeeks:
          Number.isFinite(Number(body.recurrenceEveryWeeks)) ? Number(body.recurrenceEveryWeeks) : undefined,
        recurrenceDurationMins:
          Number.isFinite(Number(body.recurrenceDurationMins)) ? Number(body.recurrenceDurationMins) : undefined,
        recurrencePreferredDOW:
          Number.isFinite(Number(body.recurrencePreferredDOW)) ? Number(body.recurrencePreferredDOW) : undefined,
        recurrencePreferredTime:
          typeof body.recurrencePreferredTime === "string" ? body.recurrencePreferredTime : undefined,
      },
    });

    // ===== Recurrence: if toggled to done, create next instance =====
    if (body.toggleStatus === true && updated.status === "done" && updated.recurrenceActive && updated.recurrenceEveryWeeks) {
      const base = updated.visitDate ? new Date(updated.visitDate) : new Date();
      let next = addWeeks(base, updated.recurrenceEveryWeeks);

      if (Number.isFinite(Number(updated.recurrencePreferredDOW))) {
        next = adjustToDOWOnOrAfter(next, Number(updated.recurrencePreferredDOW));
      }

      const nextDuration = updated.recurrenceDurationMins ?? updated.durationMins ?? 60;
      const prefTime = updated.recurrencePreferredTime ? clean(updated.recurrencePreferredTime) : "";
      const nextFixed = !!prefTime;

      await prisma.job.create({
        data: {
          title: updated.title,
          address: updated.address,
          postcode: updated.postcode || outwardPostcode(updated.address),
          notes: updated.notes ?? "",
          notesLog: "",
          status: nextFixed ? "todo" : "unscheduled",
          visitDate: nextFixed ? next : null,
          assignedTo: updated.assignedTo,
          durationMins: nextDuration,
          overrunMins: 0,
          fixed: nextFixed,
          startTime: nextFixed ? prefTime : null,

          recurrenceActive: updated.recurrenceActive,
          recurrenceEveryWeeks: updated.recurrenceEveryWeeks,
          recurrenceDurationMins: updated.recurrenceDurationMins,
          recurrencePreferredDOW: updated.recurrencePreferredDOW,
          recurrencePreferredTime: updated.recurrencePreferredTime,
        },
      });
    }

    // ===== Rebuild triggers =====
    // If job has a worker and we changed anything that affects the diary, rebuild from that day.
    const worker = (updated.assignedTo ?? "").toLowerCase();
    const rebuildFrom =
      updated.visitDate ? new Date(updated.visitDate) : new Date();
    const fromDate = rebuildFrom.toISOString().slice(0, 10);

    const affectsDiary =
      extendMins > 0 ||
      "fixed" in body ||
      "visitDate" in body ||
      "startTime" in body ||
      "assignedTo" in body ||
      requestedStatus === "todo" ||
      requestedStatus === "unscheduled";

    if (worker && affectsDiary) {
      // NOTE: if you don't have NEXT_PUBLIC_BASE_URL set, rebuild() still works locally in dev.
      await rebuild(worker, fromDate);
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/jobs/[id] failed:", err);
    return NextResponse.json({ error: "PATCH failed", details: String(err) }, { status: 500 });
  }
}