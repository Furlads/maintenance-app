import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, ReminderType } from "@prisma/client";

const prisma = new PrismaClient();

type Body = {
  jobId: string;
  assignedTo: string;
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

  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  if (!assignedTo) return NextResponse.json({ error: "Missing assignedTo" }, { status: 400 });

  const now = new Date();

  const result = await prisma.reminder.updateMany({
    where: {
      jobId,
      assignedTo,
      type: ReminderType.ARRIVAL_CHECK,
      clearedAt: null,
      sentAt: null,
    },
    data: { clearedAt: now },
  });

  return NextResponse.json({ ok: true, cleared: result.count });
}