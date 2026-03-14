"use client";

import { useEffect, useMemo, useState } from "react";

type Job = {
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

type Worker = {
  id: number;
  name: string;
  jobs: Job[];
};

type ScheduleResponse = {
  date: string;
  workers: Worker[];
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

function formatRemaining(minutes: number) {
  if (minutes <= 30) return "FULL";

  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (hours === 0) return `${mins}m free`;
  if (mins === 0) return `${hours}h free`;

  return `${hours}h ${mins}m free`;
}

function getStatusLabel(status: string) {
  const cleanStatus = status.trim().toLowerCase();

  if (cleanStatus === "in_progress") return "In progress";
  if (cleanStatus === "done") return "Done";
  if (cleanStatus === "paused") return "Paused";
  if (cleanStatus === "unscheduled") return "Unscheduled";
  if (cleanStatus === "todo") return "To do";

  return status;
}

export default function SchedulePage() {
  const [date, setDate] = useState(getTodayDateString());
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const workers = useMemo(() => data?.workers ?? [], [data]);

  async function loadSchedule(selectedDate: string, isManualRefresh = false) {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const res = await fetch(`/api/schedule/day?date=${selectedDate}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to load schedule");
      }

      const json: ScheduleResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load schedule", err);
      setError("Failed to load schedule.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSchedule(date);
  }, [date]);

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              margin: 0,
              marginBottom: 6,
            }}
          >
            Schedule Board
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "#666",
            }}
          >
            Daily worker schedule from 09:00 to 16:30
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            htmlFor="schedule-date"
            style={{
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Date
          </label>

          <input
            id="schedule-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "8px 10px",
              fontSize: 14,
              border: "1px solid #ccc",
              borderRadius: 6,
              background: "#fff",
            }}
          />

          <button
            type="button"
            onClick={() => setDate(getTodayDateString())}
            style={{
              padding: "8px 12px",
              fontSize: 14,
              border: "1px solid #ccc",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => loadSchedule(date, true)}
            disabled={refreshing}
            style={{
              padding: "8px 12px",
              fontSize: 14,
              border: "1px solid #ccc",
              borderRadius: 6,
              background: "#fff",
              cursor: refreshing ? "default" : "pointer",
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div
        style={{
          marginBottom: 20,
          padding: "12px 14px",
          border: "1px solid #e5e5e5",
          borderRadius: 8,
          background: "#fafafa",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          fontSize: 13,
          color: "#555",
        }}
      >
        <span>
          <strong>Prep:</strong> 08:30–09:00 blocked
        </span>
        <span>
          <strong>Working day:</strong> 09:00–16:30
        </span>
        <span>
          <strong>Workers shown:</strong> active workers
        </span>
      </div>

      {loading && (
        <div
          style={{
            padding: 20,
            border: "1px solid #eee",
            borderRadius: 8,
            background: "#fff",
          }}
        >
          Loading schedule...
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            padding: 16,
            border: "1px solid #f0c7c7",
            borderRadius: 8,
            background: "#fff5f5",
            color: "#a33",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {workers.length === 0 && (
            <div
              style={{
                padding: 20,
                border: "1px solid #eee",
                borderRadius: 8,
                background: "#fff",
                color: "#666",
              }}
            >
              No active workers found.
            </div>
          )}

          {workers.map((worker) => {
            const scheduledMinutes = worker.jobs.reduce(
              (total, job) => total + (job.durationMinutes ?? 60),
              0
            );

            const remaining = TOTAL_DAY_MINUTES - scheduledMinutes;

            return (
              <div
                key={worker.id}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  background: "#fff",
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 18,
                      }}
                    >
                      {worker.name}
                    </h2>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 13,
                        color: "#666",
                      }}
                    >
                      {worker.jobs.length} job
                      {worker.jobs.length === 1 ? "" : "s"} scheduled
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#555",
                    }}
                  >
                    {formatRemaining(remaining)}
                  </div>
                </div>

                <div
                  style={{
                    position: "relative",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    height: 86,
                    background: "#f9f9f9",
                    overflow: "hidden",
                  }}
                >
                  {TIMELINE_HOURS.map((hour) => {
                    const left =
                      ((hour * 60 - DAY_START_MINUTES) / TOTAL_DAY_MINUTES) *
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
                          background: "#ddd",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 6,
                            left: 6,
                            fontSize: 11,
                            color: "#777",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {hour}:00
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

                    return (
                      <div
                        key={job.id}
                        title={`${job.startTime ?? "TBD"} • ${job.title} • ${
                          job.customerName
                        } • ${job.postcode ?? ""}`}
                        style={{
                          position: "absolute",
                          left: `${left}%`,
                          width: `${width}%`,
                          top: 26,
                          height: 48,
                          background: "#e8f3ff",
                          border: "1px solid #8db6ff",
                          borderRadius: 6,
                          padding: "6px 8px",
                          overflow: "hidden",
                          fontSize: 12,
                          boxSizing: "border-box",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {job.startTime ?? "TBD"} {job.title}
                        </div>

                        <div
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {job.customerName}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: "#555",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {job.postcode ?? "No postcode"} •{" "}
                          {job.durationMinutes ?? 60}m •{" "}
                          {getStatusLabel(job.status)}
                        </div>
                      </div>
                    );
                  })}

                  {worker.jobs.length === 0 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 12,
                        top: 34,
                        fontSize: 13,
                        color: "#888",
                      }}
                    >
                      No jobs scheduled
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}