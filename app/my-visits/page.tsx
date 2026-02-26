"use client";

import { useEffect, useMemo, useState } from "react";

type Job = {
  id: number;
  title: string;
  address: string;
  notes: string;
  notesLog: string;
  status: string;
  visitDate: string | null;
  assignedTo: string | null;
  createdAt: string;
};

function toGBDate(d: Date) {
  return d.toLocaleDateString("en-GB");
}

const WORKERS = ["stephen", "jacob", "trev"];

export default function MyVisitsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const [errorMsg, setErrorMsg] = useState("");

  async function loadJobs() {
    const res = await fetch("/api/jobs", { cache: "no-store" });
    const data = await res.json();
    setJobs(data);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!title.trim()) m.push("Title");
    if (!address.trim()) m.push("Address");
    if (!assignedTo.trim()) m.push("Assigned to");
    return m;
  }, [title, address, assignedTo]);

  const canSubmit = missing.length === 0 && !loading;

  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!canSubmit) {
      setErrorMsg(`Please fill: ${missing.join(", ")}`);
      return;
    }

    setLoading(true);

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        address,
        notes,
        visitDate: visitDate.trim() ? visitDate.trim() : null,
        assignedTo: assignedTo.trim().toLowerCase(),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setErrorMsg(`Failed to add job (${res.status}). ${text}`);
      return;
    }

    setTitle("");
    setAddress("");
    setNotes("");
    setVisitDate("");
    setAssignedTo("");

    loadJobs();
  }

  return (
    <main style={{ padding: 24, maxWidth: 820 }}>
      <h1>Kelly Admin – Add Jobs</h1>

      <form onSubmit={addJob} style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontSize: 12, opacity: 0.75 }}>
          Title *
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <label style={{ display: "block", fontSize: 12, opacity: 0.75 }}>
          Address *
        </label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <label style={{ display: "block", fontSize: 12, opacity: 0.75 }}>
          Assigned to *
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {WORKERS.map((w) => (
            <button
              type="button"
              key={w}
              onClick={() => setAssignedTo(w)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: assignedTo === w ? "2px solid #000" : "1px solid #ddd",
                background: "#fff",
                textTransform: "capitalize",
              }}
            >
              {w}
            </button>
          ))}
        </div>

        <input
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          placeholder="Or type worker name"
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <label style={{ display: "block", fontSize: 12, opacity: 0.75 }}>
          Visit date (optional)
        </label>
        <input
          type="date"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <label style={{ display: "block", fontSize: 12, opacity: 0.75 }}>
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ width: "100%", padding: 10, height: 90, marginBottom: 10 }}
        />

        {errorMsg && (
          <div style={{ marginBottom: 10, color: "red" }}>{errorMsg}</div>
        )}

        <button disabled={!canSubmit} style={{ padding: "10px 16px" }}>
          {loading ? "Adding..." : "Add Job"}
        </button>
      </form>

      <h2>Latest jobs</h2>

      {jobs.map((j) => (
        <div key={j.id} style={{ marginBottom: 12 }}>
          <b>{j.title}</b> — {j.address}
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {j.visitDate
              ? `Visit: ${toGBDate(new Date(j.visitDate))}`
              : `Visit: UNSCHEDULED`}{" "}
            • Assigned: {j.assignedTo ?? "none"} • Status: {j.status}
          </div>
        </div>
      ))}
    </main>
  );
}