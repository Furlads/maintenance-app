"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type ScheduleResponse = {
  date: string;
  workers: ScheduleWorker[];
};

type JobsApiJob = {
  id: number;
  title: string;
  address: string;
  status: string;
  jobType: string;
  startTime: string | null;
  visitDate: string | null;
  durationMinutes: number | null;
  createdAt: string;
  customer: {
    name: string | null;
    postcode?: string | null;
  } | null;
  assignments: Array<{
    worker: {
      firstName: string;
      lastName: string;
    };
  }>;
};

const DAY_START_MINUTES = 9 * 60;
const DAY_END_MINUTES = 16 * 60 + 30;
const TOTAL_DAY_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES;
const TIMELINE_HOURS = [9, 10, 11, 12, 13, 14, 15, 16];

function getTodayDateString() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

function parseTimeToMinutes(time: string | null) {
  if (!time) return null;

  const parts = time.split(":").map(Number);
  if (parts.length !== 2) return null;

  const [hours, minutes] = parts;

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatStatus(status: string) {
  const clean = String(status || "").trim().toLowerCase();

  if (clean === "in_progress") return "In progress";
  if (clean === "done") return "Done";
  if (clean === "paused") return "Paused";
  if (clean === "unscheduled") return "Unscheduled";
  if (clean === "todo") return "To do";
  if (clean === "quoted") return "Quoted";

  return status || "Unknown";
}

function formatJobType(jobType: string) {
  const value = String(jobType || "").trim();
  return value || "General";
}

function formatRemaining(minutes: number) {
  if (minutes <= 30) return "FULL";

  const safe = Math.max(0, minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;

  if (hours === 0) return `${mins}m free`;
  if (mins === 0) return `${hours}h free`;

  return `${hours}h ${mins}m free`;
}

function formatDate(date: string | null) {
  if (!date) return "Not scheduled";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatWorkers(
  assignments: Array<{
    worker: {
      firstName: string;
      lastName: string;
    };
  }>
) {
  if (!assignments || assignments.length === 0) return "Unassigned";

  return assignments
    .map((assignment) =>
      `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim()
    )
    .join(", ");
}

function getStatusBadgeStyle(status: string): React.CSSProperties {
  const value = String(status || "").toLowerCase();

  if (value === "done") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (value === "in_progress") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }

  if (value === "paused") {
    return {
      background: "#ffedd5",
      color: "#9a3412",
      border: "1px solid #fed7aa",
    };
  }

  if (value === "quoted") {
    return {
      background: "#f3e8ff",
      color: "#7e22ce",
      border: "1px solid #e9d5ff",
    };
  }

  if (value === "unscheduled") {
    return {
      background: "#f4f4f5",
      color: "#3f3f46",
      border: "1px solid #e4e4e7",
    };
  }

  return {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
  };
}

function getJobTypeBadgeStyle(jobType: string): React.CSSProperties {
  const value = String(jobType || "").toLowerCase();

  if (value.includes("maint")) {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (value.includes("land")) {
    return {
      background: "#e0f2fe",
      color: "#075985",
      border: "1px solid #bae6fd",
    };
  }

  if (value.includes("quote")) {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    };
  }

  if (value.includes("prep")) {
    return {
      background: "#e5e7eb",
      color: "#374151",
      border: "1px solid #d1d5db",
    };
  }

  return {
    background: "#f4f4f5",
    color: "#3f3f46",
    border: "1px solid #e4e4e7",
  };
}

function getCardColor(job: ScheduleJob): {
  background: string;
  border: string;
} {
  const jobType = String(job.jobType || "").toLowerCase();
  const status = String(job.status || "").toLowerCase();

  if (status === "done") {
    return {
      background: "#dcfce7",
      border: "#86efac",
    };
  }

  if (status === "in_progress") {
    return {
      background: "#dbeafe",
      border: "#93c5fd",
    };
  }

  if (status === "paused") {
    return {
      background: "#ffedd5",
      border: "#fdba74",
    };
  }

  if (jobType.includes("quote")) {
    return {
      background: "#fef3c7",
      border: "#fcd34d",
    };
  }

  if (jobType.includes("maint")) {
    return {
      background: "#dcfce7",
      border: "#86efac",
    };
  }

  if (jobType.includes("land")) {
    return {
      background: "#e0f2fe",
      border: "#7dd3fc",
    };
  }

  if (jobType.includes("prep")) {
    return {
      background: "#f3f4f6",
      border: "#d1d5db",
    };
  }

  return {
    background: "#e8f3ff",
    border: "#8db6ff",
  };
}

function sortUnscheduledJobs(a: JobsApiJob, b: JobsApiJob) {
  const maintenanceA = String(a.jobType || "").toLowerCase().includes("maint")
    ? 0
    : 1;
  const maintenanceB = String(b.jobType || "").toLowerCase().includes("maint")
    ? 0
    : 1;

  if (maintenanceA !== maintenanceB) {
    return maintenanceA - maintenanceB;
  }

  const assignedA = a.assignments.length > 0 ? 0 : 1;
  const assignedB = b.assignments.length > 0 ? 0 : 1;

  if (assignedA !== assignedB) {
    return assignedA - assignedB;
  }

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export default function SchedulePage() {
  const [date, setDate] = useState(getTodayDateString());
  const [scheduleData, setScheduleData] = useState<ScheduleResponse | null>(null);
  const [jobsData, setJobsData] = useState<JobsApiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [error, setError] = useState("");

  const workers = useMemo(() => scheduleData?.workers ?? [], [scheduleData]);

  const unscheduledJobs = useMemo(() => {
    return jobsData
      .filter((job) => {
        const status = String(job.status || "").toLowerCase();
        return (
          status === "unscheduled" ||
          ((status === "todo" || status === "scheduled") && !job.visitDate)
        );
      })
      .sort(sortUnscheduledJobs);
  }, [jobsData]);

  const scheduledJobCount = useMemo(() => {
    return workers.reduce((total, worker) => total + worker.jobs.length, 0);
  }, [workers]);

  const totalScheduledMinutes = useMemo(() => {
    return workers.reduce(
      (total, worker) =>
        total +
        worker.jobs.reduce(
          (jobTotal, job) => jobTotal + (job.durationMinutes ?? 60),
          0
        ),
      0
    );
  }, [workers]);

  async function loadPage(selectedDate: string, isManualRefresh = false) {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [scheduleRes, jobsRes] = await Promise.all([
        fetch(`/api/schedule/day?date=${selectedDate}`, {
          cache: "no-store",
        }),
        fetch(`/api/jobs`, {
          cache: "no-store",
        }),
      ]);

      if (!scheduleRes.ok) {
        throw new Error("Failed to load schedule");
      }

      if (!jobsRes.ok) {
        throw new Error("Failed to load jobs");
      }

      const scheduleJson: ScheduleResponse = await scheduleRes.json();
      const jobsJson: JobsApiJob[] = await jobsRes.json();

      setScheduleData(scheduleJson);
      setJobsData(Array.isArray(jobsJson) ? jobsJson : []);
    } catch (err) {
      console.error("Failed to load schedule page", err);
      setError(
        err instanceof Error ? err.message : "Failed to load schedule page."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRunScheduler() {
    if (runningScheduler) return;

    setRunningScheduler(true);
    setError("");

    try {
      const res = await fetch("/api/scheduler/run", {
        method: "POST",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Scheduler failed");
      }

      await loadPage(date, true);
      window.alert(
        data?.scheduled > 0
          ? `${data.scheduled} job${data.scheduled === 1 ? "" : "s"} placed into the diary.`
          : data?.message || "No unscheduled jobs found."
      );
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Scheduler failed to run.";
      setError(message);
      window.alert(message);
    } finally {
      setRunningScheduler(false);
    }
  }

  useEffect(() => {
    loadPage(date);
  }, [date]);

  return (
    <main style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: 24,
        }}
      >
        <section
          style={{
            overflow: "hidden",
            borderRadius: 24,
            border: "1px solid #e5e7eb",
            background: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background: "#18181b",
              color: "#fff",
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                alignItems: "end",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#facc15",
                    marginBottom: 8,
                  }}
                >
                  Furlads Scheduler
                </div>

                <h1
                  style={{
                    fontSize: 34,
                    lineHeight: 1.1,
                    margin: 0,
                    marginBottom: 10,
                  }}
                >
                  Schedule Board
                </h1>

                <p
                  style={{
                    margin: 0,
                    maxWidth: 760,
                    color: "#d4d4d8",
                    fontSize: 15,
                  }}
                >
                  Office control for the day. See worker timelines, scheduled
                  work and everything still waiting to be placed into the diary.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Link href="/admin" style={headerSecondaryButton()}>
                  Back to Dashboard
                </Link>

                <Link href="/jobs" style={headerSecondaryButton()}>
                  Open Jobs
                </Link>

                <button
                  type="button"
                  onClick={handleRunScheduler}
                  disabled={runningScheduler}
                  style={{
                    ...headerPrimaryButton(),
                    opacity: runningScheduler ? 0.7 : 1,
                    cursor: runningScheduler ? "default" : "pointer",
                  }}
                >
                  {runningScheduler ? "Scheduling..." : "Auto schedule jobs"}
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              background: "#fafafa",
              padding: 16,
              display: "flex",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <label
                htmlFor="schedule-date"
                style={{ fontSize: 14, fontWeight: 700, color: "#27272a" }}
              >
                Date
              </label>

              <input
                id="schedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle()}
              />

              <button
                type="button"
                onClick={() => setDate(getTodayDateString())}
                style={toolbarButton()}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => loadPage(date, true)}
                disabled={refreshing}
                style={{
                  ...toolbarButton(),
                  opacity: refreshing ? 0.7 : 1,
                  cursor: refreshing ? "default" : "pointer",
                }}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#52525b",
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <span>
                <strong>Prep:</strong> 08:30–09:00
              </span>
              <span>
                <strong>Working day:</strong> 09:00–16:30
              </span>
              <span>
                <strong>Farm start:</strong> TF9 4BQ
              </span>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard label="Active workers" value={workers.length} />
          <StatCard label="Scheduled jobs" value={scheduledJobCount} />
          <StatCard
            label="Scheduled hours"
            value={`${(totalScheduledMinutes / 60).toFixed(1)}h`}
          />
          <StatCard
            label="Needs scheduling"
            value={unscheduledJobs.length}
            accent="#b45309"
          />
        </section>

        {loading && (
          <div style={messageCard()}>
            <div style={{ fontWeight: 700 }}>Loading schedule...</div>
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              ...messageCard(),
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#9f1239",
            }}
          >
            <div style={{ fontWeight: 700 }}>Something went wrong</div>
            <div style={{ marginTop: 6 }}>{error}</div>
          </div>
        )}

        {!loading && !error && (
          <>
            <section style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>Worker timelines</h2>
                  <div style={{ marginTop: 4, color: "#71717a", fontSize: 14 }}>
                    Scheduled work for {formatDate(scheduleData?.date ?? date)}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                {workers.length === 0 && (
                  <div style={messageCard()}>
                    No active workers found.
                  </div>
                )}

                {workers.map((worker) => {
                  const scheduledMinutes = worker.jobs.reduce(
                    (total, job) => total + (job.durationMinutes ?? 60),
                    0
                  );

                  const remainingMinutes = TOTAL_DAY_MINUTES - scheduledMinutes;

                  return (
                    <div key={worker.id} style={workerCard()}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 14,
                        }}
                      >
                        <div>
                          <h3 style={{ margin: 0, fontSize: 18 }}>
                            {worker.name}
                          </h3>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 13,
                              color: "#71717a",
                            }}
                          >
                            {worker.jobs.length} job
                            {worker.jobs.length === 1 ? "" : "s"} scheduled
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#3f3f46",
                          }}
                        >
                          {formatRemaining(remainingMinutes)}
                        </div>
                      </div>

                      <div
                        style={{
                          position: "relative",
                          border: "1px solid #d4d4d8",
                          borderRadius: 10,
                          height: 110,
                          background: "#fafafa",
                          overflow: "hidden",
                        }}
                      >
                        {TIMELINE_HOURS.map((hour) => {
                          const left =
                            ((hour * 60 - DAY_START_MINUTES) /
                              TOTAL_DAY_MINUTES) *
                            100;

                          return (
                            <div
                              key={hour}
                              style={{
                                position: "absolute",
                                left: `${left}%`,
                                top: 0,
                                bottom: 0,
                                width: 1,
                                background: "#e4e4e7",
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  top: 8,
                                  left: 6,
                                  fontSize: 11,
                                  color: "#71717a",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {String(hour).padStart(2, "0")}:00
                              </div>
                            </div>
                          );
                        })}

                        {worker.jobs.map((job) => {
                          const start = parseTimeToMinutes(job.startTime);
                          const duration = job.durationMinutes ?? 60;

                          if (start === null) return null;

                          const clampedStart = Math.max(start, DAY_START_MINUTES);
                          const left =
                            ((clampedStart - DAY_START_MINUTES) /
                              TOTAL_DAY_MINUTES) *
                            100;

                          const width =
                            (Math.max(duration, 30) / TOTAL_DAY_MINUTES) * 100;

                          const cardColor = getCardColor(job);

                          return (
                            <Link
                              key={job.id}
                              href={`/jobs/${job.id}`}
                              title={`${job.startTime ?? "TBD"} • ${job.title} • ${
                                job.customerName
                              } • ${job.postcode ?? ""}`}
                              style={{
                                position: "absolute",
                                left: `${left}%`,
                                width: `${width}%`,
                                top: 30,
                                height: 64,
                                background: cardColor.background,
                                border: `1px solid ${cardColor.border}`,
                                borderRadius: 8,
                                padding: "8px 10px",
                                overflow: "hidden",
                                fontSize: 12,
                                boxSizing: "border-box",
                                textDecoration: "none",
                                color: "#18181b",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 800,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  marginBottom: 2,
                                }}
                              >
                                {job.startTime ?? "TBD"} • {job.title}
                              </div>

                              <div
                                style={{
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  marginBottom: 2,
                                }}
                              >
                                {job.customerName || "No customer"}
                              </div>

                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#52525b",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {job.postcode ?? "No postcode"} • {duration}m •{" "}
                                {formatStatus(job.status)}
                              </div>
                            </Link>
                          );
                        })}

                        {worker.jobs.length === 0 && (
                          <div
                            style={{
                              position: "absolute",
                              left: 14,
                              top: 44,
                              fontSize: 13,
                              color: "#71717a",
                            }}
                          >
                            No jobs scheduled for this worker.
                          </div>
                        )}
                      </div>

                      {worker.jobs.length > 0 && (
                        <div
                          style={{
                            marginTop: 14,
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          {worker.jobs.map((job) => (
                            <Link
                              key={`list-${worker.id}-${job.id}`}
                              href={`/jobs/${job.id}`}
                              style={{
                                textDecoration: "none",
                                color: "inherit",
                              }}
                            >
                              <div style={jobRowCard()}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    flexWrap: "wrap",
                                    marginBottom: 8,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      flexWrap: "wrap",
                                      alignItems: "center",
                                    }}
                                  >
                                    <span
                                      style={{
                                        ...pillBase(),
                                        ...getJobTypeBadgeStyle(job.jobType),
                                      }}
                                    >
                                      {formatJobType(job.jobType)}
                                    </span>

                                    <span
                                      style={{
                                        ...pillBase(),
                                        ...getStatusBadgeStyle(job.status),
                                      }}
                                    >
                                      {formatStatus(job.status)}
                                    </span>
                                  </div>

                                  <div
                                    style={{
                                      fontWeight: 800,
                                      color: "#18181b",
                                    }}
                                  >
                                    {job.startTime ?? "No time"} •{" "}
                                    {job.durationMinutes ?? 60} mins
                                  </div>
                                </div>

                                <div
                                  style={{
                                    fontWeight: 800,
                                    marginBottom: 4,
                                  }}
                                >
                                  {job.customerName || "No customer"} — {job.title}
                                </div>

                                <div
                                  style={{
                                    fontSize: 13,
                                    color: "#52525b",
                                  }}
                                >
                                  {job.address || "No address"}{" "}
                                  {job.postcode ? `• ${job.postcode}` : ""}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#fff",
                padding: 18,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>Needs scheduling</h2>
                  <div
                    style={{
                      marginTop: 4,
                      color: "#71717a",
                      fontSize: 14,
                    }}
                  >
                    Jobs waiting to be fitted into the diary
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#92400e",
                  }}
                >
                  {unscheduledJobs.length} waiting
                </div>
              </div>

              {unscheduledJobs.length === 0 ? (
                <div
                  style={{
                    border: "1px dashed #d4d4d8",
                    borderRadius: 12,
                    padding: 18,
                    color: "#71717a",
                    background: "#fafafa",
                  }}
                >
                  Nothing waiting to be scheduled 🎉
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {unscheduledJobs.map((job) => (
                    <div key={job.id} style={unscheduledCard()}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          alignItems: "start",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              alignItems: "center",
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                ...pillBase(),
                                ...getJobTypeBadgeStyle(job.jobType),
                              }}
                            >
                              {formatJobType(job.jobType)}
                            </span>

                            <span
                              style={{
                                ...pillBase(),
                                ...getStatusBadgeStyle(job.status),
                              }}
                            >
                              {formatStatus(job.status)}
                            </span>
                          </div>

                          <div
                            style={{
                              fontWeight: 800,
                              marginBottom: 4,
                              fontSize: 16,
                            }}
                          >
                            {job.customer?.name || "No customer"} — {job.title}
                          </div>

                          <div
                            style={{
                              color: "#52525b",
                              fontSize: 14,
                              marginBottom: 6,
                            }}
                          >
                            {job.address || "No address"}{" "}
                            {job.customer?.postcode
                              ? `• ${job.customer.postcode}`
                              : ""}
                          </div>

                          <div
                            style={{
                              color: "#71717a",
                              fontSize: 13,
                            }}
                          >
                            Expected: {job.durationMinutes ?? 60} mins • Assigned:{" "}
                            {formatWorkers(job.assignments)}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <Link href={`/jobs/${job.id}`} style={smallButton()}>
                            Open job
                          </Link>

                          <Link
                            href={`/jobs/edit/${job.id}`}
                            style={smallPrimaryButton()}
                          >
                            Edit / place
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#fff",
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#71717a",
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: accent || "#18181b",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function headerSecondaryButton(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    border: "1px solid #3f3f46",
    background: "#27272a",
    color: "#fff",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
    padding: "12px 14px",
  };
}

function headerPrimaryButton(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    border: "1px solid #facc15",
    background: "#facc15",
    color: "#18181b",
    fontSize: 14,
    fontWeight: 800,
    padding: "12px 14px",
  };
}

function toolbarButton(): React.CSSProperties {
  return {
    padding: "9px 12px",
    fontSize: 14,
    border: "1px solid #d4d4d8",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  };
}

function inputStyle(): React.CSSProperties {
  return {
    padding: "9px 12px",
    fontSize: 14,
    border: "1px solid #d4d4d8",
    borderRadius: 10,
    background: "#fff",
    color: "#18181b",
  };
}

function messageCard(): React.CSSProperties {
  return {
    padding: 18,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    marginBottom: 20,
  };
}

function workerCard(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    padding: 18,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  };
}

function jobRowCard(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fafafa",
    padding: 12,
  };
}

function unscheduledCard(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#fafafa",
    padding: 14,
  };
}

function pillBase(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 800,
  };
}

function smallButton(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: "1px solid #d4d4d8",
    background: "#fff",
    color: "#18181b",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 700,
    padding: "10px 12px",
  };
}

function smallPrimaryButton(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: "1px solid #18181b",
    background: "#18181b",
    color: "#fff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 700,
    padding: "10px 12px",
  };
}