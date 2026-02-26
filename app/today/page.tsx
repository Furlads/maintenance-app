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
  overrunMins: number;
  fixed: boolean;
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function gbDate(d: Date) {
  return d.toLocaleDateString("en-GB");
}

function gbTimeLabel(job: Job) {
  if (!job.visitDate) return "";
  const day = gbDate(new Date(job.visitDate));
  const t = job.startTime ? ` ${job.startTime}` : "";
  return `${day}${t}`;
}

export default function TodayPage() {
  const [worker, setWorker] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [openJobId, setOpenJobId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<string>("");
  const [busyJobId, setBusyJobId] = useState<number | null>(null);

  async function loadJobs() {
    const res = await fetch("/api/jobs", { cache: "no-store" });
    const data = await res.json();
    setJobs(data);
  }

  useEffect(() => {
    const saved = localStorage.getItem("workerName") || "";
    if (!saved) {
      window.location.href = "/";
      return;
    }
    setWorker(saved);
    loadJobs();
  }, []);

  const todaysJobs = useMemo(() => {
    const w = worker.toLowerCase().trim();
    if (!w) return [];
    const today = new Date();

    return jobs
      // Trev sees all jobs
      .filter((j) => {
        if (w === "trev") return true;
        return (j.assignedTo ?? "").toLowerCase() === w;
      })
      // Today + overdue only
      .filter((j) => {
        if (!j.visitDate) return false;
        const vd = new Date(j.visitDate);
        const isToday = isSameDay(vd, today);
        const isOverdue = vd < today && !isSameDay(vd, today);
        return isToday || (isOverdue && j.status !== "done");
      })
      .sort((a, b) => {
        // done at bottom
        if (a.status === "done" && b.status !== "done") return 1;
        if (a.status !== "done" && b.status === "done") return -1;

        // sort by date then time
        const ad = a.visitDate ? new Date(a.visitDate).getTime() : 0;
        const bd = b.visitDate ? new Date(b.visitDate).getTime() : 0;
        if (ad !== bd) return ad - bd;

        const at = a.startTime ?? "99:99";
        const bt = b.startTime ?? "99:99";
        return at.localeCompare(bt);
      });
  }, [jobs, worker]);

  function cardStyle(job: Job) {
    const now = new Date();

    if (job.status === "done") {
      return { background: "#ffdddd", border: "1px solid #ffaaaa" };
    }

    if (job.visitDate) {
      const vd = new Date(job.visitDate);

      if (vd < now && !isSameDay(vd, now)) {
        return { background: "#fff3cd", border: "1px solid #ffeeba" };
      }

      if (isSameDay(vd, now)) {
        return { background: "#ddffdd", border: "1px solid #aaffaa" };
      }
    }

    return { background: "#fff", border: "1px solid #ddd" };
  }

  async function toggleDone(id: number) {
    setBusyJobId(id);
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggleStatus: true }),
    });
    setBusyJobId(null);
    loadJobs();
  }

  async function extendJob(id: number, extendMins: number) {
    setBusyJobId(id);
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        extendMins,
        appendNote: `Job running over by +${extendMins} mins. Please reshuffle the rest.`,
        noteAuthor: worker,
      }),
    });
    setBusyJobId(null);
    loadJobs();
  }

  async function submitNote(jobId: number) {
    const cleaned = noteText.trim();
    if (!cleaned) return;

    setBusyJobId(jobId);
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appendNote: cleaned,
        noteAuthor: worker,
      }),
    });
    setBusyJobId(null);

    setNoteText("");
    loadJobs();
  }

  function logout() {
    localStorage.removeItem("workerName");
    window.location.href = "/";
  }

  return (
    <main style={{ padding: 24, maxWidth: 820 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>
            Today’s Jobs {worker.toLowerCase().trim() === "trev" ? "(All)" : ""}
          </h1>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Logged in as: <b>{worker}</b> • {gbDate(new Date())}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
          <button onClick={loadJobs} style={{ padding: "8px 10px" }}>
            Refresh
          </button>
          <button onClick={logout} style={{ padding: "8px 10px" }}>
            Change user
          </button>
        </div>
      </div>

      <hr style={{ margin: "16px 0" }} />

      {todaysJobs.length === 0 ? (
        <p>No jobs for today 🎉</p>
      ) : (
        todaysJobs.map((job) => (
          <div
            key={job.id}
            style={{
              padding: 12,
              marginBottom: 12,
              borderRadius: 10,
              ...cardStyle(job),
            }}
          >
            <div
              style={{ cursor: "pointer" }}
              onClick={() => setOpenJobId(openJobId === job.id ? null : job.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <strong style={{ textDecoration: job.status === "done" ? "line-through" : "none" }}>
                  {job.title}
                </strong>
                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  {String(job.status).toUpperCase()}
                </span>
              </div>

              <div style={{ marginTop: 6 }}>
                <b>Address:</b> {job.address || "(no address yet)"}
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                When: {gbTimeLabel(job)} {" • "}
                Assigned: {job.assignedTo ?? "none"} {" • "}
                Duration: {job.durationMins + (job.overrunMins ?? 0)} mins
                {job.fixed ? " • FIXED" : ""}
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                Tap job to open notes
              </div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => toggleDone(job.id)}
                disabled={busyJobId === job.id}
                style={{ padding: "8px 10px" }}
              >
                {busyJobId === job.id ? "Working..." : job.status === "done" ? "Undo" : "Mark as Done"}
              </button>

              {job.status !== "done" ? (
                <>
                  <button
                    onClick={() => extendJob(job.id, 30)}
                    disabled={busyJobId === job.id}
                    style={{ padding: "8px 10px" }}
                  >
                    Extend +30
                  </button>
                  <button
                    onClick={() => extendJob(job.id, 60)}
                    disabled={busyJobId === job.id}
                    style={{ padding: "8px 10px" }}
                  >
                    Extend +60
                  </button>
                </>
              ) : null}
            </div>

            {openJobId === job.id ? (
              <div style={{ marginTop: 12, padding: 10, background: "#ffffffaa", borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Notes history</div>

                {job.notesLog ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{job.notesLog}</pre>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>No notes yet.</div>
                )}

                <div style={{ marginTop: 10 }}>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add issue / note"
                    style={{ width: "100%", padding: 10, height: 80 }}
                  />
                  <button
                    onClick={() => submitNote(job.id)}
                    disabled={busyJobId === job.id}
                    style={{ marginTop: 8, padding: "8px 12px" }}
                  >
                    {busyJobId === job.id ? "Saving..." : "Submit note"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))
      )}
    </main>
  );
}