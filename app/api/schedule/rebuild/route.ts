import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Body = {
  worker: string;
  fromDate?: string;
  includeToday?: boolean;
};

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function toDateOnly(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function timeFromMinutes(totalMins: number) {
  const hh = Math.floor(totalMins / 60)
    .toString()
    .padStart(2, "0");
  const mm = (totalMins % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function clampInt(n: any, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.round(x);
}

type JobRow = any;

function getPostcodeOutward(j: JobRow) {
  return (j?.postcodeOutward || "").toString().trim().toUpperCase() || "UNKNOWN";
}

function getDurationMins(j: JobRow) {
  return Math.max(15, clampInt(j?.durationMins, 60));
}

function hasLatLng(j: JobRow) {
  return typeof j?.lat === "number" && Number.isFinite(j.lat) && typeof j?.lng === "number" && Number.isFinite(j.lng);
}

function locationStringForMaps(j: JobRow) {
  // Prefer lat/lng if present (more accurate + less ambiguous)
  if (hasLatLng(j)) return `${j.lat},${j.lng}`;

  // Else fall back to full address string
  const a = clean(j?.address);
  const pc = clean(j?.postcodeFull);
  const joined = [a, pc].filter(Boolean).join(", ");
  return joined || a || pc || "";
}

function travelKey(o: string, d: string) {
  return `${o} -> ${d}`;
}

/**
 * Google Distance Matrix: returns minutes (integer).
 * Falls back to heuristic if API fails / zero results.
 */
async function getTravelMinsGoogle(
  apiKey: string,
  origin: string,
  destination: string
): Promise<number | null> {
  if (!origin || !destination) return null;

  const url =
    "https://maps.googleapis.com/maps/api/distancematrix/json" +
    `?origins=${encodeURIComponent(origin)}` +
    `&destinations=${encodeURIComponent(destination)}` +
    `&mode=driving` +
    `&departure_time=now` +
    `&key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return null;

  const data: any = await res.json().catch(() => null);
  if (!data) return null;

  const el = data?.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK") return null;

  const seconds =
    typeof el?.duration_in_traffic?.value === "number"
      ? el.duration_in_traffic.value
      : typeof el?.duration?.value === "number"
        ? el.duration.value
        : null;

  if (!seconds || !Number.isFinite(seconds)) return null;

  return Math.max(0, Math.round(seconds / 60));
}

/**
 * Travel minutes:
 * - Uses Google (cached per request)
 * - If Google fails, uses fallback:
 *    - same outward: 10
 *    - different outward: 20
 */
async function travelBetween(
  apiKey: string,
  cache: Map<string, number>,
  prev: JobRow | null,
  next: JobRow
): Promise<number> {
  if (!prev) return 0;

  // If you already store a hint, use it as a fast-path (but only if reasonable)
  const hinted = next?.travelMinsHint;
  if (typeof hinted === "number" && Number.isFinite(hinted) && hinted > 0) {
    return Math.round(hinted);
  }

  const o = locationStringForMaps(prev);
  const d = locationStringForMaps(next);
  const k = travelKey(o, d);

  if (cache.has(k)) return cache.get(k)!;

  const mins = await getTravelMinsGoogle(apiKey, o, d);

  if (typeof mins === "number" && Number.isFinite(mins) && mins >= 0) {
    cache.set(k, mins);
    return mins;
  }

  // Fallback heuristic
  const a = getPostcodeOutward(prev);
  const b = getPostcodeOutward(next);
  const fallback = a === b ? 10 : 20;
  cache.set(k, fallback);
  return fallback;
}

/**
 * Pick the best break boundary (between jobs):
 * - choose boundary closest to midpoint of the day's timeline (buffer + travel + jobs)
 * - prefer boundaries where postcodeOutward changes if close
 */
async function chooseBreakIndex(
  apiKey: string,
  cache: Map<string, number>,
  dayJobs: JobRow[],
  dayStartClockMins: number,
  bufferMins: number
): Promise<number> {
  if (dayJobs.length < 2) return 0;

  const startAfterBuffer = dayStartClockMins + bufferMins;

  // Build a "timeline" without the break, to locate the midpoint target
  let t = startAfterBuffer;
  let prev: JobRow | null = null;
  for (const j of dayJobs) {
    t += await travelBetween(apiKey, cache, prev, j);
    t += getDurationMins(j);
    prev = j;
  }
  const target = startAfterBuffer + Math.floor((t - startAfterBuffer) / 2);

  // Evaluate boundaries
  let bestAny = { idx: 1, score: Number.POSITIVE_INFINITY };
  let bestSwitch = { idx: 1, score: Number.POSITIVE_INFINITY };

  let cursor = startAfterBuffer;
  prev = null;

  for (let i = 0; i < dayJobs.length - 1; i++) {
    const j = dayJobs[i];
    cursor += await travelBetween(apiKey, cache, prev, j);
    cursor += getDurationMins(j);

    const boundaryIdx = i + 1;
    const score = Math.abs(cursor - target);

    if (score < bestAny.score) bestAny = { idx: boundaryIdx, score };

    const a = getPostcodeOutward(dayJobs[i]);
    const b = getPostcodeOutward(dayJobs[i + 1]);
    if (a !== b && score < bestSwitch.score) bestSwitch = { idx: boundaryIdx, score };

    prev = j;
  }

  return bestSwitch.score !== Number.POSITIVE_INFINITY ? bestSwitch.idx : bestAny.idx;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = clean(process.env.GOOGLE_MAPS_API_KEY);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GOOGLE_MAPS_API_KEY in environment." },
        { status: 500 }
      );
    }

    const body: Body = await req.json().catch(() => ({} as any));

    const workerKey = clean(body.worker).toLowerCase();
    if (!workerKey) {
      return NextResponse.json({ error: "Missing worker" }, { status: 400 });
    }

    const fromDateRaw = clean(body.fromDate);
    const includeToday = Boolean(body.includeToday);

    const today = toDateOnly(new Date());
    const startDate = fromDateRaw ? toDateOnly(new Date(fromDateRaw)) : today;
    const rebuildFrom = includeToday ? startDate : addDays(startDate, 1);

    const worker = await prisma.worker.findFirst({
      where: { key: workerKey },
      select: { id: true, key: true },
    });

    if (!worker) {
      return NextResponse.json({ error: `Worker "${workerKey}" not found` }, { status: 404 });
    }

    // --- DAY RULES ---
    const DAY_START_HOUR = 8;
    const DAY_START_CLOCK_MINS = DAY_START_HOUR * 60; // 08:00
    const BUFFER_MINS = 30; // morning load/pickups
    const MAX_WORK_MINS = 7 * 60; // job durations only
    const BREAK_MINS = 20; // insert once per day at best gap

    // Clear future non-fixed jobs for this worker from rebuildFrom onwards
    await prisma.job.updateMany({
      where: {
        assignedTo: workerKey,
        fixed: false,
        visitDate: { gte: rebuildFrom },
      },
      data: {
        visitDate: null,
        startTime: null,
        status: "unscheduled",
      },
    });

    // Fetch unscheduled jobs (oldest first)
    const unscheduled = await prisma.job.findMany({
      where: { assignedTo: workerKey, status: "unscheduled" },
      orderBy: { createdAt: "asc" },
    });

    if (unscheduled.length === 0) {
      return NextResponse.json({ ok: true, scheduled: 0 });
    }

    // Group by postcodeOutward for area batching
    const clusters = new Map<string, JobRow[]>();
    for (const j of unscheduled as any[]) {
      const k = getPostcodeOutward(j);
      if (!clusters.has(k)) clusters.set(k, []);
      clusters.get(k)!.push(j);
    }

    // Flatten clusters (stable order)
    const queue: JobRow[] = Array.from(clusters.values()).flat();

    // Per-request travel cache so we don't hammer Google for repeated pairs
    const travelCache = new Map<string, number>();

    let currentDate = new Date(rebuildFrom);
    let scheduledCount = 0;

    while (queue.length > 0) {
      // Build a day batch based on WORK minutes only (7h cap)
      const dayJobs: JobRow[] = [];
      let workUsed = 0;

      while (queue.length > 0) {
        const next = queue[0];
        const dur = getDurationMins(next);

        if (workUsed + dur > MAX_WORK_MINS) break;

        dayJobs.push(next);
        queue.shift();
        workUsed += dur;
      }

      // Safety: if nothing fits, force one job in (prevents infinite loop)
      if (dayJobs.length === 0 && queue.length > 0) {
        dayJobs.push(queue.shift()!);
      }

      // Choose best break gap for this day
      const breakIdx = await chooseBreakIndex(
        apiKey,
        travelCache,
        dayJobs,
        DAY_START_CLOCK_MINS,
        BUFFER_MINS
      );

      // Assign start times using buffer + travel + break + duration
      let minsFromMidnight = DAY_START_CLOCK_MINS + BUFFER_MINS;
      let prev: JobRow | null = null;

      for (let i = 0; i < dayJobs.length; i++) {
        if (i === breakIdx) minsFromMidnight += BREAK_MINS;

        const job = dayJobs[i];

        const travelMins = await travelBetween(apiKey, travelCache, prev, job);
        minsFromMidnight += travelMins;

        const startTime = timeFromMinutes(minsFromMidnight);

        // Save scheduled time
        await prisma.job.update({
          where: { id: job.id },
          data: {
            visitDate: new Date(currentDate),
            startTime,
            status: "scheduled",
          },
        });

        // Optional: persist travel hint "into this job" for future faster schedules
        // If the field doesn't exist in your schema, Prisma would fail at compile-time,
        // but you already showed it in your prisma error as available.
        if (prev && travelMins > 0) {
          await prisma.job.update({
            where: { id: job.id },
            data: { travelMinsHint: travelMins },
          }).catch(() => {});
        }

        minsFromMidnight += getDurationMins(job);
        prev = job;
        scheduledCount++;
      }

      currentDate = addDays(currentDate, 1);
    }

    return NextResponse.json({
      ok: true,
      scheduled: scheduledCount,
      rules: {
        dayStart: `${DAY_START_HOUR.toString().padStart(2, "0")}:00`,
        bufferMins: BUFFER_MINS,
        maxWorkMins: MAX_WORK_MINS,
        breakMins: BREAK_MINS,
        travel: "Google Distance Matrix (duration_in_traffic if available), cached per rebuild",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to rebuild schedule." },
      { status: 500 }
    );
  }
}