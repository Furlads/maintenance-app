"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getWorkers, type CompanyKey, type WorkerProfile } from "@/lib/workers";

type Job = {
  id: string;
  title: string;
  address: string;
  postcode: string;
  status: "todo" | "done" | "unscheduled";
  visitDate?: string | null;
  assignedTo: string | null;
  createdAt: string;
};

function getLS(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function cleanLower(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function getWorkerKeyFromStorage() {
  return cleanLower(getLS("worker") || getLS("workerName"));
}

async function assertRoleOrRedirect(company: CompanyKey, allowedRoles: Array<"Admin" | "Editor" | "Worker">) {
  const workerKey = getWorkerKeyFromStorage();
  if (!workerKey) {
    window.location.href = "/choose-worker";
    return false;
  }

  const res = await fetch(`/api/workers?company=${company}`, { cache: "no-store" });
  const data = await res.json();
  const list = Array.isArray(data?.workers) ? data.workers : [];

  const me = list.find((w: any) => cleanLower(w.key) === workerKey && w.active);
  if (!me) {
    window.location.href = "/choose-worker";
    return false;
  }

  if (!allowedRoles.includes(me.role)) {
    window.location.href = "/today";
    return false;
  }

  return true;
}

export default function UnscheduledPage() {
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [company, setCompany] = useState<CompanyKey>("furlads");
  const [ready, setReady] = useState(false);

  // Keep workers derived from company (but only used for display name mapping)
  const workers = useMemo<WorkerProfile[]>(() => getWorkers(company), [company]);

  const workerNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of workers) map.set(cleanLower(w.key), w.name);
    return map;
  }, [workers]);

  function displayWorkerName(workerKey: string | null | undefined) {
    const k = cleanLower(workerKey);
    if (!k) return "none";
    return workerNameByKey.get(k) || k;
  }

  async function fetchJobs() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await res.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.jobs)
        ? (data as any).jobs
        : [];

      setJobs(list);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Guard: Admin only
  useEffect(() => {
    (async () => {
      const c = (getLS("company") as CompanyKey) || "";
      if (c !== "furlads" && c !== "threecounties") {
        window.location.href = "/choose-company";
        return;
      }

      setCompany(c);

      try {
        const ok = await assertRoleOrRedirect(c, ["Admin"]);
        if (!ok) return;

        setReady(true);
        await fetchJobs();
      } catch {
        window.location.href = "/choose-worker";
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unscheduled = useMemo(() => {
    return (Array.isArray(jobs) ? jobs : [])
      .filter((j) => j.status === "unscheduled" || j.visitDate === null)
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

  // While guarding / redirecting, keep it quiet (avoids flicker + hook-order issues)
  if (!ready) return null;

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Unscheduled Jobs</h1>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
            Company: <b>{company}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => router.push("/today")}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc" }}
          >
            /today
          </button>

          <button
            onClick={rebuildSchedule}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #111", fontWeight: 900 }}
          >
            Rebuild diary
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div>Loading jobs…</div>
      ) : unscheduled.length === 0 ? (
        <div style={{ padding: 12, borderRadius: 14, border: "1px dashed #ccc" }}>🎉 No unscheduled jobs</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {unscheduled.map((job) => (
            <div key={job.id} style={{ padding: 14, borderRadius: 14, border: "1px solid #ddd" }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{job.title}</div>

              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>{job.address}</div>

              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
                Assigned to: <b>{displayWorkerName(job.assignedTo)}</b>
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => toggleDone(job.id)}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc" }}
                >
                  {job.status === "done" ? "Undo done" : "Mark done"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}