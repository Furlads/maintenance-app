import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, ReminderType } from "@prisma/client";

const prisma = new PrismaClient();

type Body = {
  jobId: string;
  assignedTo: string;
  dueInMins?: number; // default 30
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobId = (body?.jobId || "").trim();
  const assignedTo = (body?.assignedTo || "").trim();
  const dueInMins = typeof body?.dueInMins === "number" && body.dueInMins > 0 ? Math.round(body.dueInMins) : 30;

  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  if (!assignedTo) return NextResponse.json({ error: "Missing assignedTo" }, { status: 400 });

  // Only schedule if job still exists and is todo
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const dueAt = new Date(Date.now() + dueInMins * 60_000);

  // Clear any existing unsent/uncleared reminders for same job/user so we don't stack
  await prisma.reminder.updateMany({
    where: {
      jobId,
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
      jobId,
      assignedTo,
      dueAt,
    },
  });

  return NextResponse.json({ ok: true, reminderId: reminder.id, dueAt });
}