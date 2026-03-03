"use client";

import { useEffect, useMemo, useState } from "react";

type Worker = {
  id: number;
  key: string;
  displayName: string;
  active: boolean;
  sortOrder: number;
};

type Business = {
  id: number;
  name: string;
  dayStart: string;
  dayEnd: string;
  prepMins: number;
};

type Job = {
  id: number;
  title: string;
  address: string;
  status: string;
  visitDate: string | null;
  startTime: string | null;
  assignedTo: string | null;
  durationMins: number;
  overrunMins: number;
  fixed: boolean;
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function gbDate(d: Date) {
  return d.toLocaleDateString("en-GB");
}

function isoDateOnly(d: Date) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function cleanLower(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

export default function KellyCombinedDashboard() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [err, setErr] = useState("");

  async function loadAll() {
    setErr("");
    try {
      const [wRes, bRes, jRes] = await Promise.all([
        fetch("/api/workers", { cache: "no-store" }),
        fetch("/api/business", { cache: "no-store" }),
        fetch("/api/jobs", { cache: "no-store" }),
      ]);

      if (!wRes.ok) throw new Error(`Workers failed: ${wRes.status}`);
      if (!bRes.ok) throw new Error(`Business failed: ${bRes.status}`);
      if (!jRes.ok) throw new Error(`Jobs failed: ${jRes.status}`);

      const [wData, bData, jData] = await Promise.all([wRes.json(), bRes.json(), jRes.json()]);

      setWorkers(Array.isArray(wData) ? wData : []);
      setBusiness(bData ?? null);
      setJobs(Array.isArray(jData) ? jData : []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 20_000); // light auto-refresh
    return () => clearInterval(t);
  }, []);

  const today = new Date();

  // “In play” = today or overdue and not done (mirrors your TodayPage logic) :contentReference[oaicite:3]{index=3}
  const inPlayJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (!j.visitDate) return false;
      const vd = new Date(j.visitDate);
      const isToday = isSameDay(vd, today);
      const isOverdue = vd < today && !isSameDay(vd, today);
      return isToday || (isOverdue && j.status !== "done");
    });
  }, [jobs]);

  const totals = useMemo(() => {
    const dueToday = jobs.filter((j) => {
      if (!j.visitDate) return false;
      return isSameDay(new Date(j.visitDate), today);
    });

    const overdue = jobs.filter((j) => {
      if (!j.visitDate) return false;
      const vd = new Date(j.visitDate);
      return vd < today && !isSameDay(vd, today) && j.status !== "done";
    });

    const doneToday = dueToday.filter((j) => j.status === "done").length;
    const remainingToday = dueToday.filter((j) => j.status !== "done").length;

    return {
      dueToday: dueToday.length,
      doneToday,
      remainingToday,
      overdue: overdue.length,
      unscheduled: jobs.filter((j) => j.status === "unscheduled" || j.visitDate === null).length,
    };
  }, [jobs]);

  const perWorker = useMemo(() => {
    const list = workers.map((w) => {
      const wk = cleanLower(w.key);

      const mine = inPlayJobs
        .filter((j) => cleanLower(j.assignedTo) === wk)
        .sort((a, b) => {
          // done at bottom
          if (a.status === "done" && b.status !== "done") return 1;
          if (a.status !== "done" && b.status === "done") return -1;

          // by date then time
          const ad = a.visitDate ? new Date(a.visitDate).getTime() : 0;
          const bd = b.visitDate ? new Date(b.visitDate).getTime() : 0;
          if (ad !== bd) return ad - bd;

          const at = a.startTime ?? "99:99";
          const bt = b.startTime ?? "99:99";
          return at.localeCompare(bt);
        });

      const done = mine.filter((j) => j.status === "done").length;
      const remaining = mine.filter((j) => j.status !== "done").length;

      const current = mine.find((j) => j.status !== "done") ?? null;

      // If they have nothing “in play”, still show something sensible
      const nextAny = jobs
        .filter((j) => cleanLower(j.assignedTo) === wk && j.status !== "done")
        .sort((a, b) => {
          const ad = a.visitDate ? new Date(a.visitDate).getTime() : Number.MAX_SAFE_INTEGER;
          const bd = b.visitDate ? new Date(b.visitDate).getTime() : Number.MAX_SAFE_INTEGER;
          if (ad !== bd) return ad - bd;
          return (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99");
        })[0];

      return {
        worker: w,
        done,
        remaining,
        currentJob: current,
        nextJob: current ? null : nextAny ?? null,
      };
    });

    return list;
  }, [workers, jobs, inPlayJobs]);

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>{business?.name ?? "Dashboard"}</h1>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
            {gbDate(today)} • Auto-refreshing
          </div>
        </div>

        <button onClick={loadAll} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}>
          Refresh
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#ffe6e6", border: "1px solid #ffb3b3" }}>
          {err}
        </div>
      ) : null}

      {/* Day overview */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
        {[
          { label: "Due today", value: totals.dueToday },
          { label: "Done today", value: totals.doneToday },
          { label: "Remaining today", value: totals.remainingToday },
          { label: "Overdue", value: totals.overdue },
          { label: "Unscheduled", value: totals.unscheduled },
        ].map((k) => (
          <div key={k.label} style={{ padding: 14, borderRadius: 14, border: "1px solid #e6e6e6", background: "#fff" }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Where people are */}
      <h2 style={{ marginTop: 22, marginBottom: 10 }}>Where everyone is</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        {perWorker.map((row) => {
          const current = row.currentJob;
          const fallback = row.nextJob;

          return (
            <div
              key={row.worker.key}
              style={{ padding: 14, borderRadius: 14, border: "1px solid #e6e6e6", background: "#fff" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{row.worker.displayName}</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                    Done: {row.done} • Remaining (today/overdue): {row.remaining}
                  </div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.6 }}>
                  {current ? "On now" : fallback ? "Next up" : "No jobs"}
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                {current ? (
                  <>
                    <div style={{ fontWeight: 800 }}>{current.title}</div>
                    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{current.address}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                      {current.visitDate ? gbDate(new Date(current.visitDate)) : ""}{" "}
                      {current.startTime ? `• ${current.startTime}` : ""} • Status: {current.status}
                    </div>
                  </>
                ) : fallback ? (
                  <>
                    <div style={{ fontWeight: 800 }}>{fallback.title}</div>
                    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{fallback.address}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                      {fallback.visitDate ? gbDate(new Date(fallback.visitDate)) : "Unscheduled"}{" "}
                      {fallback.startTime ? `• ${fallback.startTime}` : ""} • Status: {fallback.status}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, opacity: 0.75 }}>Nothing assigned yet.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 18, fontSize: 12, opacity: 0.65 }}>
        Tip: “On now” = first not-done job that’s due today/overdue (matches Today page behaviour).
        If someone has none, it shows “Next up” based on their next dated/assigned job.
      </div>
    </main>
  );
}