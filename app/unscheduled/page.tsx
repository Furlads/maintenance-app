"use client";

import { useEffect, useMemo, useState } from "react";

type Job = {
  id: number;
  title: string;
  address: string;
  status: string;
  visitDate: string | null;
  startTime: string | null;
  assignedTo: string | null;
  notesLog: string;
  durationMins: number;
  fixed: boolean;
  recurrenceActive: boolean;
  recurrenceEveryWeeks: number | null;
  recurrenceDurationMins: number | null;
  recurrencePreferredDOW: number | null;
  recurrencePreferredTime: string | null;
};

type Worker = {
  id: number;
  name: string;
  company: string;
  role: string | null;
  active: boolean;
};

function isoDateOnly(d: Date) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function cleanLower(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

export default function UnscheduledPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [openJobId, setOpenJobId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const [defaultWorker, setDefaultWorker] = useState("");
  const [fixedDate, setFixedDate] = useState<string>(isoDateOnly(new Date()));
  const [fixedTime, setFixedTime] = useState<string>("09:00");
  const [durationMins, setDurationMins] = useState<number>(60);
  const [recurrenceActive, setRecurrenceActive] = useState<boolean>(false);
  const [recurrenceEveryWeeks, setRecurrenceEveryWeeks] = useState<number>(2);
  const [recurrenceDurationMins, setRecurrenceDurationMins] = useState<number>(60);
  const [overrideWorker, setOverrideWorker] = useState<string>("");

  async function loadJobs() {
    const res = await fetch("/api/jobs", { cache: "no-store" });
    const data = await res.json();
    setJobs(data);
  }

  async function loadWorkers() {
    const res = await fetch("/api/workers", { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || data?.error || "Failed to load workers");
    }

    const nextWorkers = Array.isArray(data) ? data : [];
    setWorkers(nextWorkers);

    if (!defaultWorker && nextWorkers.length > 0) {
      setDefaultWorker(nextWorkers[0].name.trim().toLowerCase());
    }
  }

  useEffect(() => {
    loadJobs();
    loadWorkers().catch((err) => {
      console.error(err);
      alert("Failed to load workers");
    });
  }, []);

  const unscheduled = useMemo(() => {
    return jobs
      .filter((j) => j.status === "unscheduled" || j.visitDate === null)
      .sort((a, b) => b.id - a.id);
  }, [jobs]);

  async function rebuildDiary(worker: string) {
    await fetch("/api/schedule/rebuild", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        worker,
        fromDate: isoDateOnly(new Date()),
        includeToday: true,
      }),
    });
  }

  function resolveWorkerForJob(job: Job) {
    const existing = cleanLower(job.assignedTo);
    if (existing) return existing;

    const over = cleanLower(overrideWorker);
    if (over) return over;

    return cleanLower(defaultWorker);
  }

  async function scheduleEconomically(job: Job) {
    const w = resolveWorkerForJob(job);
    if (!w) return alert("Pick a worker first");

    setBusy(job.id);

    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedTo: w,
        status: "unscheduled",
        fixed: false,
        startTime: null,
        durationMins,
        recurrenceActive,
        recurrenceEveryWeeks,
        recurrenceDurationMins,
        recurrencePreferredTime: null,
      }),
    });

    if (!res.ok) {
      setBusy(null);
      const txt = await res.text().catch(() => "");
      return alert(`Failed: ${res.status} ${txt}`);
    }

    await rebuildDiary(w);

    setBusy(null);
    setOpenJobId(null);
    setOverrideWorker("");
    loadJobs();
  }

  async function customerInsists(job: Job) {
    const w = resolveWorkerForJob(job);
    if (!w) return alert("Pick a worker first");

    setBusy(job.id);

    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedTo: w,
        visitDate: fixedDate,
        startTime: fixedTime,
        fixed: true,
        status: "todo",
        durationMins,
        recurrenceActive,
        recurrenceEveryWeeks,
        recurrenceDurationMins,
        recurrencePreferredTime: fixedTime,
      }),
    });

    if (!res.ok) {
      setBusy(null);
      const txt = await res.text().catch(() => "");
      return alert(`Failed: ${res.status} ${txt}`);
    }

    await rebuildDiary(w);

    setBusy(null);
    setOpenJobId(null);
    setOverrideWorker("");
    loadJobs();
  }

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <h1>Unscheduled Jobs (Kelly)</h1>
      <p style={{ opacity: 0.8 }}>
        If a job already has a worker from <b>/my-visits</b>, this page will keep it. You only pick a worker again if it
        wasn’t assigned yet.
      </p>

      <div
        style={{
          padding: 14,
          border: "1px solid #ddd",
          borderRadius: 12,
          marginBottom: 16,
          background: "#fff",
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
            Default worker (only used if job has no assignedTo)
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {workers.map((worker) => {
              const value = worker.name.trim().toLowerCase();

              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => setDefaultWorker(value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: defaultWorker === value ? "2px solid #000" : "1px solid #ddd",
                    background: "#fff",
                    textTransform: "capitalize",
                    fontWeight: 700,
                  }}
                >
                  {worker.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Job duration (mins)</div>
          <input
            type="number"
            value={durationMins}
            onChange={(e) => setDurationMins(Number(e.target.value))}
            style={{ padding: 10, width: 140, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>

        <div style={{ minWidth: 260 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={recurrenceActive}
              onChange={(e) => setRecurrenceActive(e.target.checked)}
            />
            <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 700 }}>Recurring job?</span>
          </div>

          {recurrenceActive ? (
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Every (weeks)</div>
                <input
                  type="number"
                  value={recurrenceEveryWeeks}
                  onChange={(e) => setRecurrenceEveryWeeks(Number(e.target.value))}
                  style={{ padding: 10, width: 120, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>For (mins)</div>
                <input
                  type="number"
                  value={recurrenceDurationMins}
                  onChange={(e) => setRecurrenceDurationMins(Number(e.target.value))}
                  style={{ padding: 10, width: 120, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ marginLeft: "auto" }}>
          <button onClick={loadJobs} style={{ padding: "10px 12px", borderRadius: 10 }}>
            Refresh
          </button>
        </div>
      </div>

      <h2>Unscheduled list ({unscheduled.length})</h2>

      {unscheduled.length === 0 ? (
        <p>None 🎉</p>
      ) : (
        unscheduled.map((job) => {
          const assigned = cleanLower(job.assignedTo);
          const effective = resolveWorkerForJob(job);

          return (
            <div
              key={job.id}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                marginBottom: 12,
                background: "#fff",
              }}
            >
              <div
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setOpenJobId(openJobId === job.id ? null : job.id);
                  setOverrideWorker("");
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <strong>{job.title}</strong>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>{String(job.status).toUpperCase()}</span>
                </div>

                <div style={{ marginTop: 6 }}>
                  <b>Address:</b> {job.address || "(no address yet)"}
                </div>

                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                  Assigned (from My Visits): <b>{assigned || "NOT SET"}</b>
                  {" • "}
                  Will schedule as: <b>{effective || "pick worker"}</b>
                </div>
              </div>

              {openJobId === job.id ? (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#f7f7f7" }}>
                  {!assigned ? (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                        This job has no worker yet — type one or use the default buttons above
                      </div>
                      <input
                        value={overrideWorker}
                        onChange={(e) => setOverrideWorker(e.target.value)}
                        placeholder="Type worker name"
                        style={{ padding: 10, width: 220, borderRadius: 10, border: "1px solid #ddd" }}
                      />
                    </div>
                  ) : null}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => scheduleEconomically(job)}
                      disabled={busy === job.id}
                      style={{ padding: "10px 12px", borderRadius: 10, fontWeight: 700 }}
                    >
                      {busy === job.id ? "Working..." : `Schedule Economically (${effective})`}
                    </button>
                  </div>

                  <div style={{ marginTop: 12, borderTop: "1px solid #ddd", paddingTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Customer insists on date/time</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                      <div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>Date</div>
                        <input
                          type="date"
                          value={fixedDate}
                          onChange={(e) => setFixedDate(e.target.value)}
                          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>Time</div>
                        <input
                          type="time"
                          value={fixedTime}
                          onChange={(e) => setFixedTime(e.target.value)}
                          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                        />
                      </div>

                      <button
                        onClick={() => customerInsists(job)}
                        disabled={busy === job.id}
                        style={{ padding: "10px 12px", borderRadius: 10 }}
                      >
                        {busy === job.id ? "Working..." : "Lock & Reshuffle"}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Notes history</div>
                    {job.notesLog ? (
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{job.notesLog}</pre>
                    ) : (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>No notes yet.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </main>
  );
}