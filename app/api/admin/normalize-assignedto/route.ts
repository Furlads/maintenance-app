export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

type AssignedToKey = "trev" | "kelly" | "stephen" | "jacob";

function normalizeAssignedTo(raw: string): AssignedToKey | "" {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return "";

  if (v === "trev" || v === "trevor" || v === "trevor fudger") return "trev";
  if (v === "kelly" || v === "kelly darby") return "kelly";
  if (v === "stephen" || v === "steve") return "stephen";
  if (v === "jacob" || v === "jake") return "jacob";

  if (v === "trev" || v === "kelly" || v === "stephen" || v === "jacob") return v as AssignedToKey;

  // handle common capitalised forms stored previously
  if (raw === "Trev") return "trev";
  if (raw === "Kelly") return "kelly";
  if (raw === "Stephen") return "stephen";
  if (raw === "Jacob") return "jacob";

  return "";
}

export async function POST() {
  try {
    const jobs = await prisma.job.findMany({
      select: { id: true, assignedTo: true },
    });

    let changed = 0;
    const unknown: Record<string, number> = {};

    for (const j of jobs) {
      const before = (j.assignedTo || "").trim();
      const after = normalizeAssignedTo(before);

      if (!after) {
        unknown[before || "(blank)"] = (unknown[before || "(blank)"] ?? 0) + 1;
        continue;
      }

      if (before !== after) {
        await prisma.job.update({
          where: { id: j.id },
          data: { assignedTo: after },
        });
        changed++;
      }
    }

    return NextResponse.json({ ok: true, changed, unknown });
  } catch (err) {
    console.error("normalize-assignedto failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}