"use client";

import { useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  title: string;
  address: string;
  postcode: string;
  status: "todo" | "done" | "unscheduled";
  assignedTo: string;
  finishedAt?: string | null;
};

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfToday() {
  const s = startOfToday();
  const e = new Date(s);
  e.setDate(e.getDate() + 1);
  return e;
}
function safeArray(data: any): Job[] {
  return Array.isArray(data) ? data : Array.isArray(data?.jobs) ? data.jobs : [];
}
function displayName(raw: string) {
  const v = (raw || "").trim();
  const lc = v.toLowerCase();
  if (lc === "stephen") return "Stephen";
  if (lc === "jacob") return "Jacob";
  if (lc === "trev" || lc === "trevor") return "Trev";
  if (lc === "kelly") return "Kelly";
  return v || "Unassigned";
}
function hhMm(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function AdminCompletedPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const todayStart = useMemo(() => startOfToday(), []);
  const todayEnd = useMemo(() => endOfToday(), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to load jobs");

        const all = safeArray(data);
        const completed = all
          .filter((j) => j.finishedAt)
          .filter((j) => {
            const f = new Date(j.finishedAt as string);
            return f >= todayStart && f < todayEnd;
          })
          .sort((a, b) => new Date(b.finishedAt as string).getTime() - new Date(a.finishedAt as string).getTime());

        setJobs(completed);
      } catch (e: any) {
        setMsg(e?.message ?? "Failed to load");
        setJobs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [todayStart, todayEnd]);

  return (
    <div style={{ padding: 16, maxWidth: 920, margin: "0 auto" }}>
      <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.7 }}>ADMIN / COMPLETED</div>
      <a href="/admin" style={{ fontSize: 14 }}>← Back to dashboard</a>

      <h1 style={{ marginTop: 10, fontSize: 26, fontWeight: 950 }}>Jobs completed today</h1>
      <div style={{ marginTop: 6, opacity: 0.7 }}>Based on “finishedAt” timestamps</div>

      {msg ? <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>{msg}</div> : null}

      {loading ? (
        <div style={{ marginTop: 12 }}>Loading…</div>
      ) : jobs.length === 0 ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px dashed #ccc", borderRadius: 12 }}>None completed yet.</div>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {jobs.map((j) => (
            <div key={j.id} style={card()}>
              <div style={{ fontWeight: 900 }}>
                {displayName(j.assignedTo)} • Finished {hhMm(new Date(j.finishedAt as string))} • {j.title}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>{j.address}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function card(): React.CSSProperties {
  return { padding: 12, borderRadius: 14, border: "1px solid #e6e6e6", background: "white" };
}