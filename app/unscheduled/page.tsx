"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Job = {
  id: string;
  title: string;
  address: string;
  postcode: string;
  status: "todo" | "done" | "unscheduled";
  visitDate?: string | null;
  assignedTo: string;
  createdAt: string;
};

export default function UnscheduledPage() {
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function fetchJobs() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await res.json();

      // ✅ Defensive handling so it NEVER crashes again
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.jobs)
        ? data.jobs
        : [];

      setJobs(list);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchJobs();
  }, []);

  const unscheduled = useMemo(() => {
    return (Array.isArray(jobs) ? jobs : [])
      .filter(
        (j) => j.status === "unscheduled" || j.visitDate === null
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [jobs]);

  async function toggleDone(id: string) {
    try {
      await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toggleStatus: true }),
      });
      fetchJobs();
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to update job");
    }
  }

  async function rebuildSchedule() {
    try {
      setMsg("Rebuilding diary…");
      await fetch("/api/schedule/rebuild", { method: "POST" });
      await fetchJobs();
      setMsg("✅ Diary rebuilt");
    } catch {
      setMsg("Rebuild failed");
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 900 }}>
          Unscheduled Jobs
        </h1>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => router.push("/today")}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          >
            /today
          </button>

          <button
            onClick={rebuildSchedule}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              fontWeight: 900,
            }}
          >
            Rebuild diary
          </button>
        </div>
      </div>

      {msg && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
          }}
        >
          {msg}
        </div>
      )}

      {loading ? (
        <div>Loading jobs…</div>
      ) : unscheduled.length === 0 ? (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px dashed #ccc",
          }}
        >
          🎉 No unscheduled jobs
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {unscheduled.map((job) => (
            <div
              key={job.id}
              style={{
                padding: 14,
                borderRadius: 14,
                border: "1px solid #ddd",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                {job.title}
              </div>

              <div
                style={{
                  fontSize: 13,
                  opacity: 0.8,
                  marginTop: 6,
                }}
              >
                {job.address}
              </div>

              <div
                style={{
                  fontSize: 12,
                  opacity: 0.6,
                  marginTop: 6,
                }}
              >
                Assigned to: {job.assignedTo}
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => toggleDone(job.id)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                  }}
                >
                  {job.status === "done"
                    ? "Undo done"
                    : "Mark done"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}