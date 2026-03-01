"use client";

import { useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  title: string;
  address: string;
  postcode: string;
  status: "todo" | "done" | "unscheduled";
  visitDate?: string | null;
  startTime?: string | null;
  assignedTo: string;
  fixed: boolean;
  arrivedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
};
<div style={{ marginTop: 10 }}>
  <a
    href="https://chat.whatsapp.com/H2aQu4l0mEKIeTBI1JxrFQ?mode=gi_t"
    target="_blank"
    rel="noreferrer"
    style={btnLink()}
  >
    WhatsApp all workers →
  </a>
</div>
function endOfToday() {
  const d = new Date();
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + 1);
  return e;
}
function safeArray(data: any): Job[] {
  return Array.isArray(data) ? data : Array.isArray(data?.jobs) ? data.jobs : [];
}
function displayName(raw: string) {
  const v = (raw || "").trim();
  if (!v) return "Unassigned";
  const lc = v.toLowerCase();
  if (lc === "stephen") return "Stephen";
  if (lc === "jacob") return "Jacob";
  if (lc === "trev" || lc === "trevor") return "Trev";
  if (lc === "kelly") return "Kelly";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export default function AdminMissingPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"arrive" | "finish">("arrive");
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
        const due = all
          .filter((j) => j.status === "todo" && j.visitDate)
          .filter((j) => new Date(j.visitDate as string) < todayEnd);

        setJobs(due);
      } catch (e: any) {
        setMsg(e?.message ?? "Failed to load");
        setJobs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [todayEnd]);

  const missingArrive = useMemo(() => jobs.filter((j) => !j.arrivedAt), [jobs]);
  const missingFinish = useMemo(() => jobs.filter((j) => !!j.arrivedAt && !j.finishedAt), [jobs]);

  const list = tab === "arrive" ? missingArrive : missingFinish;

  return (
    <div style={{ padding: 16, maxWidth: 920, margin: "0 auto" }}>
      <a href="/admin" style={{ fontSize: 14 }}>← Back to dashboard</a>
      <h1 style={{ marginTop: 10, fontSize: 26, fontWeight: 950 }}>Missing timestamps</h1>
      <div style={{ marginTop: 6, opacity: 0.7 }}>Action list for today + overdue jobs</div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => setTab("arrive")} style={tabBtn(tab === "arrive")}>
          Missing “I’m here” ({missingArrive.length})
        </button>
        <button onClick={() => setTab("finish")} style={tabBtn(tab === "finish")}>
          Missing “I’m finished” ({missingFinish.length})
        </button>
      </div>

      {msg ? <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>{msg}</div> : null}

      {loading ? (
        <div style={{ marginTop: 12 }}>Loading…</div>
      ) : list.length === 0 ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px dashed #ccc", borderRadius: 12 }}>All good ✅</div>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {list.map((j) => (
            <div key={j.id} style={card()}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>
                  {displayName(j.assignedTo)} • {j.startTime ?? "Time TBC"} • {j.title}{" "}
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{j.fixed ? "(fixed)" : "(economic)"}</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{j.postcode}</div>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>{j.address}</div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href={`/admin/worker/${encodeURIComponent(displayName(j.assignedTo))}`} style={btnLink()}>
                  Open worker day →
                </a>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${j.address}\n${j.postcode}`)}`} target="_blank" style={btnLink()}>
                  Open in Maps →
                </a>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                {tab === "arrive"
                  ? "Action: chase arrival timestamp (worker needs to tap “I’m here”)"
                  : "Action: chase finish timestamp (worker needs to tap “I’m finished”)"}{" "}
                — this page is built for that.
              </div>
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
function btnLink(): React.CSSProperties {
  return { padding: "8px 10px", borderRadius: 999, border: "1px solid #ccc", textDecoration: "none", color: "inherit", fontWeight: 800, fontSize: 12 };
}
function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: active ? "1px solid #111" : "1px solid #ccc",
    fontWeight: active ? 950 : 850,
    background: "white",
    cursor: "pointer",
  };
}