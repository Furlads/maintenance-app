import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function cleanCompany(v: unknown) {
  const c = clean(v).toLowerCase();
  return c === "threecounties" ? "threecounties" : "furlads";
}

function outwardFromPostcode(full: string) {
  const pc = clean(full).toUpperCase().replace(/\s+/g, " ");
  if (!pc) return "";
  const parts = pc.split(" ");
  if (parts.length >= 2) return parts[0];
  if (pc.length > 3) return pc.slice(0, pc.length - 3);
  return pc;
}

function toNumberOrNull(v: any) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function toBool(v: any) {
  return !!v;
}

function safePhotoUrls(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => clean(x)).filter(Boolean).slice(0, 24);
  if (typeof v === "string") {
    const one = clean(v);
    return one ? [one] : [];
  }
  return [];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const company = url.searchParams.get("company");
  const c = company ? cleanCompany(company) : null;

  const includeDeleted = url.searchParams.get("includeDeleted") === "1";

  const jobs = await prisma.job.findMany({
    where: {
      ...(c ? { company: c as any } : {}),
      ...(includeDeleted ? {} : { deletedAt: null }),
    } as any,
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  try {
    const body: any = await req.json().catch(() => ({}));
    const company = cleanCompany(body.company);

    // ✅ schema uses title
    const title = clean(body.title) || clean(body.customerName) || clean(body.customer_name);
    if (!title) return NextResponse.json({ error: "Missing: title" }, { status: 400 });

    const address = clean(body.address);
    if (!address) return NextResponse.json({ error: "Missing: address" }, { status: 400 });

    const overview = clean(body.overview);
    const notes = clean(body.notes);

    const postcodeFull = clean(body.postcodeFull);
    const postcode = outwardFromPostcode(postcodeFull) || outwardFromPostcode(address);

    const assignedToKey = clean(body.assignedTo).toLowerCase() || null;

    // Hard-to-find + W3W + photos
    const hardToFind = toBool(body.hardToFind);
    const what3wordsLink = clean(body.what3wordsLink) || "";
    const photoUrls = safePhotoUrls(body.photoUrls);

    // Backwards compat fields
    const what3words = clean(body.what3words);
    const latitude = toNumberOrNull(body.latitude);
    const longitude = toNumberOrNull(body.longitude);

    // Scheduling
    const fixed = toBool(body.fixed);
    const visitDate = clean(body.visitDate) ? new Date(clean(body.visitDate)) : null;
    const startTime = clean(body.startTime) || null;

    const durationMinsRaw = toNumberOrNull(body.durationMins);
    const durationMins = typeof durationMinsRaw === "number" ? Math.max(15, Math.round(durationMinsRaw)) : 60;

    // Recurrence
    const recurrenceActive = toBool(body.recurrenceActive);
    const recurrenceEveryWeeksRaw = toNumberOrNull(body.recurrenceEveryWeeks);
    const recurrenceEveryWeeks =
      recurrenceActive && typeof recurrenceEveryWeeksRaw === "number"
        ? Math.max(1, Math.round(recurrenceEveryWeeksRaw))
        : null;

    const recurrenceDurationMinsRaw = toNumberOrNull(body.recurrenceDurationMins);
    const recurrenceDurationMins =
      recurrenceActive && typeof recurrenceDurationMinsRaw === "number"
        ? Math.max(15, Math.round(recurrenceDurationMinsRaw))
        : null;

    const recurrencePreferredDOWRaw = toNumberOrNull(body.recurrencePreferredDOW);
    const recurrencePreferredDOW =
      recurrenceActive && typeof recurrencePreferredDOWRaw === "number"
        ? Math.max(0, Math.min(6, Math.round(recurrencePreferredDOWRaw)))
        : null;

    const recurrencePreferredTime = recurrenceActive ? clean(body.recurrencePreferredTime) || null : null;

    // ✅ Resolve worker relation safely (must match company)
    let assignedWorkerId: number | null = null;
    let assignedTo: string | null = assignedToKey;

    if (assignedToKey) {
      const worker = await prisma.worker.findFirst({
        where: { company: company as any, key: assignedToKey },
        select: { id: true, key: true },
      });

      if (!worker) {
        return NextResponse.json(
          { error: `Assigned worker "${assignedToKey}" not found for company "${company}".` },
          { status: 400 }
        );
      }

      assignedWorkerId = worker.id;
      assignedTo = worker.key;
    }

    const status = fixed ? "todo" : "unscheduled";

    const created = await prisma.job.create({
      data: {
        company: company as any,
        title,

        address,
        postcode,
        postcodeFull,

        overview,
        notes,
        notesLog: "",
        status: status as any,

        visitDate: fixed ? visitDate : null,
        startTime: fixed ? startTime : null,
        fixed,
        durationMins,

        // back compat
        what3words,
        latitude: latitude ?? null,
        longitude: longitude ?? null,

        // photos + w3w
        hardToFind,
        what3wordsLink,
        photoUrls: photoUrls as any,

        // assignment
        assignedTo,
        assignedWorkerId,

        // recurrence
        recurrenceActive,
        recurrenceEveryWeeks,
        recurrenceDurationMins,
        recurrencePreferredDOW,
        recurrencePreferredTime,

        deletedAt: null,
      } as any,
    });

    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create job." }, { status: 500 });
  }
}