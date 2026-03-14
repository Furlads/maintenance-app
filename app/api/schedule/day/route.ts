import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ScheduleJob = {
  id: number;
  title: string;
  jobType: string;
  customerName: string;
  postcode: string | null;
  address: string;
  startTime: string | null;
  durationMinutes: number | null;
  status: string;
};

type ScheduleWorker = {
  id: number;
  name: string;
  jobs: ScheduleJob[];
};

type ScheduleDayResponse = {
  date: string;
  workers: ScheduleWorker[];
};

function getDayRange(dateString: string) {
  const start = new Date(`${dateString}T00:00:00.000Z`);
  const end = new Date(`${dateString}T23:59:59.999Z`);
  return { start, end };
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

export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date");

    if (!dateParam) {
      return NextResponse.json(
        { error: "Missing required query parameter: date" },
        { status: 400 }
      );
    }

    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam);
    if (!isValidDate) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const { start, end } = getDayRange(dateParam);

    const [activeWorkers, jobsForDay] = await Promise.all([
      prisma.worker.findMany({
        where: {
          active: true,
        },
        orderBy: [
          { firstName: "asc" },
          { lastName: "asc" },
        ],
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
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          title: true,
          jobType: true,
          address: true,
          startTime: true,
          durationMinutes: true,
          status: true,
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
    ]);

    const workersMap = new Map<number, ScheduleWorker>();

    for (const worker of activeWorkers) {
      workersMap.set(worker.id, {
        id: worker.id,
        name: `${worker.firstName} ${worker.lastName}`.trim(),
        jobs: [],
      });
    }

    for (const job of jobsForDay) {
      const scheduleJob: ScheduleJob = {
        id: job.id,
        title: job.title,
        jobType: job.jobType,
        customerName: job.customer.name,
        postcode: job.customer.postcode,
        address: job.address,
        startTime: job.startTime,
        durationMinutes: job.durationMinutes,
        status: job.status,
      };

      for (const assignment of job.assignments) {
        const workerBucket = workersMap.get(assignment.workerId);

        if (!workerBucket) {
          continue;
        }

        workerBucket.jobs.push(scheduleJob);
      }
    }

    const workers: ScheduleWorker[] = Array.from(workersMap.values()).map(
      (worker) => ({
        ...worker,
        jobs: [...worker.jobs].sort((a, b) => {
          const timeA = normaliseStartTimeForSort(a.startTime);
          const timeB = normaliseStartTimeForSort(b.startTime);

          if (timeA < timeB) return -1;
          if (timeA > timeB) return 1;

          return a.id - b.id;
        }),
      })
    );

    const response: ScheduleDayResponse = {
      date: dateParam,
      workers,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/schedule/day failed", error);

    return NextResponse.json(
      { error: "Failed to load schedule day data" },
      { status: 500 }
    );
  }
}