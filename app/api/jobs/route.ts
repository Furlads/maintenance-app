export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  return match[1]; // outward code only (TF9, SY13 etc.)
}

// Canonical worker keys in DB
type AssignedToKey = "trev" | "kelly" | "stephen" | "jacob";

function normalizeAssignedTo(raw: string): AssignedToKey | "" {
  const v = (raw || "").trim().toLowerCase();

  if (!v) return "";

  // allow a few friendly inputs
  if (v === "trev" || v === "trevor" || v === "trevor fudger") return "trev";
  if (v === "kelly" || v === "kelly darby") return "kelly";
  if (v === "stephen" || v === "steve") return "stephen";
  if (v === "jacob" || v === "jake") return "jacob";

  // already-canonical values
  if (v === "trev" || v === "kelly" || v === "stephen" || v === "jacob") return v as AssignedToKey;

  // unknown
  return "";
}

async function rebuild(worker: string, fromDate: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  await fetch(`${base}/api/schedule/rebuild`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worker, fromDate, includeToday: true }),
  }).catch(() => null);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const assignedToParam = cleanString(url.searchParams.get("assignedTo"));

    const assignedTo = normalizeAssignedTo(assignedToParam);

    const jobs = await prisma.job.findMany({
      where: assignedTo ? { assignedTo } : undefined,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(jobs);
  } catch (err) {
    console.error("GET /api/jobs failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // REQUIRED
    const title = cleanString(body.title);
    const address = cleanString(body.address);
    const assignedToRaw = cleanString(body.assignedTo);

    // OPTIONAL
    const notes = cleanString(body.notes);
    const visitDateRaw = cleanString(body.visitDate); // YYYY-MM-DD or blank/null
    const startTimeRaw = cleanString(body.startTime); // HH:MM optional
    const durationMinsRaw = body.durationMins;

    // Recurrence optional
    const recurrenceActive = body.recurrenceActive === true;
    const recurrenceEveryWeeks = Number.isFinite(Number(body.recurrenceEveryWeeks))
      ? Number(body.recurrenceEveryWeeks)
      : null;
    const recurrenceDurationMins = Number.isFinite(Number(body.recurrenceDurationMins))
      ? Number(body.recurrenceDurationMins)
      : null;
    const recurrencePreferredDOW = Number.isFinite(Number(body.recurrencePreferredDOW))
      ? Number(body.recurrencePreferredDOW)
      : null;
    const recurrencePreferredTime = cleanString(body.recurrencePreferredTime);

    const missing: string[] = [];
    if (!title) missing.push("title");
    if (!address) missing.push("address");

    const assignedTo = normalizeAssignedTo(assignedToRaw);
    if (!assignedTo) missing.push("assignedTo");

    if (missing.length > 0) {
      return NextResponse.json({ error: "Missing/invalid required fields", missing }, { status: 400 });
    }

    const postcode = outwardPostcode(address);

    const durationMins =
      Number.isFinite(Number(durationMinsRaw)) && Number(durationMinsRaw) > 0
        ? Math.round(Number(durationMinsRaw))
        : 60;

    // Determine fixed vs flexible
    let visitDate: Date | null = null;
    let fixed = false;
    let startTime: string | null = null;

    if (visitDateRaw && visitDateRaw !== "null") {
      if (!isValidISODateOnly(visitDateRaw)) {
        return NextResponse.json({ error: "visitDate must be YYYY-MM-DD if provided" }, { status: 400 });
      }
      visitDate = new Date(visitDateRaw);

      // If they provided a date, we treat it as customer-insisted
      fixed = true;

      if (startTimeRaw) {
        if (!isValidHHMM(startTimeRaw)) {
          return NextResponse.json({ error: "startTime must be HH:MM if provided" }, { status: 400 });
        }
        startTime = startTimeRaw;
      }
    }

    const status = visitDate ? "todo" : "unscheduled";

    const job = await prisma.job.create({
      data: {
        title,
        address,
        postcode,
        notes: notes || "",
        notesLog: "",
        status,
        visitDate,
        assignedTo,
        durationMins,
        fixed,
        startTime,

        recurrenceActive,
        recurrenceEveryWeeks,
        recurrenceDurationMins,
        recurrencePreferredDOW,
        recurrencePreferredTime: recurrencePreferredTime || null,
      },
    });

    const fromDate =
      (visitDate ? visitDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)) ?? "";

    await rebuild(assignedTo, fromDate);

    const refreshed = await prisma.job.findUnique({ where: { id: job.id } });
    return NextResponse.json(refreshed ?? job);
  } catch (err) {
    console.error("POST /api/jobs failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}