// app/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Worker = {
  id: string;
  name: string;
  role?: string | null;
  photoUrl?: string | null;
  archivedAt?: string | null;
};

type Job = {
  id: string;
  title: string;
  address: string;
  postcode: string;
  status: "todo" | "done" | "unscheduled";
  visitDate?: string | null;
  startTime?: string | null;
  assignedTo: string;
  arrivedAt?: string | null;
  finishedAt?: string | null;
};

type Status = "red" | "amber" | "green" | "grey";

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfToday() {
  const d = startOfToday();
  const e = new Date(d);
  e.setDate(e.getDate() + 1);
  return e;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function normalizeAssignedTo(v: string) {
  return String(v || "").trim().toLowerCase();
}

function workerKeyFromName(name: string) {
  const n = String(name || "").toLowerCase();
  if (n.includes("trevor")) return "trev";
  if (n.includes("kelly")) return "kelly";
  if (n.includes("stephen") || n.includes("steve")) return "stephen";
  if (n.includes("jacob")) return "jacob";
  return normalizeAssignedTo(name);
}

function ragStyle(status: Status): React.CSSProperties {
  if (status === "red") return { background: "#ffe6e6", border: "1px solid #ffb3b3" };
  if (status === "amber") return { background: "#fff3cd", border: "1px solid #ffeeba" };
  if (status === "green") return { background: "#ddffdd", border: "1px solid #aaffaa" };
  return { background: "#f5f5f5", border: "1px solid #ddd" };
}

export default function AdminDashboardPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const t0 = useMemo(() => startOfToday(), []);
  const t1 = useMemo(() => endOfToday(), []);

  async function loadAll() {
    setLoading(true);
    setMsg("");

    try {
      const [wRes, jRes] = await Promise.all([
        fetch("/api/workers", { cache: "no-store" }),
        fetch("/api/jobs", { cache: "no-store" }),
      ]);

      const wData = await wRes.json().catch(() => []);
      const jData = await jRes.json().catch(() => []);

      if (!wRes.ok) throw new Error(wData?.error || "Failed to load workers");
      if (!jRes.ok) throw new Error(jData?.error || "Failed to load jobs");

      const wList = Array.isArray(wData) ? wData : Array.isArray(wData.workers) ? wData.workers : [];
      const jList = Array.isArray(jData) ? jData : Array.isArray(jData.jobs) ? jData.jobs : [];

      setWorkers(wList.filter((w: Worker) => !w.archivedAt));
      setJobs(jList);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load dashboard");
      setWorkers([]);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byWorker = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const j of jobs) {
      const k = normalizeAssignedTo(j.assignedTo);
      if (!k) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(j);
    }
    return map;
  }, [jobs]);

  function computeStatus(list: Job[]) {
    // Consider only scheduled TODO jobs
    const scheduledTodo = list.filter((j) => j.status === "todo" && j.visitDate);
    const overdueTodo = scheduledTodo.filter((j) => {
      const d = new Date(j.visitDate as string);
      return d < t0 && !isSameDay(d, new Date());
    });

    const todayTodo = scheduledTodo.filter((j) => {
      const d = new Date(j.visitDate as string);
      return d >= t0 && d < t1;
    });

    const todayDone = list.filter((j) => {
      if (j.status !== "done" || !j.visitDate) return false;
      const d = new Date(j.visitDate);
      return d >= t0 && d < t1;
    });

    const arrivedCount = todayTodo.filter((j) => !!j.arrivedAt).length;
    const finishedCount = todayTodo.filter((j) => !!j.finishedAt).length;

    // RAG logic:
    // - Red: any overdue todo
    // - Amber: has todo today but not all finished
    // - Green: has jobs today and all finished OR has done today and no todo
    // - Grey: nothing today
    let status: Status = "grey";

    if (overdueTodo.length > 0) status = "red";
    else if (todayTodo.length > 0 && finishedCount < todayTodo.length) status = "amber";
    else if (todayTodo.length > 0 && finishedCount === todayTodo.length) status = "green";
    else if (todayDone.length > 0) status = "green";

    return {
      status,
      overdueTodo: overdueTodo.length,
      todayTodo: todayTodo.length,
      todayDone: todayDone.length,
      arrivedCount,
      finishedCount,
    };
  }

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Admin Dashboard</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Live status (red/amber/green) from today’s jobs + check-ins.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={loadAll}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc" }}
          >
            Refresh
          </button>

          <a href="/admin/workers" style={{ alignSelf: "center" }}>
            Workers
          </a>

          <a href="/settings" style={{ alignSelf: "center" }}>
            Settings
          </a>
        </div>
      </div>

      {msg ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}>{msg}</div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 14 }}>Loading dashboard…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 14 }}>
          {workers.map((w) => {
            const key = workerKeyFromName(w.name);
            const list = byWorker.get(key) ?? [];
            const s = computeStatus(list);

            return (
              <div
                key={w.id}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  ...ragStyle(s.status),
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {w.photoUrl ? (
                    // Uses stored path like /uploads/xxx.jpg
                    <img
                      src={w.photoUrl}
                      alt={w.name}
                      style={{ width: 52, height: 52, borderRadius: 999, objectFit: "cover", border: "1px solid rgba(0,0,0,0.15)" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 999,
                        border: "1px solid rgba(0,0,0,0.15)",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 900,
                        background: "#fff",
                      }}
                    >
                      {(w.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.1 }}>{w.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      Role: <b>{w.role || "worker"}</b>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.4 }}>
                  <div>
                    Today TODO: <b>{s.todayTodo}</b> • Done today: <b>{s.todayDone}</b>
                  </div>
                  <div>
                    Checked-in: <b>{s.arrivedCount}</b> • Finished: <b>{s.finishedCount}</b>
                  </div>
                  <div>
                    Overdue TODO: <b>{s.overdueTodo}</b>
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                  Status:{" "}
                  <b style={{ textTransform: "uppercase" }}>
                    {s.status === "grey" ? "none" : s.status}
                  </b>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}