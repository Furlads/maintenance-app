"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  what3words?: string;
};

type ChasMessage = {
  id: number;
  createdAt: string;
  company: string;
  worker: string;
  jobId: number | null;
  question: string;
  answer: string;
  imageDataUrl: string;
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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

function gbDateTimeStamp(d: Date) {
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minsToHm(totalMins: number) {
  const m = Math.max(0, Math.round(totalMins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TodayPage() {
  const [worker, setWorker] = useState<string>("");
  const [company, setCompany] = useState<string>("furlads");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsError, setJobsError] = useState<string>("");

  // Notes UI
  const [openJobId, setOpenJobId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<string>("");
  const [busyJobId, setBusyJobId] = useState<number | null>(null);

  // Workday (Three Counties)
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [checkInAtIso, setCheckInAtIso] = useState<string>("");
  const [workdayError, setWorkdayError] = useState<string>("");

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkoutFiles, setCheckoutFiles] = useState<File[]>([]);
  const [checkoutPreviews, setCheckoutPreviews] = useState<string[]>([]);
  const [checkoutJobId, setCheckoutJobId] = useState<number | null>(null);

  // Chas UI (LOCKED — do not refactor)
  const [chasOpen, setChasOpen] = useState(false);
  const [chasMessages, setChasMessages] = useState<ChasMessage[]>([]);
  const [chasInput, setChasInput] = useState("");
  const [chasBusy, setChasBusy] = useState(false);
  const [chasError, setChasError] = useState("");
  const [chasJobId, setChasJobId] = useState<number | null>(null);
  const [chasImageDataUrl, setChasImageDataUrl] = useState<string>("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const isThreeCounties = String(company).toLowerCase() === "threecounties";

  const palette = useMemo(() => {
    return isThreeCounties
      ? {
          // Three Counties
          bgTop: "#0b6b2e",
          bgMid: "#25a244",
          bgBottom: "#f3fdf6",
          card: "#ffffff",
          ink: "#071a2a",
          sub: "rgba(7,26,42,0.70)",
          line: "rgba(7,26,42,0.12)",
          brand: "#16a34a",
          brandDark: "#15803d",
          soft: "#ecfdf3",
        }
      : {
          // Furlads
          bgTop: "#facc15",
          bgMid: "#fde047",
          bgBottom: "#fff9db",
          card: "#ffffff",
          ink: "#0b0b0b",
          sub: "rgba(11,11,11,0.70)",
          line: "rgba(11,11,11,0.14)",
          brand: "#111111",
          brandDark: "#000000",
          soft: "#fff7cc",
        };
  }, [isThreeCounties]);

  const styles = useMemo(() => {
    const shadow = "0 12px 34px rgba(0,0,0,0.06)";

    const card: React.CSSProperties = {
      borderRadius: 18,
      border: `1px solid ${palette.line}`,
      background: palette.card,
      boxShadow: shadow,
    };

    const btnBase: React.CSSProperties = {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${palette.line}`,
      background: "#fff",
      fontWeight: 950,
      cursor: "pointer",
      userSelect: "none",
      minHeight: 44,
    };

    const btnBrand: React.CSSProperties = {
      padding: "10px 12px",
      borderRadius: 14,
      border: "none",
      background: `linear-gradient(180deg, ${palette.brand} 0%, ${palette.brandDark} 100%)`,
      color: "#fff",
      fontWeight: 950,
      cursor: "pointer",
      userSelect: "none",
      minHeight: 44,
    };

    const btnDanger: React.CSSProperties = {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${palette.line}`,
      background: "#fff",
      fontWeight: 950,
      cursor: "pointer",
      userSelect: "none",
      minHeight: 44,
      opacity: 0.9,
    };

    return {
      page: {
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${palette.bgTop} 0%, ${palette.bgMid} 26%, ${palette.bgBottom} 100%)`,
        padding: 16,
        color: palette.ink,
      } as React.CSSProperties,
      container: { maxWidth: 640, margin: "0 auto" } as React.CSSProperties,
      card,
      btnBase,
      btnBrand,
      btnDanger,
      sub: { fontSize: 12, color: palette.sub } as React.CSSProperties,
      badge: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${palette.line}`,
        background: palette.soft,
        fontWeight: 950,
        fontSize: 12,
        color: palette.ink,
      } as React.CSSProperties,
    };
  }, [palette]);

  function switchUser() {
    const ok = window.confirm("Switch user?\n\nThis will take you back to company selection.");
    if (!ok) return;

    localStorage.removeItem("workerName");
    localStorage.removeItem("worker");
    localStorage.removeItem("company");
    window.location.href = "/choose-company";
  }

  function workdayStorageKey(kind: "activeJobId" | "checkInAtIso") {
    const w = (worker || "").toLowerCase().trim();
    const c = (company || "").toLowerCase().trim();
    return `workday:${c}:${w}:${kind}`;
  }

  function readWorkdayState() {
    try {
      const aj = localStorage.getItem(workdayStorageKey("activeJobId"));
      const ci = localStorage.getItem(workdayStorageKey("checkInAtIso")) || "";
      setActiveJobId(aj ? Number(aj) : null);
      setCheckInAtIso(ci);
    } catch {
      // ignore
    }
  }

  function writeWorkdayState(nextActiveJobId: number | null, nextCheckInAtIso: string) {
    try {
      if (nextActiveJobId === null) localStorage.removeItem(workdayStorageKey("activeJobId"));
      else localStorage.setItem(workdayStorageKey("activeJobId"), String(nextActiveJobId));

      if (!nextCheckInAtIso) localStorage.removeItem(workdayStorageKey("checkInAtIso"));
      else localStorage.setItem(workdayStorageKey("checkInAtIso"), nextCheckInAtIso);
    } catch {
      // ignore
    }
  }

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

  async function loadChasThread() {
    if (!company || !worker) return;
    try {
      const res = await fetch(
        `/api/chas/thread?company=${encodeURIComponent(company)}&worker=${encodeURIComponent(worker)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (Array.isArray(data)) setChasMessages(data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const savedWorker = localStorage.getItem("worker") || localStorage.getItem("workerName") || "";
    const savedCompany = localStorage.getItem("company") || "furlads";

    if (!savedWorker) {
      // keep locked identity flow intact (don’t change chooser logic)
      window.location.href = "/choose-company";
      return;
    }

    setWorker(savedWorker);
    setCompany(savedCompany);

    loadJobs();
  }, []);

  useEffect(() => {
    if (worker && company) readWorkdayState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker, company]);

  useEffect(() => {
    if (chasOpen) {
      loadChasThread();
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [chasOpen]);

  useEffect(() => {
    if (chasOpen) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [chasMessages, chasOpen]);

  const todaysJobs = useMemo(() => {
    const w = worker.toLowerCase().trim();
    if (!w) return [];

    const today = new Date();
    const list = Array.isArray(jobs) ? jobs : [];

    return list
      .filter((j) => {
        if (w === "trev") return true;
        return (j.assignedTo ?? "").toLowerCase() === w;
      })
      .filter((j) => {
        if (!j.visitDate) return false;
        const vd = new Date(j.visitDate);
        const isToday = isSameDay(vd, today);
        const isOverdue = vd < today && !isSameDay(vd, today);
        return isToday || (isOverdue && j.status !== "done");
      })
      .sort((a, b) => {
        if (a.status === "done" && b.status !== "done") return 1;
        if (a.status !== "done" && b.status === "done") return -1;

        const ad = a.visitDate ? new Date(a.visitDate).getTime() : 0;
        const bd = b.visitDate ? new Date(b.visitDate).getTime() : 0;
        if (ad !== bd) return ad - bd;

        const at = a.startTime ?? "99:99";
        const bt = b.startTime ?? "99:99";
        return at.localeCompare(bt);
      });
  }, [jobs, worker]);

  const currentJob = useMemo(() => {
    if (todaysJobs.length === 0) return null;
    if (activeJobId) {
      const found = todaysJobs.find((j) => j.id === activeJobId);
      if (found) return found;
    }
    const nextUp = todaysJobs.find((j) => j.status !== "done");
    return nextUp || todaysJobs[0];
  }, [todaysJobs, activeJobId]);

  const nextJob = useMemo(() => {
    if (!currentJob) return null;
    const idx = todaysJobs.findIndex((j) => j.id === currentJob.id);
    if (idx < 0) return null;
    for (let i = idx + 1; i < todaysJobs.length; i++) {
      if (todaysJobs[i].status !== "done") return todaysJobs[i];
    }
    return null;
  }, [todaysJobs, currentJob]);

  function cardStyle(job: Job) {
    const now = new Date();
    if (job.status === "done") return { background: "#ffdddd", border: "1px solid #ffaaaa" };

    if (job.visitDate) {
      const vd = new Date(job.visitDate);
      if (vd < now && !isSameDay(vd, now)) return { background: "#fff3cd", border: "1px solid #ffeeba" };
      if (isSameDay(vd, now)) return { background: "#ddffdd", border: "1px solid #aaffaa" };
    }

    return { background: "#fff", border: "1px solid #ddd" };
  }

  async function toggleDone(id: number) {
    setBusyJobId(id);
    try {
      await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggleStatus: true }),
      });
    } finally {
      setBusyJobId(null);
      loadJobs();
    }
  }

  async function submitNote(jobId: number) {
    const cleaned = noteText.trim();
    if (!cleaned) return;

    setBusyJobId(jobId);
    try {
      await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appendNote: cleaned, noteAuthor: worker }),
      });
      setNoteText("");
    } finally {
      setBusyJobId(null);
      loadJobs();
    }
  }

  async function appendStampedNote(jobId: number, message: string) {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appendNote: message, noteAuthor: worker }),
    });
  }

  async function extendJob(jobId: number, mins: number, note: string) {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extendMins: mins, appendNote: note, noteAuthor: worker }),
    });
  }

  function openNavigationToNext(fromJob: Job | null, toJob: Job | null) {
    if (!toJob?.address) return;
    const origin = fromJob?.address ? `&origin=${encodeURIComponent(fromJob.address)}` : "";
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(toJob.address)}&travelmode=driving`;
    window.location.href = url;
  }

  async function handleCheckIn() {
    setWorkdayError("");
    if (!isThreeCounties) return;
    if (!currentJob) {
      setWorkdayError("No current job found to check into.");
      return;
    }
    if (!currentJob.address) {
      setWorkdayError("This job has no address yet.");
      return;
    }

    const now = new Date();
    const iso = now.toISOString();

    setBusyJobId(currentJob.id);
    try {
      setActiveJobId(currentJob.id);
      setCheckInAtIso(iso);
      writeWorkdayState(currentJob.id, iso);

      await appendStampedNote(currentJob.id, `Checked in ✅ (${gbDateTimeStamp(now)})`);

      setOpenJobId(currentJob.id);
      setNoteText("");
    } catch (e: any) {
      setWorkdayError(String(e?.message || e));
    } finally {
      setBusyJobId(null);
      loadJobs();
    }
  }

  function startCheckoutFlow() {
    setWorkdayError("");
    if (!isThreeCounties) return;
    if (!currentJob) {
      setWorkdayError("No current job found to check out of.");
      return;
    }
    if (!checkInAtIso || activeJobId !== currentJob.id) {
      setWorkdayError("You’re not checked in to the current job yet. Tap “I’m here” first.");
      return;
    }

    setCheckoutJobId(currentJob.id);
    setCheckoutNotes("");
    setCheckoutFiles([]);
    setCheckoutPreviews([]);
    setCheckoutOpen(true);
  }

  async function confirmCheckout() {
    setWorkdayError("");
    const jobId = checkoutJobId;
    if (!jobId) return;

    const notes = checkoutNotes.trim();
    if (!notes) {
      setWorkdayError("Please add end-of-job notes before checking out.");
      return;
    }

    const started = checkInAtIso ? new Date(checkInAtIso) : null;
    const ended = new Date();
    const mins =
      started && !isNaN(started.getTime()) ? Math.max(1, Math.round((ended.getTime() - started.getTime()) / 60000)) : 0;

    const photoNames = checkoutFiles.map((f) => f.name).filter(Boolean);
    const photoPart = photoNames.length ? ` • Photos: ${photoNames.join(", ")}` : "";

    setBusyJobId(jobId);
    try {
      await appendStampedNote(
        jobId,
        `Checked out ✅ (${gbDateTimeStamp(ended)}) • Time on job: ${minsToHm(mins)} • Notes: ${notes}${photoPart}`
      );

      setActiveJobId(null);
      setCheckInAtIso("");
      writeWorkdayState(null, "");

      setCheckoutOpen(false);
      setCheckoutJobId(null);

      await loadJobs();

      if (nextJob) openNavigationToNext(currentJob, nextJob);
    } catch (e: any) {
      setWorkdayError(String(e?.message || e));
    } finally {
      setBusyJobId(null);
      loadJobs();
    }
  }

  async function handleRunningOver() {
    setWorkdayError("");
    if (!isThreeCounties) return;
    if (!currentJob) {
      setWorkdayError("No current job found.");
      return;
    }

    const raw = window.prompt("How many extra minutes do you need? (e.g. 15, 30, 45, 60)", "30");
    if (!raw) return;
    const mins = Number(raw);
    if (!Number.isFinite(mins) || mins <= 0) {
      setWorkdayError("Please enter a valid number of minutes.");
      return;
    }

    const reason = (window.prompt("Reason (optional)", "") || "").trim();
    const note = `Running over ⏱️ +${Math.round(mins)} mins${reason ? ` • ${reason}` : ""}`;

    setBusyJobId(currentJob.id);
    try {
      await extendJob(currentJob.id, Math.round(mins), note);
    } catch (e: any) {
      setWorkdayError(String(e?.message || e));
    } finally {
      setBusyJobId(null);
      loadJobs();
    }
  }

  async function handleExtraWork() {
    setWorkdayError("");
    if (!isThreeCounties) return;
    if (!currentJob) {
      setWorkdayError("No current job found.");
      return;
    }

    const request = (window.prompt("What extra work does the customer want?", "") || "").trim();
    if (!request) return;

    const estimate = (window.prompt("Rough estimate (optional) — e.g. £150 or 2 hours", "") || "").trim();
    const note = `Customer wants extra work ➕ • ${request}${estimate ? ` • Estimate: ${estimate}` : ""}`;

    setBusyJobId(currentJob.id);
    try {
      await appendStampedNote(currentJob.id, note);
    } catch (e: any) {
      setWorkdayError(String(e?.message || e));
    } finally {
      setBusyJobId(null);
      loadJobs();
    }
  }

  async function sendToChas() {
    setChasError("");
    const text = chasInput.trim();
    if (!text) return;

    setChasBusy(true);
    try {
      const res = await fetch("/api/chas/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          worker,
          jobId: chasJobId,
          question: text,
          imageDataUrl: chasImageDataUrl || "",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          (data?.status ? `(${data.status}) ` : "") +
          (data?.error || "OpenAI request failed") +
          (data?.detail ? `\n${String(data.detail).slice(0, 500)}` : "");
        setChasError(msg);
        return;
      }

      setChasImageDataUrl("");
      setChasInput("");
      await loadChasThread();
    } catch (e: any) {
      setChasError(String(e?.message || e));
    } finally {
      setChasBusy(false);
    }
  }

  const bubbleUser: React.CSSProperties = {
    background: "#111",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: 16,
    maxWidth: "85%",
    whiteSpace: "pre-wrap",
    lineHeight: 1.4,
    fontSize: 14,
  };

  const bubbleChas: React.CSSProperties = {
    background: "#f3f3f3",
    color: "#111",
    padding: "10px 12px",
    borderRadius: 16,
    maxWidth: "85%",
    whiteSpace: "pre-wrap",
    lineHeight: 1.4,
    fontSize: 14,
    border: "1px solid #e6e6e6",
  };

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* Page title row (no duplicate header — global header stays) */}
        <div style={{ ...styles.card, padding: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 950, color: palette.sub }}>Today</div>
              <div style={{ fontSize: 22, fontWeight: 980, marginTop: 2 }}>Work list</div>
              <div style={{ marginTop: 4, ...styles.sub }}>
                {gbDate(new Date())}
                {worker ? (
                  <>
                    {" "}
                    • Worker: <b style={{ color: palette.ink }}>{worker}</b>
                  </>
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setChasOpen(true)} style={styles.btnBase}>
                Ask Chas 💬
              </button>

              {/* ✅ New: Book follow-up button (minimal change) */}
              <button
                onClick={() => {
                  window.location.href = "/book-follow-up";
                }}
                style={styles.btnBase}
              >
                Book follow-up ➕
              </button>

              <button onClick={loadJobs} style={styles.btnBase}>
                Refresh
              </button>
              <button onClick={switchUser} style={styles.btnDanger}>
                Switch user ↩︎
              </button>
            </div>
          </div>
        </div>

        {/* Workday actions (Three Counties only) */}
        {isThreeCounties ? (
          <div style={{ marginTop: 14, ...styles.card, padding: 14, background: palette.soft }}>
            <div style={{ fontSize: 12, fontWeight: 950, color: palette.sub }}>Workday actions</div>
            <div style={{ marginTop: 6, ...styles.sub }}>Start 08:30 • 7h shift • 20m break • 30m prep • travel included</div>

           <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
  <button
    onClick={handleCheckIn}
    disabled={!currentJob || busyJobId === (currentJob?.id ?? -1)}
    style={{
      ...styles.btnBrand,
      opacity: !currentJob || busyJobId === (currentJob?.id ?? -1) ? 0.7 : 1,
    }}
  >
    I’m here ✅
  </button>

  <button
    onClick={startCheckoutFlow}
    disabled={!currentJob || busyJobId === (currentJob?.id ?? -1)}
    style={{
      ...styles.btnBrand,
      background: "linear-gradient(180deg, #111 0%, #000 100%)",
      opacity: !currentJob || busyJobId === (currentJob?.id ?? -1) ? 0.7 : 1,
    }}
  >
    I’m done 🏁
  </button>

  <button onClick={handleRunningOver} disabled={!currentJob} style={styles.btnBase}>
    Running over ⏱️
  </button>

  {/* ✅ NEW: Extra visit booking */}
  <button
    onClick={() => {
      const id = currentJob?.id;
      if (!id) return;
      window.location.href = `/book-follow-up?jobId=${id}&preset=extra-visit&when=nextbest`;
    }}
    disabled={!currentJob}
    style={styles.btnBase}
  >
    Need extra visit ➕
  </button>

  <button onClick={handleExtraWork} disabled={!currentJob} style={styles.btnBase}>
    Customer wants extra ➕
  </button>

  <button onClick={() => setChasOpen(true)} style={styles.btnBase}>
    Need help? Ask Chas 💬
  </button>
</div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={styles.badge}>
                Current:{" "}
                {currentJob ? (
                  <>
                    #{currentJob.id} • {currentJob.address || "(no address yet)"}
                  </>
                ) : (
                  "—"
                )}
              </span>

              <span style={styles.badge}>
                Checked in:{" "}
                {checkInAtIso ? (
                  <>
                    {new Date(checkInAtIso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} • Job #
                    {activeJobId ?? "—"}
                  </>
                ) : (
                  "No"
                )}
              </span>

              <span style={styles.badge}>
                Next: {nextJob ? `#${nextJob.id} • ${nextJob.address || "(no address yet)"}` : "None"}
              </span>
            </div>

            {workdayError ? (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 16, border: "1px solid #f2c2c2", background: "#ffecec" }}>
                <div style={{ fontWeight: 900, marginBottom: 4, fontSize: 12 }}>Workday action failed</div>
                <div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{workdayError}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {jobsError ? (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 16, border: "1px solid #f2c2c2", background: "#ffecec" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Jobs failed to load</div>
            <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{jobsError}</div>
          </div>
        ) : null}

        {/* Jobs list */}
        <div style={{ marginTop: 14 }}>
          {todaysJobs.length === 0 ? (
            <div style={{ ...styles.card, padding: 14 }}>
              <div style={{ fontWeight: 950, marginBottom: 6, fontSize: 16 }}>No jobs scheduled</div>
              <div style={{ fontSize: 13, color: palette.sub }}>
                Tap <b style={{ color: palette.ink }}>Ask Chas</b> anytime — even with nothing scheduled.
              </div>
            </div>
          ) : (
            todaysJobs.map((job) => (
              <div key={job.id} style={{ padding: 12, marginBottom: 12, borderRadius: 16, ...cardStyle(job) }}>
                <div style={{ cursor: "pointer" }} onClick={() => setOpenJobId(openJobId === job.id ? null : job.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong style={{ textDecoration: job.status === "done" ? "line-through" : "none" }}>{job.title}</strong>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>{String(job.status).toUpperCase()}</span>
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <b>Address:</b> {job.address || "(no address yet)"}
                    {job.what3words ? (
                      <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.8 }}>
                        • <b>w3w</b>: {job.what3words}
                      </span>
                    ) : null}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, color: palette.sub }}>
                    When: {gbTimeLabel(job)} • Assigned: {job.assignedTo ?? "none"} • Duration:{" "}
                    {job.durationMins + (job.overrunMins ?? 0)} mins {job.fixed ? "• FIXED" : ""}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, color: palette.sub }}>Tap job to open notes</div>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      setChasJobId(job.id);
                      setChasOpen(true);
                    }}
                    style={styles.btnBase}
                  >
                    Ask Chas about this job 💬
                  </button>

                  <button onClick={() => toggleDone(job.id)} disabled={busyJobId === job.id} style={styles.btnBase}>
                    {busyJobId === job.id ? "Working..." : job.status === "done" ? "Undo" : "Mark as Done"}
                  </button>
                </div>

                {openJobId === job.id ? (
                  <div style={{ marginTop: 12, padding: 12, background: "#ffffffaa", borderRadius: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Notes history</div>

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
                        style={{ width: "100%", padding: 10, height: 90, borderRadius: 12, border: "1px solid #ddd" }}
                      />
                      <button
                        onClick={() => submitNote(job.id)}
                        disabled={busyJobId === job.id}
                        style={{ marginTop: 8, ...styles.btnBase }}
                      >
                        {busyJobId === job.id ? "Saving..." : "Submit note"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Checkout Modal (Three Counties) */}
      {checkoutOpen ? (
        <div
          onClick={() => setCheckoutOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 12,
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 720,
              background: "#fff",
              borderRadius: 18,
              border: "1px solid #e6e6e6",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 1000 }}>Check-out 🏁</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  Job #{checkoutJobId ?? "—"} • Worker <b>{worker}</b>
                </div>
              </div>

              <button onClick={() => setCheckoutOpen(false)} style={{ padding: "8px 10px", borderRadius: 12 }}>
                Close
              </button>
            </div>

            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>End-of-job notes (required)</div>
              <textarea
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                placeholder="What was done, issues, materials used, anything Kelly needs…"
                style={{ width: "100%", padding: 10, height: 120, borderRadius: 12, border: "1px solid #ddd" }}
              />

              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900 }}>Photos (optional)</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>These will be listed in the note for now.</div>
                </div>

                <label
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                    userSelect: "none",
                  }}
                >
                  Add photos 📸
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;

                      setCheckoutFiles(files);

                      try {
                        const previews: string[] = [];
                        for (const f of files.slice(0, 4)) previews.push(await fileToDataUrl(f));
                        setCheckoutPreviews(previews);
                      } catch {
                        setCheckoutPreviews([]);
                      }

                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              {checkoutFiles.length ? (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                  <b>{checkoutFiles.length}</b> photo(s) selected
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {checkoutPreviews.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt="preview"
                        style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 12, border: "1px solid #ddd" }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutFiles([]);
                      setCheckoutPreviews([]);
                    }}
                    style={{ marginTop: 8, padding: "8px 10px", borderRadius: 12 }}
                  >
                    Remove photos
                  </button>
                </div>
              ) : null}

              {workdayError ? <div style={{ marginTop: 10, color: "crimson", fontSize: 13, whiteSpace: "pre-wrap" }}>{workdayError}</div> : null}

              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setCheckoutOpen(false)} style={{ padding: "10px 12px", borderRadius: 12 }}>
                  Cancel
                </button>

                <button
                  onClick={confirmCheckout}
                  disabled={busyJobId === checkoutJobId}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                    opacity: busyJobId === checkoutJobId ? 0.7 : 1,
                  }}
                >
                  {busyJobId === checkoutJobId ? "Saving…" : "Confirm check-out"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Chas Modal (LOCKED — unchanged) */}
      {chasOpen ? (
        <div
          onClick={() => setChasOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 12,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 900,
              height: "80vh",
              background: "#fff",
              borderRadius: 18,
              border: "1px solid #e6e6e6",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 1000 }}>Chas 💬</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Thread for <b>{worker}</b> today • logged for Kelly
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap" }}>
                <select
                  value={chasJobId ?? ""}
                  onChange={(e) => setChasJobId(e.target.value ? Number(e.target.value) : null)}
                  style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #ddd" }}
                >
                  <option value="">No job context</option>
                  {todaysJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      #{j.id} — {j.title}
                    </option>
                  ))}
                </select>

                <button onClick={() => setChasOpen(false)} style={{ padding: "8px 10px", borderRadius: 12 }}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ flex: 1, padding: 12, overflowY: "auto", background: "#fafafa" }}>
              {chasMessages.length === 0 ? (
                <div style={{ opacity: 0.75, fontSize: 13, lineHeight: 1.4 }}>
                  Ask Chas anything. Add a photo if you want plant ID / “can I cut this” advice.
                </div>
              ) : null}

              {chasMessages.map((m) => (
                <div key={m.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={bubbleUser}>
                      {m.question}
                      {m.imageDataUrl ? (
                        <div style={{ marginTop: 8 }}>
                          <img
                            src={m.imageDataUrl}
                            alt="attached"
                            style={{ width: 240, maxWidth: "100%", borderRadius: 12, display: "block" }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8 }}>
                    <div style={bubbleChas}>{m.answer || "…"}</div>
                  </div>
                </div>
              ))}

              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: 12, borderTop: "1px solid #eee", background: "#fff" }}>
              {chasImageDataUrl ? (
                <div style={{ marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <img
                    src={chasImageDataUrl}
                    alt="preview"
                    style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 12, border: "1px solid #ddd" }}
                  />
                  <button type="button" onClick={() => setChasImageDataUrl("")} style={{ padding: "8px 10px", borderRadius: 12 }}>
                    Remove photo
                  </button>
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <label
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 800,
                    userSelect: "none",
                  }}
                >
                  📸
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await fileToDataUrl(f);
                      setChasImageDataUrl(url);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>

                <textarea
                  value={chasInput}
                  onChange={(e) => setChasInput(e.target.value)}
                  placeholder="Message Chas…"
                  style={{
                    flex: 1,
                    minHeight: 44,
                    maxHeight: 110,
                    padding: 10,
                    borderRadius: 14,
                    border: "1px solid #ddd",
                    resize: "none",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!chasBusy) sendToChas();
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={sendToChas}
                  disabled={chasBusy}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                    opacity: chasBusy ? 0.7 : 1,
                  }}
                >
                  {chasBusy ? "…" : "Send"}
                </button>
              </div>

              {chasError ? <div style={{ marginTop: 8, color: "crimson", fontSize: 13, whiteSpace: "pre-wrap" }}>{chasError}</div> : null}

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>Enter to send • Shift+Enter for new line</div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}