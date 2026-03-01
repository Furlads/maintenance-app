"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Worker = {
  id: string;
  name: string;
  phone: string;
  role?: string | null;
  photoUrl?: string | null;
  archivedAt?: string | null;
};

type Job = {
  id: string | number;
  title: string;
  address: string;
  postcode?: string | null;

  status: "todo" | "done" | "unscheduled";
  visitDate?: string | null; // ISO string or null
  startTime?: string | null; // "HH:MM" or null
  fixed?: boolean;

  assignedTo?: string | null; // (may be mixed-case depending on older data)
  durationMins?: number | null;
  overrunMins?: number | null;

  arrivedAt?: string | null;
  finishedAt?: string | null;

  createdAt?: string;
};

function decodeParam(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function lower(s: unknown) {
  return typeof s === "string" ? s.trim().toLowerCase() : "";
}

function isoDateOnlyLocal(d: Date) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function isSameDay(isoLike: string | null | undefined, dayKey: string) {
  if (!isoLike) return false;
  // Handles ISO like "2026-02-27T..." or "2026-02-27"
  return String(isoLike).slice(0, 10) === dayKey;
}

function niceTime(isoLike: string | null | undefined) {
  if (!isoLike) return "";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "W";
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
        background: "#fff",
        marginBottom: 14,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

function JobRow({ job }: { job: Job }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        background: "#fff",
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{job.title}</div>
        <div style={{ opacity: 0.8, marginBottom: 4 }}>
          Status: {job.status}
          {typeof job.durationMins === "number" ? ` • Duration: ${job.durationMins} mins` : ""}
          {job.startTime ? ` • ${job.startTime}` : ""}
        </div>
        <div style={{ opacity: 0.85 }}>{job.address}</div>
      </div>

      <div style={{ opacity: 0.65, fontSize: 12, whiteSpace: "nowrap" }}>
        #{String(job.id)}
      </div>
    </div>
  );
}

export default function WorkerDayViewPage({
  params,
}: {
  params: { name: string };
}) {
  const router = useRouter();
  const workerNameParam = decodeParam(params.name || "");
  const workerKey = lower(workerNameParam); // canonical key for scheduling endpoints

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoSchedBusy, setAutoSchedBusy] = useState(false);
  const [autoSchedTried, setAutoSchedTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayKey = useMemo(() => isoDateOnlyLocal(new Date()), []);
  const next7Keys = useMemo(() => {
    const base = new Date();
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      out.push(isoDateOnlyLocal(d));
    }
    return out;
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [wRes, jRes] = await Promise.all([
        fetch("/api/workers", { cache: "no-store" }),
        fetch("/api/jobs", { cache: "no-store" }),
      ]);

      if (!wRes.ok) throw new Error(`Workers failed: ${wRes.status}`);
      if (!jRes.ok) throw new Error(`Jobs failed: ${jRes.status}`);

      const wJson = await wRes.json();
      const jJson = await jRes.json();

      setWorkers(Array.isArray(wJson?.workers) ? wJson.workers : []);
      setJobs(Array.isArray(jJson) ? jJson : Array.isArray(jJson?.jobs) ? jJson.jobs : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.name]);

  const worker = useMemo(() => {
    const key = workerKey;
    return workers.find((w) => lower(w.name) === key) || null;
  }, [workers, workerKey]);

  const workerJobs = useMemo(() => {
    const key = workerKey;
    return jobs.filter((j) => lower(j.assignedTo) === key);
  }, [jobs, workerKey]);

  const dueToday = useMemo(() => {
    return workerJobs
      .filter((j) => j.status === "todo" && isSameDay(j.visitDate ?? null, todayKey))
      .sort((a, b) => String(a.startTime || "99:99").localeCompare(String(b.startTime || "99:99")));
  }, [workerJobs, todayKey]);

  const dueNext7 = useMemo(() => {
    return workerJobs
      .filter((j) => j.status === "todo" && next7Keys.includes(String(j.visitDate || "").slice(0, 10)))
      .sort((a, b) => {
        const da = String(a.visitDate || "");
        const db = String(b.visitDate || "");
        const c = da.localeCompare(db);
        if (c !== 0) return c;
        return String(a.startTime || "99:99").localeCompare(String(b.startTime || "99:99"));
      });
  }, [workerJobs, next7Keys]);

  const unscheduled = useMemo(() => {
    // Include jobs that are assigned (case-insensitive) to this worker but are unscheduled
    const key = workerKey;
    return jobs
      .filter((j) => j.status === "unscheduled" && lower(j.assignedTo) === key)
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  }, [jobs, workerKey]);

  async function normalizeAndRebuild() {
    if (autoSchedBusy) return;
    setAutoSchedBusy(true);

    try {
      // 1) Normalize assignedTo casing on any unscheduled jobs (this also triggers rebuild in PATCH route)
      // BUT we still run rebuild after to ensure placement is immediate & consistent.
      for (const j of unscheduled) {
        const current = lower(j.assignedTo);
        if (!current || current !== workerKey) {
          await fetch(`/api/jobs/${j.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignedTo: workerKey }),
          }).catch(() => null);
        }
      }

      // 2) Force a rebuild from today (puts unscheduled into next available slots)
      await fetch("/api/schedule/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker: workerKey, fromDate: todayKey, includeToday: true }),
      }).catch(() => null);

      // 3) Reload jobs after rebuild
      await loadAll();
    } finally {
      setAutoSchedBusy(false);
      setAutoSchedTried(true);
    }
  }

  // ✅ Auto-run once: if we have unscheduled jobs, try to persist-schedule them
  useEffect(() => {
    if (!worker) return;
    if (autoSchedTried) return;
    if (unscheduled.length === 0) return;

    normalizeAndRebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker?.id, unscheduled.length]);

  if (loading) {
    return (
      <main style={{ padding: 24, maxWidth: 980 }}>
        <h1 style={{ marginBottom: 8 }}>{workerNameParam}</h1>
        <div style={{ opacity: 0.7 }}>Loading…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24, maxWidth: 980 }}>
        <h1 style={{ marginBottom: 8 }}>{workerNameParam}</h1>
        <div style={{ color: "crimson", marginBottom: 12 }}>Error: {error}</div>
        <button
          onClick={() => loadAll()}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </main>
    );
  }

  if (!worker) {
    return (
      <main style={{ padding: 24, maxWidth: 980 }}>
        <h1 style={{ marginBottom: 8 }}>Worker not found</h1>
        <p style={{ opacity: 0.8 }}>
          Couldn’t find a worker named <b>{workerNameParam}</b>.
        </p>
        <button
          onClick={() => router.push("/admin/workers")}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Back to Workers
        </button>
      </main>
    );
  }

  const photo = worker.photoUrl || "";
  const phone = worker.phone || "";
  const role = worker.role || "";

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={worker.name}
              style={{ width: 44, height: 44, borderRadius: "999px", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "999px",
                background: "#111",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
              }}
            >
              {initials(worker.name)}
            </div>
          )}

          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{worker.name}</div>
            <div style={{ opacity: 0.75 }}>
              {role ? `${role} • ` : ""}
              {phone}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {phone ? (
            <>
              <a
                href={`tel:${phone}`}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #111827",
                  background: "#fff",
                  textDecoration: "none",
                  color: "#111",
                  fontWeight: 700,
                }}
              >
                Call
              </a>
              <a
                href={`https://wa.me/${phone.replace(/\s+/g, "")}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #111827",
                  background: "#fff",
                  textDecoration: "none",
                  color: "#111",
                  fontWeight: 700,
                }}
              >
                WhatsApp
              </a>
            </>
          ) : null}

          <button
            onClick={() => normalizeAndRebuild()}
            disabled={autoSchedBusy || unscheduled.length === 0}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: autoSchedBusy ? "#f3f4f6" : "#fff",
              cursor: autoSchedBusy ? "not-allowed" : "pointer",
              fontWeight: 700,
              opacity: unscheduled.length === 0 ? 0.5 : 1,
            }}
            title={unscheduled.length === 0 ? "No unscheduled jobs to place" : "Place unscheduled jobs into next slots"}
          >
            {autoSchedBusy ? "Auto-scheduling…" : "Auto-schedule"}
          </button>
        </div>
      </div>

      {/* Banner */}
      {dueToday.length === 0 ? (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 16,
            background: "#fff",
            marginBottom: 14,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Nothing assigned for today 👍</div>
          <div style={{ opacity: 0.75 }}>No upcoming scheduled jobs found.</div>
        </section>
      ) : null}

      {/* Today */}
      <Card title="Today">
        {dueToday.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No scheduled jobs today.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {dueToday.map((j) => (
              <JobRow key={String(j.id)} job={j} />
            ))}
          </div>
        )}
      </Card>

      {/* Next 7 days */}
      <Card title="Next 7 days">
        {dueNext7.length === 0 ? (
          <div style={{ opacity: 0.75 }}>Nothing scheduled in the next week.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {dueNext7.map((j) => (
              <div key={String(j.id)}>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                  {String(j.visitDate || "").slice(0, 10)}
                  {j.startTime ? ` • ${j.startTime}` : ""}
                </div>
                <JobRow job={j} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Unscheduled */}
      <Card title="Unscheduled jobs">
        {unscheduled.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No unscheduled jobs.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ opacity: 0.75, marginBottom: 6 }}>
              These will be auto-placed into the next available slots (and saved).
            </div>
            {unscheduled.map((j) => (
              <JobRow key={String(j.id)} job={j} />
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}