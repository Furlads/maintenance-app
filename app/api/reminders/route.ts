import { NextRequest, NextResponse } from "next/server";
import { ReminderType } from "@prisma/client";
import prisma from "@/lib/prisma";

type Body = {
  jobId: string | number;
  assignedTo: string;
  dueInMins?: number; // default 30
};

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function toJobId(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const s = clean(v);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobId = toJobId(body?.jobId);
  const assignedTo = clean(body?.assignedTo);
  const dueInMins =
    typeof body?.dueInMins === "number" && body.dueInMins > 0
      ? Math.round(body.dueInMins)
      : 30;

  if (!jobId || Number.isNaN(jobId) || jobId <= 0) {
    return NextResponse.json({ error: "Missing/invalid jobId" }, { status: 400 });
  }
  if (!assignedTo) {
    return NextResponse.json({ error: "Missing assignedTo" }, { status: 400 });
  }

  // Only schedule if job still exists
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const dueAt = new Date(Date.now() + dueInMins * 60_000);

  // Clear any existing unsent/uncleared reminders for same job/user so we don't stack
  await prisma.reminder.updateMany({
    where: {
      jobId: jobId,
      assignedTo,
      type: ReminderType.ARRIVAL_CHECK,
      sentAt: null,
      clearedAt: null,
    },
    data: { clearedAt: new Date() },
  });

  const reminder = await prisma.reminder.create({
    data: {
      type: ReminderType.ARRIVAL_CHECK,
      jobId: jobId,
      assignedTo,
      dueAt,
    },
  });

  return NextResponse.json({ ok: true, reminderId: reminder.id, dueAt });
}