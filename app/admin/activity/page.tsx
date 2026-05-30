import Link from "next/link";
import * as prismaModule from "@/lib/prisma";

export const dynamic = "force-dynamic";

const prisma = ((prismaModule as any).prisma ??
  (prismaModule as any).default) as any;

type ActivityLogRow = {
  id: number;
  createdAt: Date;
  workerId: number | null;
  workerName: string | null;
  jobId: number | null;
  eventType: string;
  page: string | null;
  details: string | null;
  metadataJson: string | null;
  userAgent: string | null;
  worker?: {
    firstName: string | null;
    lastName: string | null;
  } | null;
  job?: {
    id: number;
    title: string;
    address: string;
    customer?: {
      name: string | null;
      postcode: string | null;
    } | null;
  } | null;
};

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function startOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - diff,
    0,
    0,
    0,
    0
  );
}

function fullWorkerName(log: ActivityLogRow) {
  const relationName = `${log.worker?.firstName || ""} ${
    log.worker?.lastName || ""
  }`.trim();

  return log.workerName || relationName || "Unknown worker";
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    WORKER_HOME_OPENED: "Worker Home Opened",
    QUICK_ACTION_CLICKED: "Quick Action Clicked",
    NAVIGATE_CLICKED: "Navigate Clicked",
    CHAS_OPENED_FROM_WORKER_HOME: "CHAS Opened",
    PHOTO_UPLOAD_CLICKED_FROM_WORKER_HOME: "Photo Upload Opened",
    TIME_OFF_OPENED_FROM_WORKER_HOME: "Time Off Opened",
  };

  return labels[eventType] || eventType.replaceAll("_", " ");
}

function eventTone(eventType: string) {
  if (eventType.includes("CHAS")) {
    return "bg-purple-50 text-purple-700 ring-purple-200";
  }

  if (eventType.includes("PHOTO")) {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (eventType.includes("NAVIGATE")) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (eventType.includes("TIME_OFF")) {
    return "bg-green-50 text-green-700 ring-green-200";
  }

  if (eventType.includes("WORKER_HOME")) {
    return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }

  return "bg-white text-zinc-700 ring-zinc-200";
}

function countEvents(logs: ActivityLogRow[], matcher: (eventType: string) => boolean) {
  return logs.filter((log) => matcher(log.eventType)).length;
}

function groupByWorker(logs: ActivityLogRow[]) {
  const grouped = new Map<
    string,
    {
      workerName: string;
      total: number;
      homeOpens: number;
      navigateClicks: number;
      chasOpens: number;
      photoClicks: number;
      timeOffClicks: number;
    }
  >();

  for (const log of logs) {
    const workerName = fullWorkerName(log);

    if (!grouped.has(workerName)) {
      grouped.set(workerName, {
        workerName,
        total: 0,
        homeOpens: 0,
        navigateClicks: 0,
        chasOpens: 0,
        photoClicks: 0,
        timeOffClicks: 0,
      });
    }

    const item = grouped.get(workerName)!;

    item.total += 1;

    if (log.eventType === "WORKER_HOME_OPENED") item.homeOpens += 1;
    if (log.eventType.includes("NAVIGATE")) item.navigateClicks += 1;
    if (log.eventType.includes("CHAS")) item.chasOpens += 1;
    if (log.eventType.includes("PHOTO")) item.photoClicks += 1;
    if (log.eventType.includes("TIME_OFF")) item.timeOffClicks += 1;
  }

  return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
}

function StatCard({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: number;
  note?: string;
  tone?: "default" | "purple" | "blue" | "amber" | "green";
}) {
  const toneClass =
    tone === "purple"
      ? "border-purple-200 bg-purple-50"
      : tone === "blue"
        ? "border-blue-200 bg-blue-50"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50"
          : tone === "green"
            ? "border-green-200 bg-green-50"
            : "border-zinc-200 bg-white";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
        {value}
      </div>
      {note ? <div className="mt-1 text-xs text-zinc-500">{note}</div> : null}
    </div>
  );
}

export default async function AdminActivityPage() {
  const todayStart = startOfToday();
  const weekStart = startOfWeek();

  const [todayLogs, weekLogs, recentLogs] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        createdAt: {
          gte: todayStart,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1000,
      include: {
        worker: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            address: true,
            customer: {
              select: {
                name: true,
                postcode: true,
              },
            },
          },
        },
      },
    }),
    prisma.activityLog.findMany({
      where: {
        createdAt: {
          gte: weekStart,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5000,
      include: {
        worker: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            address: true,
            customer: {
              select: {
                name: true,
                postcode: true,
              },
            },
          },
        },
      },
    }),
    prisma.activityLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      include: {
        worker: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            address: true,
            customer: {
              select: {
                name: true,
                postcode: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const topWorkers = groupByWorker(weekLogs);

  const todayHomeOpens = countEvents(
    todayLogs,
    (eventType) => eventType === "WORKER_HOME_OPENED"
  );
  const todayNavigateClicks = countEvents(todayLogs, (eventType) =>
    eventType.includes("NAVIGATE")
  );
  const todayChasOpens = countEvents(todayLogs, (eventType) =>
    eventType.includes("CHAS")
  );
  const todayPhotoClicks = countEvents(todayLogs, (eventType) =>
    eventType.includes("PHOTO")
  );
  const todayTimeOffClicks = countEvents(todayLogs, (eventType) =>
    eventType.includes("TIME_OFF")
  );

  const weekHomeOpens = countEvents(
    weekLogs,
    (eventType) => eventType === "WORKER_HOME_OPENED"
  );
  const weekNavigateClicks = countEvents(weekLogs, (eventType) =>
    eventType.includes("NAVIGATE")
  );
  const weekChasOpens = countEvents(weekLogs, (eventType) =>
    eventType.includes("CHAS")
  );
  const weekPhotoClicks = countEvents(weekLogs, (eventType) =>
    eventType.includes("PHOTO")
  );

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-300">
              Worker activity
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              App usage dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              See what workers are actually using in the app, which buttons are
              being clicked, and where the team may need better shortcuts.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Back to admin
            </Link>

            <Link
              href="/api/activity-log/export"
              className="inline-flex items-center justify-center rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-amber-300"
            >
              Export CSV
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="Home opens" value={todayHomeOpens} note="Today" />
        <StatCard
          label="Navigate"
          value={todayNavigateClicks}
          note="Today"
          tone="amber"
        />
        <StatCard
          label="Photo clicks"
          value={todayPhotoClicks}
          note="Today"
          tone="blue"
        />
        <StatCard
          label="CHAS opens"
          value={todayChasOpens}
          note="Today"
          tone="purple"
        />
        <StatCard
          label="Time off"
          value={todayTimeOffClicks}
          note="Today"
          tone="green"
        />
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Week home opens" value={weekHomeOpens} />
        <StatCard label="Week navigate" value={weekNavigateClicks} tone="amber" />
        <StatCard label="Week photos" value={weekPhotoClicks} tone="blue" />
        <StatCard label="Week CHAS" value={weekChasOpens} tone="purple" />
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="xl:col-span-5">
          <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-4">
              <h2 className="text-base font-bold text-zinc-900">
                Top workers this week
              </h2>
              <p className="text-xs text-zinc-500">
                Based on logged app actions, not job performance.
              </p>
            </div>

            <div className="p-3 sm:p-4">
              {topWorkers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  No activity logged yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {topWorkers.slice(0, 10).map((worker) => (
                    <div
                      key={worker.workerName}
                      className="rounded-2xl border border-zinc-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-zinc-900">
                            {worker.workerName}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {worker.total} logged action
                            {worker.total === 1 ? "" : "s"} this week
                          </div>
                        </div>

                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                          {worker.total}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600">
                        <div>Home: {worker.homeOpens}</div>
                        <div>Navigate: {worker.navigateClicks}</div>
                        <div>Photos: {worker.photoClicks}</div>
                        <div>CHAS: {worker.chasOpens}</div>
                        <div>Time off: {worker.timeOffClicks}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="xl:col-span-7">
          <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900">
                  Last 100 activities
                </h2>
                <p className="text-xs text-zinc-500">
                  Newest activity at the top.
                </p>
              </div>

              <Link
                href="/api/activity-log/export?take=10000"
                className="text-sm font-semibold text-zinc-700"
              >
                Download full CSV
              </Link>
            </div>

            <div className="divide-y divide-zinc-100">
              {recentLogs.length === 0 ? (
                <div className="p-5 text-sm text-zinc-600">
                  No activity logged yet.
                </div>
              ) : (
                recentLogs.map((log: ActivityLogRow) => {
                  const workerName = fullWorkerName(log);
                  const jobTitle =
                    log.job?.customer?.name || log.job?.title || null;
                  const postcode = log.job?.customer?.postcode || null;

                  return (
                    <div key={log.id} className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${eventTone(
                                log.eventType
                              )}`}
                            >
                              {eventLabel(log.eventType)}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {formatDateTime(log.createdAt)}
                            </span>
                          </div>

                          <div className="mt-2 text-sm font-bold text-zinc-900">
                            {workerName}
                          </div>

                          <div className="mt-1 text-sm text-zinc-600">
                            {log.details || "No details"}
                          </div>

                          {jobTitle ? (
                            <div className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                              Job #{log.jobId}: {jobTitle}
                              {postcode ? ` · ${postcode}` : ""}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-xs font-semibold text-zinc-500">
                          {formatTime(log.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}