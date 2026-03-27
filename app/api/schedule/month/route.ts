import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type MonthEntry = {
  id: string;
  type: "job" | "timeOff";
  workerId: number;
  workerName: string;
  title: string;
  subtitle: string | null;
  startTime: string | null;
  isFullDay: boolean;
  status: string;
  startDate?: string;
  endDate?: string;
};

type MonthDay = {
  date: string;
  entries: MonthEntry[];
};

type ScheduleMonthResponse = {
  month: string;
  days: MonthDay[];
};

function getMonthRange(monthString: string) {
  const [year, month] = monthString.split("-").map(Number);

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  return { start, end };
}

function toDateString(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function eachDateInRange(start: Date, end: Date) {
  const days: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0);
  const endSafe = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0, 0);

  while (cursor <= endSafe) {
    days.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function normaliseStartTimeForSort(value: string | null): string {
  if (!value) return "99:99";

  const trimmed = value.trim();
  const parts = trimmed.split(":");

  if (parts.length !== 2) return "99:99";

  const hours = parts[0].padStart(2, "0");
  const minutes = parts[1].padStart(2, "0");

  return `${hours}:${minutes}`;
}

function normaliseBlockStatus(
  source: string | null | undefined,
  status: string | null | undefined
): "pending" | "approved" | "declined" {
  const cleanSource = String(source || "").trim().toLowerCase();
  const cleanStatus = String(status || "").trim().toLowerCase();

  if (cleanSource !== "time_off_request") {
    return "approved";
  }

  if (cleanStatus === "pending") return "pending";
  if (cleanStatus === "declined") return "declined";

  return "approved";
}

function buildWorkerName(firstName: string | null | undefined, lastName: string | null | undefined) {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim() || "Unknown worker";
}

function buildJobTitle(job: {
  title: string | null;
  jobType: string | null;
  customer: { name: string | null } | null;
}) {
  const customerName = job.customer?.name?.trim();
  const title = job.title?.trim();
  const jobType = job.jobType?.trim();

  if (customerName && title && customerName.toLowerCase() !== title.toLowerCase()) {
    return `${customerName} — ${title}`;
  }

  if (customerName) return customerName;
  if (title) return title;
  if (jobType) return jobType;

  return "General job";
}

function buildJobSubtitle(job: {
  jobType: string | null;
  address: string | null;
  customer: { postcode: string | null } | null;
}) {
  const bits = [
    job.jobType?.trim() || null,
    job.customer?.postcode?.trim() || null,
    job.address?.trim() || null,
  ].filter(Boolean);

  return bits.length > 0 ? bits.join(" • ") : null;
}

function buildBlockTitle(title: string | null | undefined) {
  return title?.trim() || "Unavailable";
}

function getBlockDaysWithinMonth(startDate: Date, endDate: Date, monthStart: Date, monthEnd: Date) {
  const safeStart = new Date(
    Math.max(
      new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0, 0).getTime(),
      new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate(), 12, 0, 0, 0).getTime()
    )
  );

  const safeEnd = new Date(
    Math.min(
      new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 12, 0, 0, 0).getTime(),
      new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate(), 12, 0, 0, 0).getTime()
    )
  );

  return eachDateInRange(safeStart, safeEnd);
}

function addDays(dateString: string, amount: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() + amount);
  return toDateString(date);
}

function buildJobSpanKey(entry: MonthEntry) {
  return [
    entry.workerId,
    entry.workerName.trim().toLowerCase(),
    entry.title.trim().toLowerCase(),
    String(entry.subtitle || "").trim().toLowerCase(),
  ].join("::");
}

function applyJobSpans(daysMap: Map<string, MonthEntry[]>) {
  const datedEntries: Array<{ date: string; entry: MonthEntry }> = [];

  for (const [date, entries] of daysMap.entries()) {
    for (const entry of entries) {
      if (entry.type !== "job") continue;
      datedEntries.push({ date, entry });
    }
  }

  const grouped = new Map<string, Array<{ date: string; entry: MonthEntry }>>();

  for (const item of datedEntries) {
    const key = buildJobSpanKey(item.entry);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  }

  for (const items of grouped.values()) {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

    let runStart = 0;

    while (runStart < sorted.length) {
      let runEnd = runStart;

      while (runEnd + 1 < sorted.length) {
        const currentDate = sorted[runEnd].date;
        const nextDate = sorted[runEnd + 1].date;
        const expectedNext = addDays(currentDate, 1);

        if (nextDate !== expectedNext) {
          break;
        }

        runEnd += 1;
      }

      const spanStartDate = sorted[runStart].date;
      const spanEndDate = sorted[runEnd].date;

      if (runEnd > runStart) {
        for (let i = runStart; i <= runEnd; i += 1) {
          sorted[i].entry.startDate = spanStartDate;
          sorted[i].entry.endDate = spanEndDate;
        }
      }

      runStart = runEnd + 1;
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const monthParam = req.nextUrl.searchParams.get("month");

    if (!monthParam) {
      return NextResponse.json(
        { error: "Missing required query parameter: month" },
        { status: 400 }
      );
    }

    const isValidMonth = /^\d{4}-\d{2}$/.test(monthParam);
    if (!isValidMonth) {
      return NextResponse.json(
        { error: "Invalid month format. Use YYYY-MM" },
        { status: 400 }
      );
    }

    const { start, end } = getMonthRange(monthParam);

    const [activeWorkers, jobsForMonth, blocksForMonth] = await Promise.all([
      prisma.worker.findMany({
        where: {
          active: true,
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      }),

      prisma.job.findMany({
        where: {
          visitDate: {
            gte: start,
            lte: end,
          },
          assignments: {
            some: {},
          },
          status: {
            notIn: ["cancelled", "archived"],
          },
        },
        orderBy: [{ visitDate: "asc" }, { startTime: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          jobType: true,
          address: true,
          startTime: true,
          durationMinutes: true,
          status: true,
          visitDate: true,
          customer: {
            select: {
              name: true,
              postcode: true,
            },
          },
          assignments: {
            select: {
              workerId: true,
            },
          },
        },
      }),

      prisma.workerAvailabilityBlock.findMany({
        where: {
          active: true,
          startDate: {
            lte: end,
          },
          endDate: {
            gte: start,
          },
        },
        orderBy: [{ workerId: "asc" }, { startDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          workerId: true,
          requestId: true,
          title: true,
          startDate: true,
          endDate: true,
          startTime: true,
          endTime: true,
          isFullDay: true,
          notes: true,
          source: true,
          request: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const workerNames = new Map<number, string>();
    for (const worker of activeWorkers) {
      workerNames.set(worker.id, buildWorkerName(worker.firstName, worker.lastName));
    }

    const daysMap = new Map<string, MonthEntry[]>();
    for (const date of eachDateInRange(start, end)) {
      daysMap.set(date, []);
    }

    for (const job of jobsForMonth) {
      if (!job.visitDate) continue;

      const dayKey = toDateString(new Date(job.visitDate));
      const entries = daysMap.get(dayKey);

      if (!entries) continue;

      for (const assignment of job.assignments) {
        const workerName = workerNames.get(assignment.workerId);
        if (!workerName) continue;

        entries.push({
          id: `job-${job.id}-${assignment.workerId}`,
          type: "job",
          workerId: assignment.workerId,
          workerName,
          title: buildJobTitle(job),
          subtitle: buildJobSubtitle(job),
          startTime: job.startTime,
          isFullDay: false,
          status: job.status || "scheduled",
        });
      }
    }

    applyJobSpans(daysMap);

    for (const block of blocksForMonth) {
      const workerName = workerNames.get(block.workerId);
      if (!workerName) continue;

      const status = normaliseBlockStatus(block.source, block.request?.status);
      const dayKeys = getBlockDaysWithinMonth(block.startDate, block.endDate, start, end);
      const spanStartDate = toDateString(new Date(block.startDate));
      const spanEndDate = toDateString(new Date(block.endDate));

      for (const dayKey of dayKeys) {
        const entries = daysMap.get(dayKey);
        if (!entries) continue;

        entries.push({
          id: `block-${block.id}-${dayKey}`,
          type: "timeOff",
          workerId: block.workerId,
          workerName,
          title: buildBlockTitle(block.title),
          subtitle: block.notes?.trim() || null,
          startTime: block.isFullDay ? null : block.startTime,
          isFullDay: block.isFullDay,
          status,
          startDate: spanStartDate,
          endDate: spanEndDate,
        });
      }
    }

    const days: MonthDay[] = Array.from(daysMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entries]) => ({
        date,
        entries: [...entries].sort((a, b) => {
          const aTime =
            a.type === "timeOff" && a.isFullDay ? "00:00" : normaliseStartTimeForSort(a.startTime);
          const bTime =
            b.type === "timeOff" && b.isFullDay ? "00:00" : normaliseStartTimeForSort(b.startTime);

          if (aTime < bTime) return -1;
          if (aTime > bTime) return 1;

          if (a.workerName < b.workerName) return -1;
          if (a.workerName > b.workerName) return 1;

          return a.title.localeCompare(b.title);
        }),
      }));

    const response: ScheduleMonthResponse = {
      month: monthParam,
      days,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/schedule/month failed", error);

    return NextResponse.json(
      { error: "Failed to load schedule month data" },
      { status: 500 }
    );
  }
}