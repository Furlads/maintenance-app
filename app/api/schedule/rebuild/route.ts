export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

// ===== Workday rules (Trev defaults) =====
const DAY_START = "08:30";
const PREP_MINS = 30;   // loading up
const BREAK_MINS = 20;  // break
const DAY_LENGTH_MINS = 7 * 60; // 7 hour day
const AVAILABLE_MINS = DAY_LENGTH_MINS - PREP_MINS - BREAK_MINS; // 370
const DEFAULT_TRAVEL_MINS = 15;
const HORIZON_DAYS = 30; // how far ahead we reshuffle
const SLOT_MINS = 15; // round to 15-min blocks

function clean(s: unknown) {
  return typeof s === "string" ? s.trim() : "";
}

function isoDateOnly(d: Date) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function parseHHMM(hhmm: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minsToHHMM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function roundUpToSlot(mins: number) {
  return Math.ceil(mins / SLOT_MINS) * SLOT_MINS;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function isWeekend(d: Date) {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

// Basic postcode outward code extractor (good enough for V1)
function outwardPostcode(address: string) {
  const upper = (address || "").toUpperCase();
  const match = upper.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/);
  if (!match) return "";
  return match[1]; // outward only
}

type Job = Awaited<ReturnType<typeof prisma.job.findFirst>> & {
  // prisma typing convenience
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const worker = clean(body.worker).toLowerCase();
    const fromDateStr = clean(body.fromDate); // YYYY-MM-DD
    const includeToday = body.includeToday !== false; // default true

    if (!worker) {
      return NextResponse.json({ error: "worker is required" }, { status: 400 });
    }

    const from = fromDateStr ? new Date(fromDateStr) : new Date();
    if (!includeToday) from.setDate(from.getDate() + 1);

    // Pull jobs for this worker that are NOT done
    const jobs = await prisma.job.findMany({
      where: {
        assignedTo: worker,
        status: { in: ["todo", "unscheduled"] },
      },
      orderBy: [{ fixed: "desc" }, { visitDate: "asc" }, { createdAt: "asc" }],
    });

    // Split fixed vs flexible
    const fixedJobs = jobs.filter((j) => j.fixed && j.visitDate && j.startTime);
    const flexibleJobs = jobs.filter((j) => !j.fixed);

    // Ensure postcode stored for clustering (auto-fill if missing)
    for (const j of jobs) {
      if (!j.postcode) {
        const pc = outwardPostcode(j.address);
        if (pc) {
          await prisma.job.update({ where: { id: j.id }, data: { postcode: pc } });
          (j as any).postcode = pc;
        }
      }
    }

    // Build per-day buckets for fixed jobs
    const fixedByDay = new Map<string, typeof fixedJobs>();

    for (const j of fixedJobs) {
      const day = isoDateOnly(new Date(j.visitDate!));
      const arr = fixedByDay.get(day) ?? [];
      arr.push(j);
      fixedByDay.set(day, arr);
    }

    // Sort fixed jobs in a day by startTime
    for (const [day, arr] of fixedByDay.entries()) {
      arr.sort((a, b) => {
        const am = parseHHMM(a.startTime!) ?? 0;
        const bm = parseHHMM(b.startTime!) ?? 0;
        return am - bm;
      });
      fixedByDay.set(day, arr);
    }

    // Greedy scheduler for flexible jobs across next HORIZON_DAYS
    const startMins = parseHHMM(DAY_START)! + PREP_MINS;

    // Helper: choose next flexible job “most economical”
    function pickNextJob(dayPostcodes: Set<string>) {
      // Prefer a job whose postcode is already on the day
      let idx = -1;

      for (let i = 0; i < flexibleJobs.length; i++) {
        const pc = (flexibleJobs[i].postcode || "").toUpperCase();
        if (pc && dayPostcodes.has(pc)) {
          idx = i;
          break;
        }
      }

      // Otherwise just take the earliest created (stable) job
      if (idx === -1) idx = 0;

      return flexibleJobs.splice(idx, 1)[0];
    }

    const updates: { id: number; visitDate: Date | null; status: "todo" | "unscheduled"; startTime: string | null }[] =
      [];

    // Clear existing dates for flexible jobs so we can rebuild cleanly
    // (We keep fixed jobs as-is)
    for (const j of flexibleJobs) {
      updates.push({ id: j.id, visitDate: null, status: "unscheduled", startTime: null });
    }

    // Apply clears first
    for (const u of updates) {
      await prisma.job.update({
        where: { id: u.id },
        data: { visitDate: u.visitDate, status: u.status, startTime: u.startTime, fixed: false },
      });
    }

    // Reload flexible jobs (now unscheduled)
    let remaining = await prisma.job.findMany({
      where: { assignedTo: worker, status: "unscheduled", fixed: false },
      orderBy: { createdAt: "asc" },
    });

    // Put them into a mutable list (with postcode)
    const flexList = remaining.map((j) => ({
      ...j,
      postcode: j.postcode || outwardPostcode(j.address) || "",
    }));

    // Now schedule them day by day
    for (let dayOffset = 0; dayOffset < HORIZON_DAYS && flexList.length > 0; dayOffset++) {
      const dayDate = addDays(from, dayOffset);
      if (isWeekend(dayDate)) continue;

      const dayKey = isoDateOnly(dayDate);

      const fixedToday = fixedByDay.get(dayKey) ?? [];
      const dayPostcodes = new Set<string>();
      for (const fj of fixedToday) {
        if (fj.postcode) dayPostcodes.add(String(fj.postcode).toUpperCase());
      }

      // Work minutes budget for the day (jobs + travel)
      let used = 0;

      // Account for fixed jobs consuming time
      // We’ll count their duration + overrun + travel buffers around them roughly.
      for (let i = 0; i < fixedToday.length; i++) {
        const fj = fixedToday[i];
        const dur = (fj.durationMins ?? 60) + (fj.overrunMins ?? 0);
        const travel = i === 0 ? 0 : (fj.travelMinsHint ?? DEFAULT_TRAVEL_MINS);
        used += travel + dur;
      }

      let remainingMins = AVAILABLE_MINS - used;
      if (remainingMins <= 0) continue;

      // Fill flexible jobs into remaining time
      // Each job costs: travel (except first flex on the day if no fixed jobs) + duration + overrun
      let firstFlex = fixedToday.length === 0;

      while (flexList.length > 0) {
        // pick “best” job for clustering
        let pickIndex = -1;

        for (let i = 0; i < flexList.length; i++) {
          const pc = (flexList[i].postcode || "").toUpperCase();
          if (pc && dayPostcodes.has(pc)) {
            pickIndex = i;
            break;
          }
        }
        if (pickIndex === -1) pickIndex = 0;

        const job = flexList[pickIndex];
        const dur = (job.durationMins ?? 60) + (job.overrunMins ?? 0);
        const travel = firstFlex ? 0 : (job.travelMinsHint ?? DEFAULT_TRAVEL_MINS);
        const cost = travel + dur;

        if (cost > remainingMins) break;

        // remove from list
        flexList.splice(pickIndex, 1);

        // Set this job to the day (no fixed time, just a day booking)
        // Start time: we’ll set an approximate time for sequencing (optional for UI later)
        // We schedule sequentially from startMins + used
        const approxStart = roundUpToSlot(startMins + used);
        const approxTime = minsToHHMM(approxStart);

        await prisma.job.update({
          where: { id: job.id },
          data: {
            visitDate: new Date(dayKey),
            status: "todo",
            startTime: approxTime,
            fixed: false,
          },
        });

        if (job.postcode) dayPostcodes.add(String(job.postcode).toUpperCase());

        used += cost;
        remainingMins -= cost;
        firstFlex = false;
      }
    }

    return NextResponse.json({
      ok: true,
      worker,
      fromDate: isoDateOnly(from),
      scheduledRemaining: flexList.length,
      note: "Rebuild complete (fixed jobs kept, flexible jobs moved for economy).",
    });
  } catch (err) {
    console.error("POST /api/schedule/rebuild failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}