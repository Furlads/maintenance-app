"use client";

import { useEffect, useMemo, useState } from "react";

type Job = {
  id: number;
  title: string;
  address: string;
  assignedTo: string | null;
  what3words?: string;
};

type WhenMode = "specific" | "nextbest";

function isoDateOnly(d: Date) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function getParam(name: string): string {
  try {
    return new URLSearchParams(window.location.search).get(name) || "";
  } catch {
    return "";
  }
}

function trim(s: string) {
  return (s || "").trim();
}

export default function BookFollowUpPage() {
  const [worker, setWorker] = useState("");
  const [company, setCompany] = useState("furlads");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState<number | null>(null);
  const [jobsError, setJobsError] = useState("");

  const [what, setWhat] = useState("");
  const [whenMode, setWhenMode] = useState<WhenMode>("specific");

  const [visitDate, setVisitDate] = useState(isoDateOnly(new Date()));
  const [startTime, setStartTime] = useState("13:00");
  const [durationMins, setDurationMins] = useState(60);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const styles = useMemo(() => {
    const card: React.CSSProperties = {
      border: "1px solid rgba(0,0,0,0.12)",
      borderRadius: 16,
      background: "#fff",
      padding: 14,
    };

    const label: React.CSSProperties = {
      fontSize: 12,
      fontWeight: 900,
      opacity: 0.75,
      marginBottom: 6,
      display: "block",
    };

    const input: React.CSSProperties = {
      width: "100%",
      padding: 12,
      borderRadius: 14,
      border: "1px solid rgba(0,0,0,0.18)",
      fontSize: 16,
      outline: "none",
    };

    const btn: React.CSSProperties = {
      padding: "12px 14px",
      borderRadius: 14,
      border: "1px solid rgba(0,0,0,0.18)",
      background: "#fff",
      fontWeight: 950,
      cursor: "pointer",
      minHeight: 44,
    };

    const btnPrimary: React.CSSProperties = {
      padding: "12px 14px",
      borderRadius: 14,
      border: "1px solid #111",
      background: "#111",
      color: "#fff",
      fontWeight: 950,
      cursor: "pointer",
      minHeight: 44,
    };

    const pill: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      borderRadius: 999,
      border: "1px solid rgba(0,0,0,0.12)",
      background: "rgba(0,0,0,0.03)",
      fontWeight: 900,
      fontSize: 12,
    };

    return { card, label, input, btn, btnPrimary, pill };
  }, []);

  async function loadJobs() {
    setJobsError("");
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await res.json();
      if (!Array.isArray(data)) {
        setJobs([]);
        setJobsError("Jobs API did not return an array.");
        return;
      }
      setJobs(data);
    } catch (e: any) {
      setJobs([]);
      setJobsError(String(e?.message || e));
    }
  }

  useEffect(() => {
    const savedWorker = localStorage.getItem("worker") || localStorage.getItem("workerName") || "";
    const savedCompany = localStorage.getItem("company") || "furlads";

    if (!savedWorker) {
      window.location.href = "/choose-company";
      return;
    }

    setWorker(savedWorker);
    setCompany(savedCompany);

    const idRaw = getParam("jobId");
    const id = Number(idRaw);
    if (Number.isFinite(id)) setJobId(id);

    // Defaults from query params
    if (getParam("preset") === "extra-visit") {
      setWhat("Extra visit to complete job");
    }
    if (getParam("when") === "nextbest") {
      setWhenMode("nextbest");
    }

    loadJobs();
  }, []);

  const sourceJob = useMemo(() => {
    if (!jobId) return null;
    return jobs.find((j) => j.id === jobId) || null;
  }, [jobs, jobId]);

  const canSubmit = useMemo(() => {
    if (!worker) return false;
    if (!sourceJob) return false;
    if (!trim(sourceJob.address)) return false;
    if (!trim(what)) return false;
    if (!Number.isFinite(durationMins) || durationMins < 15) return false;

    if (whenMode === "specific") {
      if (!trim(visitDate)) return false;
      // time can be blank, but we default it; leave flexible
    }
    return true;
  }, [worker, sourceJob, what, durationMins, whenMode, visitDate]);

  async function saveFollowUp() {
    setMsg("");
    if (!canSubmit || !sourceJob) return;

    const payload: any = {
      title: `Follow-up: ${trim(what)}`,
      address: trim(sourceJob.address), // LOCKED to the job to prevent data mess
      assignedTo: worker.toLowerCase().trim(),
      durationMins,
      notes: `Follow-up from Job #${sourceJob.id} (${sourceJob.title})`,
    };

    if (whenMode === "specific") {
      payload.visitDate = trim(visitDate);
      payload.startTime = trim(startTime) ? trim(startTime) : null;
    } else {
      payload.visitDate = null;
      payload.startTime = null;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setMsg(`❌ Failed to save (${res.status}). ${text}`);
        return;
      }

      // Optional: if Next best, try rebuild to slot it
      if (whenMode === "nextbest") {
        try {
          await fetch("/api/schedule/rebuild", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workerName: worker }),
          });
        } catch {
          // ignore
        }
      }

      setMsg("✅ Follow-up saved");
      setWhat("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.7 }}>Book follow-up</div>
          <div style={{ fontSize: 22, fontWeight: 1000, marginTop: 2 }}>Extra visit / follow-up</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            Worker <b>{worker}</b> • {company}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href="/today"
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "#fff",
              fontWeight: 950,
              textDecoration: "none",
              color: "#111",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ← Back
          </a>

          <button onClick={loadJobs} style={styles.btn}>
            Refresh
          </button>
        </div>
      </div>

      <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid rgba(0,0,0,0.10)" }} />

      {jobsError ? (
        <div style={{ ...styles.card, borderColor: "#f2c2c2", background: "#ffecec" }}>
          <div style={{ fontWeight: 1000, marginBottom: 6 }}>Jobs failed to load</div>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{jobsError}</div>
        </div>
      ) : null}

      {!jobId ? (
        <div style={styles.card}>
          <div style={{ fontWeight: 1000 }}>No job selected</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
            Go back to Today and use <b>Need extra visit ➕</b> so we can attach this to the correct job.
          </div>
        </div>
      ) : !sourceJob ? (
        <div style={styles.card}>
          <div style={{ fontWeight: 1000 }}>Job not found</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
            Tap Refresh, or go back and open the follow-up again from the job.
          </div>
        </div>
      ) : (
        <>
          {/* Attached job card */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 1000, opacity: 0.7 }}>Attached to</div>
                <div style={{ fontWeight: 1000, marginTop: 4 }}>
                  Job #{sourceJob.id} — {sourceJob.title}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                  <b>Address:</b> {sourceJob.address}
                  {sourceJob.what3words ? (
                    <span style={{ marginLeft: 10 }}>
                      • <b>w3w</b>: {sourceJob.what3words}
                    </span>
                  ) : null}
                </div>
              </div>

              <span style={styles.pill}>Address locked ✅</span>
            </div>
          </div>

          {/* What */}
          <div style={{ marginTop: 12, ...styles.card }}>
            <label style={styles.label}>What is needed? *</label>
            <input
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              style={styles.input}
              placeholder="e.g. Hedge trim"
            />
          </div>

          {/* When */}
          <div style={{ marginTop: 12, ...styles.card }}>
            <div style={{ fontSize: 12, fontWeight: 1000, opacity: 0.75, marginBottom: 10 }}>When?</div>

            <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
              <input type="radio" checked={whenMode === "specific"} onChange={() => setWhenMode("specific")} />
              Specific time
            </label>

            {whenMode === "specific" ? (
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 180px" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>Date</div>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    style={{ ...styles.input, fontSize: 16 }}
                  />
                </div>

                <div style={{ flex: "1 1 140px" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>Time</div>
                  <input
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{ ...styles.input, fontSize: 16 }}
                    placeholder="13:00"
                  />
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setStartTime("09:00")} style={styles.btn}>
                      Morning
                    </button>
                    <button type="button" onClick={() => setStartTime("13:00")} style={styles.btn}>
                      Afternoon
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                <input type="radio" checked={whenMode === "nextbest"} onChange={() => setWhenMode("nextbest")} />
                Next best day (you choose)
              </label>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                This saves it without a date and tries to slot it automatically.
              </div>
            </div>
          </div>

          {/* Duration + Save */}
          <div style={{ marginTop: 12, ...styles.card }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={styles.label}>Duration</label>
                <select
                  value={String(durationMins)}
                  onChange={(e) => setDurationMins(Number(e.target.value))}
                  style={{ ...styles.input, cursor: "pointer" }}
                >
                  <option value="30">30 mins</option>
                  <option value="60">60 mins</option>
                  <option value="90">90 mins</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              <button
                type="button"
                disabled={!canSubmit || busy}
                onClick={saveFollowUp}
                style={{
                  ...styles.btnPrimary,
                  opacity: !canSubmit || busy ? 0.7 : 1,
                }}
              >
                {busy ? "Saving…" : "Save follow-up"}
              </button>
            </div>

            {msg ? <div style={{ marginTop: 12, fontSize: 13, whiteSpace: "pre-wrap" }}>{msg}</div> : null}

            {!trim(sourceJob.address) ? (
              <div style={{ marginTop: 10, fontSize: 12, color: "crimson" }}>
                This job has no address, so we can’t safely attach a follow-up yet.
              </div>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}