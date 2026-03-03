"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Worker = {
  id: number;
  company: string;
  key: string;
  name: string;
  role: string;
  jobTitle?: string | null;
  photoUrl: string;
  active: boolean;
  schedulable?: boolean;
};

type Job = {
  id: number;
  company: string;

  title: string;

  address: string;
  postcode?: string;
  postcodeFull?: string;
  overview?: string;

  notes: string;
  notesLog?: string;

  hardToFind?: boolean;
  what3wordsLink?: string;

  photoUrls?: any;

  status: string;
  visitDate: string | null;
  startTime: string | null;
  assignedTo: string | null;

  fixed?: boolean;
  durationMins?: number;

  recurrenceActive?: boolean;
  recurrenceEveryWeeks?: number | null;
  recurrenceDurationMins?: number | null;
  recurrencePreferredTime?: string | null;

  createdAt: string;
  deletedAt?: string | null;
};

type Brand = {
  key: "threecounties" | "furlads";
  label: string;
  logo: string;
  primary: string;
  softBg: string;
};

const BRANDS: Brand[] = [
  { key: "threecounties", label: "Three Counties", logo: "/logos/threecounties.png", primary: "#1e7f4f", softBg: "#eef8f2" },
  { key: "furlads", label: "Furlads", logo: "/logos/furlads.png", primary: "#111111", softBg: "#fffbe6" },
];

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}
function norm(v: string) {
  return (v || "").trim().toLowerCase();
}
function toGBDate(d: Date) {
  return d.toLocaleDateString("en-GB");
}
function toGBDateTime(d: Date) {
  return d.toLocaleString("en-GB");
}
function getCompanyFromUrlOrStorage() {
  if (typeof window === "undefined") return "furlads";
  const url = new URL(window.location.href);
  const q = url.searchParams.get("company");
  if (q) return norm(q);

  const saved = localStorage.getItem("company") || localStorage.getItem("workerCompany") || "";
  if (saved) return norm(saved);

  return "furlads";
}
function safeWorkers(data: any): Worker[] {
  if (Array.isArray(data?.workers)) return data.workers as Worker[];
  if (Array.isArray(data)) return data as Worker[];
  return [];
}
function safePhotoArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => clean(x)).filter(Boolean);
  return [];
}
function parseMins(input: string, fallback: number) {
  const raw = clean(input);
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(15, Math.round(n));
}
function toWeeks(everyN: number, unit: "days" | "weeks" | "months") {
  const n = Math.max(1, Math.min(6, Math.floor(Number(everyN) || 1)));
  if (unit === "weeks") return n;
  if (unit === "months") return n * 4;
  return 1;
}
function isProbablyW3WLink(v: string) {
  const s = clean(v);
  if (!s) return false;
  return s.includes("what3words.com/");
}

async function uploadPhoto(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}). ${txt}`);
  }

  const data: any = await res.json().catch(() => ({}));
  const url = clean(data?.url);
  if (!url) throw new Error("Upload succeeded but no URL returned.");
  return url;
}

export default function MyVisitsPage() {
  const router = useRouter();

  const [company, setCompany] = useState<string>("furlads");
  const brand = useMemo(() => (company === "threecounties" ? BRANDS[0] : BRANDS[1]), [company]);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [mode, setMode] = useState<"oneoff" | "recurring">("oneoff");

  // Create form
  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [address, setAddress] = useState("");
  const [postcodeFull, setPostcodeFull] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");

  const [notes, setNotes] = useState("");

  const [hardToFind, setHardToFind] = useState(false);
  const [what3wordsLink, setWhat3wordsLink] = useState("");

  // Photos (create)
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [fixed, setFixed] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinsStr, setDurationMinsStr] = useState<string>("60");

  // Recurring
  const [recurringEveryN, setRecurringEveryN] = useState<number>(2);
  const [recurringUnit, setRecurringUnit] = useState<"days" | "weeks" | "months">("weeks");
  const [recurrenceDurationMinsStr, setRecurrenceDurationMinsStr] = useState<string>("60");

  // Success modal
  const [successOpen, setSuccessOpen] = useState(false);
  const [successNow, setSuccessNow] = useState("");
  const [successScheduledFor, setSuccessScheduledFor] = useState("");
  const [successJobId, setSuccessJobId] = useState<number | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editOverview, setEditOverview] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPostcodeFull, setEditPostcodeFull] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");

  const [editHardToFind, setEditHardToFind] = useState(false);
  const [editWhat3wordsLink, setEditWhat3wordsLink] = useState("");

  const [editFixed, setEditFixed] = useState(false);
  const [editVisitDate, setEditVisitDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editDurationMinsStr, setEditDurationMinsStr] = useState("60");

  const [appendNote, setAppendNote] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("kelly");

  // Photos (edit)
  const [editPhotoUrls, setEditPhotoUrls] = useState<string[]>([]);
  const [editUploading, setEditUploading] = useState(false);
  const [editUploadCount, setEditUploadCount] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const editPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const shell: React.CSSProperties = { minHeight: "100vh", background: brand.softBg };
  const container: React.CSSProperties = { padding: 16, maxWidth: 980, margin: "0 auto" };

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    background: "#fff",
    padding: 14,
    boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
  };

  const label: React.CSSProperties = { fontSize: 12, opacity: 0.75, marginBottom: 6, fontWeight: 900 };

  const input: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 16,
    border: "1px solid #d1d5db",
    fontSize: 16,
    minHeight: 48,
    background: "#fff",
  };

  const btn: React.CSSProperties = {
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: 16,
    padding: "12px 14px",
    fontWeight: 950,
    fontSize: 15,
    cursor: "pointer",
    minHeight: 48,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    whiteSpace: "nowrap",
  };

  const btnPrimary: React.CSSProperties = { ...btn, border: `1px solid ${brand.primary}`, background: brand.primary, color: "#fff" };
  const btnDanger: React.CSSProperties = { ...btn, border: "1px solid #ffb3b3", background: "#ffecec" };
  const btnWarn: React.CSSProperties = { ...btn, border: "1px solid #ffd27a", background: "#fff5dc" };

  const pill: React.CSSProperties = { padding: "6px 10px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fafafa", fontSize: 12, fontWeight: 900 };
  const pillAccent: React.CSSProperties = { ...pill, border: `1px solid ${brand.primary}`, background: "rgba(0,0,0,0)", color: brand.primary };

  function prettyStatus(s: string) {
    const v = clean(s).toLowerCase();
    if (!v) return "—";
    if (v === "onhold") return "On hold";
    if (v === "cancelled") return "Cancelled";
    if (v === "unscheduled") return "Unscheduled";
    if (v === "todo") return "To do";
    if (v === "done") return "Done";
    return s;
  }

  async function loadWorkers(c = company) {
    setErrorMsg("");
    try {
      const res = await fetch(`/api/workers?company=${encodeURIComponent(c)}&includeArchived=1`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Workers load failed (${res.status})`);
      setWorkers(safeWorkers(data));
    } catch (e: any) {
      setWorkers([]);
      setErrorMsg(e?.message || "Failed to load workers.");
    }
  }

  async function loadJobs(c = company) {
    const res = await fetch(`/api/jobs?company=${encodeURIComponent(c)}`, { cache: "no-store" });
    const data = await res.json().catch(() => []);
    setJobs(Array.isArray(data) ? (data as Job[]) : []);
  }

  useEffect(() => {
    const c = getCompanyFromUrlOrStorage();
    setCompany(c);
    localStorage.setItem("company", c);
    loadWorkers(c);
    loadJobs(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeWorkers = useMemo(() => workers.filter((w) => w.active), [workers]);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!clean(title)) m.push("Customer name");
    if (!clean(address)) m.push("Address");
    if (!clean(assignedTo)) m.push("Assigned to");

    if (hardToFind) {
      if (!clean(what3wordsLink)) m.push("what3words link (Hard to find is on)");
      if (clean(what3wordsLink) && !isProbablyW3WLink(what3wordsLink)) m.push("valid what3words link");
    }

    if (fixed && (!clean(visitDate) || !clean(startTime))) m.push("Date + Time (customer insists is on)");
    return m;
  }, [title, address, assignedTo, hardToFind, what3wordsLink, fixed, visitDate, startTime]);

  const canSubmit = missing.length === 0 && !loading && !uploading;

  async function onPickPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;

    setErrorMsg("");
    setUploading(true);
    setUploadCount({ done: 0, total: files.length });

    try {
      const list = Array.from(files).slice(0, 12);
      const uploaded: string[] = [];

      for (let i = 0; i < list.length; i++) {
        const url = await uploadPhoto(list[i]);
        uploaded.push(url);
        setUploadCount({ done: i + 1, total: list.length });
      }

      setPhotoUrls((prev) => [...prev, ...uploaded].slice(0, 24));
    } catch (e: any) {
      setErrorMsg(e?.message || "Photo upload failed.");
    } finally {
      setUploading(false);
      setUploadCount({ done: 0, total: 0 });
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function removePhoto(idx: number) {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onPickEditPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;

    setErrorMsg("");
    setEditUploading(true);
    setEditUploadCount({ done: 0, total: files.length });

    try {
      const list = Array.from(files).slice(0, 12);
      const uploaded: string[] = [];

      for (let i = 0; i < list.length; i++) {
        const url = await uploadPhoto(list[i]);
        uploaded.push(url);
        setEditUploadCount({ done: i + 1, total: list.length });
      }

      setEditPhotoUrls((prev) => [...prev, ...uploaded].slice(0, 24));
    } catch (e: any) {
      setErrorMsg(e?.message || "Photo upload failed.");
    } finally {
      setEditUploading(false);
      setEditUploadCount({ done: 0, total: 0 });
      if (editPhotoInputRef.current) editPhotoInputRef.current.value = "";
    }
  }

  function removeEditPhoto(idx: number) {
    setEditPhotoUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  async function rebuildDiary(workerKey: string) {
    const fromDate = new Date().toISOString().slice(0, 10);
    await fetch("/api/schedule/rebuild", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker: workerKey, fromDate, includeToday: true }),
    }).catch(() => {});
  }

  function scheduledForLabel(j: { visitDate: any; startTime: any }) {
    if (j?.visitDate) {
      const d = new Date(j.visitDate);
      const dd = toGBDate(d);
      const t = clean(j.startTime);
      return t ? `${dd} ${t}` : dd;
    }
    return "UNSCHEDULED (auto-schedule)";
  }

  async function patchJob(jobId: number, payload: any) {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Update failed (${res.status}). ${txt}`);
    }
    return await res.json().catch(() => ({}));
  }

  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!canSubmit) {
      setErrorMsg(`Please fill: ${missing.join(", ")}`);
      return;
    }

    setLoading(true);
    try {
      const recurrenceActive = mode === "recurring";
      const recurrenceEveryWeeks = recurrenceActive ? toWeeks(recurringEveryN, recurringUnit) : null;

      const durationMins = parseMins(durationMinsStr, 60);
      const recurrenceDurationMins = parseMins(recurrenceDurationMinsStr, 60);

      const payload: any = {
        company,
        title: clean(title),

        address: clean(address),
        postcodeFull: clean(postcodeFull),
        overview: clean(overview),

        notes: clean(notes),

        assignedTo: clean(assignedTo).toLowerCase(),

        hardToFind: !!hardToFind,
        what3wordsLink: hardToFind ? clean(what3wordsLink) : "",

        photoUrls,

        fixed: !!fixed,
        visitDate: fixed ? clean(visitDate) : null,
        startTime: fixed ? clean(startTime) : null,
        durationMins,

        recurrenceActive,
        recurrenceEveryWeeks,
        recurrenceDurationMins: recurrenceActive ? recurrenceDurationMins : null,
        recurrencePreferredDOW: null,
        recurrencePreferredTime: recurrenceActive && fixed ? clean(startTime) : null,
      };

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to add job (${res.status}). ${txt}`);
      }

      const created: any = await res.json().catch(() => ({}));

      await rebuildDiary(clean(assignedTo).toLowerCase());

      // reset
      setTitle("");
      setOverview("");
      setAddress("");
      setPostcodeFull("");
      setNotes("");

      setHardToFind(false);
      setWhat3wordsLink("");

      setPhotoUrls([]);

      setAssignedTo("");

      setFixed(false);
      setVisitDate("");
      setStartTime("");
      setDurationMinsStr("60");

      setRecurringEveryN(2);
      setRecurringUnit("weeks");
      setRecurrenceDurationMinsStr("60");

      setMode("oneoff");

      await loadJobs(company);

      setSuccessNow(toGBDateTime(new Date()));
      setSuccessScheduledFor(scheduledForLabel(created?.visitDate ? created : { visitDate: null, startTime: null }));
      setSuccessJobId(typeof created?.id === "number" ? created.id : null);
      setSuccessOpen(true);
    } catch (e: any) {
      setErrorMsg(e?.message || "Add failed.");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(j: Job) {
    setErrorMsg("");
    setEditJob(j);

    setEditTitle(clean(j.title || ""));
    setEditOverview(clean(j.overview || ""));
    setEditAddress(clean(j.address || ""));
    setEditPostcodeFull(clean(j.postcodeFull || ""));
    setEditAssignedTo(clean(j.assignedTo || ""));

    setEditHardToFind(!!j.hardToFind);
    setEditWhat3wordsLink(clean(j.what3wordsLink || ""));

    setEditFixed(!!j.fixed);
    setEditVisitDate(j.visitDate ? String(j.visitDate).slice(0, 10) : "");
    setEditStartTime(clean(j.startTime || ""));
    setEditDurationMinsStr(String(typeof j.durationMins === "number" ? j.durationMins : 60));

    setEditPhotoUrls(safePhotoArray(j.photoUrls));

    setAppendNote("");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editJob) return;

    if (!clean(editTitle)) return setErrorMsg("Customer name cannot be empty.");
    if (!clean(editAddress)) return setErrorMsg("Address cannot be empty.");
    if (!clean(editAssignedTo)) return setErrorMsg("Assigned to cannot be empty.");
    if (editHardToFind) {
      if (!clean(editWhat3wordsLink)) return setErrorMsg("what3words link required when Hard to find is on.");
      if (!isProbablyW3WLink(editWhat3wordsLink)) return setErrorMsg("Please paste a valid what3words link.");
    }
    if (editFixed && (!clean(editVisitDate) || !clean(editStartTime))) return setErrorMsg("If fixed is on, Visit date + Start time are required.");

    setErrorMsg("");
    setLoading(true);
    try {
      await patchJob(editJob.id, {
        title: clean(editTitle),
        overview: clean(editOverview),
        address: clean(editAddress),
        postcodeFull: clean(editPostcodeFull),
        assignedTo: clean(editAssignedTo).toLowerCase(),

        hardToFind: !!editHardToFind,
        what3wordsLink: editHardToFind ? clean(editWhat3wordsLink) : "",

        fixed: !!editFixed,
        visitDate: editFixed ? clean(editVisitDate) : null,
        startTime: editFixed ? clean(editStartTime) : null,
        durationMins: parseMins(editDurationMinsStr, 60),

        photoUrls: editPhotoUrls,
      });

      await rebuildDiary(clean(editAssignedTo).toLowerCase());
      await loadJobs(company);

      setEditOpen(false);
      setEditJob(null);
    } catch (e: any) {
      setErrorMsg(e?.message || "Edit failed.");
    } finally {
      setLoading(false);
    }
  }

  async function addExtraNote() {
    if (!editJob) return;
    const note = clean(appendNote);
    if (!note) return;

    setErrorMsg("");
    setLoading(true);
    try {
      await patchJob(editJob.id, { appendNote: note, noteAuthor: clean(noteAuthor) || "kelly" });

      setAppendNote("");
      await loadJobs(company);

      const fresh = jobs.find((x) => x.id === editJob.id);
      if (fresh) setEditJob(fresh);
    } catch (e: any) {
      setErrorMsg(e?.message || "Add note failed.");
    } finally {
      setLoading(false);
    }
  }

  async function setJobStatus(nextStatus: "onhold" | "cancelled" | "unscheduled" | "todo" | "done") {
    if (!editJob) return;
    setErrorMsg("");
    setLoading(true);
    try {
      await patchJob(editJob.id, { setStatus: nextStatus });
      await loadJobs(company);

      const fresh = jobs.find((x) => x.id === editJob.id);
      if (fresh) setEditJob(fresh);
    } catch (e: any) {
      setErrorMsg(e?.message || "Status update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteJob() {
    if (!editJob) return;

    const ok = window.confirm(`Delete job #${editJob.id}?\n\nThis hides it from the system (soft delete).`);
    if (!ok) return;

    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${editJob.id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Delete failed (${res.status}). ${txt}`);
      }

      await loadJobs(company);
      setEditOpen(false);
      setEditJob(null);
    } catch (e: any) {
      setErrorMsg(e?.message || "Delete failed.");
    } finally {
      setLoading(false);
    }
  }

function goDashboard() {
  router.push("/kelly/combined?as=kelly");
}

  function switchUser() {
    const ok = window.confirm("Switch user?\n\nThis will take you back to the worker selection screen.");
    if (!ok) return;

    try {
      // Clear common local keys
      localStorage.removeItem("workerKey");
      localStorage.removeItem("workerName");
      localStorage.removeItem("workerId");
      localStorage.removeItem("workerCompany");

      // Optional: also clear company selection so it defaults cleanly
      localStorage.removeItem("company");
    } catch {}

    router.push("/kelly/workers");
  }

  const displayedJobs = useMemo(() => [...jobs].slice(0, 60), [jobs]);

  return (
    <main style={shell}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", borderBottom: `3px solid ${brand.primary}` }}>
        <div style={container}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logo} alt={brand.label} style={{ height: 34, objectFit: "contain" }} />
              <div style={{ fontWeight: 950, fontSize: 18 }}>Add Job</div>
              <span style={pillAccent}>{brand.label}</span>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={company}
                onChange={(e) => {
                  const next = norm(e.target.value);
                  setCompany(next);
                  localStorage.setItem("company", next);

                  setAssignedTo("");
                  loadWorkers(next);
                  loadJobs(next);
                }}
                style={{ ...input, width: 220 }}
              >
                <option value="threecounties">Three Counties</option>
                <option value="furlads">Furlads</option>
              </select>

              {/* ✅ NEW buttons */}
              <button style={btn} type="button" onClick={goDashboard} disabled={loading || uploading || editUploading}>
                Return to dashboard
              </button>

              <button style={btn} type="button" onClick={switchUser} disabled={loading || uploading || editUploading}>
                Switch user
              </button>

              <button style={btn} type="button" onClick={() => loadJobs(company)} disabled={loading || uploading || editUploading}>
                Refresh jobs
              </button>
            </div>
          </div>

          {errorMsg ? (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 16, border: "1px solid #ffb3b3", background: "#ffecec" }}>
              <b>Oops:</b> {errorMsg}
            </div>
          ) : null}
        </div>
      </div>

      {/* ====== rest of file unchanged ====== */}
      {/* NOTE: Everything below is identical to the locked version except for the top-bar buttons added above. */}

      <div style={container}>
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setMode("oneoff")}
              style={{
                ...btn,
                border: mode === "oneoff" ? `2px solid ${brand.primary}` : "1px solid #d1d5db",
                background: mode === "oneoff" ? "rgba(0,0,0,0.02)" : "#fff",
                minHeight: 44,
                padding: "10px 12px",
              }}
            >
              One-off job
            </button>

            <button
              type="button"
              onClick={() => setMode("recurring")}
              style={{
                ...btn,
                border: mode === "recurring" ? `2px solid ${brand.primary}` : "1px solid #d1d5db",
                background: mode === "recurring" ? "rgba(0,0,0,0.02)" : "#fff",
                minHeight: 44,
                padding: "10px 12px",
              }}
            >
              Regular maintenance
            </button>

            <span style={{ marginLeft: "auto", ...pill }}>{mode === "oneoff" ? "Flexible by default (auto-schedule)" : "Recurring rule (auto-schedule)"}</span>
          </div>

          <form onSubmit={addJob} style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={label}>Customer name *</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
            </div>

            <div>
              <div style={label}>Brief overview of works</div>
              <textarea value={overview} onChange={(e) => setOverview(e.target.value)} style={{ ...input, minHeight: 84 }} />
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1.6fr 1fr" }}>
              <div>
                <div style={label}>Address *</div>
                <input value={address} onChange={(e) => setAddress(e.target.value)} style={input} />
              </div>

              <div>
                <div style={label}>Postcode (full)</div>
                <input value={postcodeFull} onChange={(e) => setPostcodeFull(e.target.value)} style={input} placeholder="e.g. TF9 1AA" />
              </div>
            </div>

            <div style={{ ...card, background: "#fafafa", boxShadow: "none" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                  <input
                    type="checkbox"
                    checked={hardToFind}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setHardToFind(on);
                      if (!on) setWhat3wordsLink("");
                    }}
                  />
                  Is it hard to find?
                </label>

                <a href="https://what3words.com" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontWeight: 950, textDecoration: "underline" }}>
                  Open what3words ↗
                </a>
              </div>

              {hardToFind ? (
                <div style={{ marginTop: 10 }}>
                  <div style={label}>Attach what3words link here *</div>
                  <input value={what3wordsLink} onChange={(e) => setWhat3wordsLink(e.target.value)} style={input} />
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>Leave this off unless it’s genuinely hard to locate.</div>
              )}
            </div>

            <div>
              <div style={label}>Assigned to *</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {activeWorkers.length === 0 ? (
                  <div style={{ padding: 12, borderRadius: 16, border: "1px dashed #ddd", background: "#fafafa", opacity: 0.9 }}>No active workers found for this company.</div>
                ) : (
                  activeWorkers.map((w) => {
                    const selected = assignedTo === w.key;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setAssignedTo(w.key)}
                        style={{
                          ...btn,
                          justifyContent: "flex-start",
                          border: selected ? `2px solid ${brand.primary}` : "1px solid #d1d5db",
                          background: selected ? "rgba(0,0,0,0.02)" : "#fff",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.photoUrl || "/favicon.ico"} alt={w.name} style={{ width: 34, height: 34, borderRadius: 12, objectFit: "cover", border: "1px solid #e5e7eb" }} />
                        <div style={{ display: "grid", gap: 2, textAlign: "left" }}>
                          <div style={{ fontWeight: 950 }}>{w.name}</div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>{w.jobTitle || w.role || ""}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <div style={label}>Notes (LOCKED once added)</div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...input, minHeight: 110 }} />
            </div>

            {/* Photos */}
            <div style={{ ...card, background: "#fafafa", boxShadow: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 950 }}>Attach photos</div>

                <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onPickPhotos(e.target.files)} disabled={uploading || loading} />

                <button type="button" style={btn} onClick={() => photoInputRef.current?.click()} disabled={uploading || loading}>
                  {uploading ? `Uploading ${uploadCount.done}/${uploadCount.total}…` : "Choose photos"}
                </button>
              </div>

              {photoUrls.length > 0 ? (
                <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                  {photoUrls.map((u, idx) => (
                    <div key={`${u}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 10, background: "#fff" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="Job photo" style={{ width: "100%", height: 110, borderRadius: 12, objectFit: "cover", border: "1px solid #e5e7eb" }} />
                      <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                        <a href={u} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 900, textDecoration: "underline" }}>
                          Open ↗
                        </a>
                        <button type="button" style={{ ...btnDanger, padding: "8px 10px", minHeight: 36, fontSize: 13 }} onClick={() => removePhoto(idx)} disabled={uploading || loading}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>Optional — add photos for access, before/after, etc.</div>
              )}
            </div>

            <div style={{ ...card, background: "#fafafa", boxShadow: "none" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                  <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
                  Customer insists on a set day/time
                </label>

                <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Duration (mins)</div>
                  <input type="number" value={durationMinsStr} onChange={(e) => setDurationMinsStr(e.target.value)} style={{ ...input, width: 140 }} min={15} step={15} disabled={loading || uploading} />
                </div>
              </div>

              {fixed ? (
                <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <div style={label}>Visit date</div>
                    <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} style={input} disabled={loading || uploading} />
                  </div>

                  <div>
                    <div style={label}>Start time</div>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={input} disabled={loading || uploading} />
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>Leave this off and it’ll drop into the plan automatically.</div>
              )}
            </div>

            {mode === "recurring" ? (
              <div style={{ ...card, background: "#fafafa", boxShadow: "none" }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Regular maintenance</div>

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                  <div>
                    <div style={label}>Every</div>
                    <select value={String(recurringEveryN)} onChange={(e) => setRecurringEveryN(Number(e.target.value))} style={input} disabled={loading || uploading}>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={label}>Unit</div>
                    <select value={recurringUnit} onChange={(e) => setRecurringUnit(e.target.value as any)} style={input} disabled={loading || uploading}>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Backend schedules in weeks — days/months are mapped into weeks for now.</div>
                  </div>

                  <div>
                    <div style={label}>Recurring duration (mins)</div>
                    <input type="number" value={recurrenceDurationMinsStr} onChange={(e) => setRecurrenceDurationMinsStr(e.target.value)} style={input} min={15} step={15} disabled={loading || uploading} />
                  </div>
                </div>
              </div>
            ) : null}

            <button type="submit" style={btnPrimary} disabled={!canSubmit}>
              {loading ? "Adding…" : uploading ? "Uploading photos…" : mode === "recurring" ? "Add regular maintenance" : "Add job"}
            </button>
          </form>
        </div>

        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Latest jobs</div>
            <span style={pill}>Showing {displayedJobs.length}</span>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {displayedJobs.map((j) => {
              const p = safePhotoArray(j.photoUrls);

              return (
                <div key={j.id} style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 12, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>{j.title}</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button type="button" style={btn} onClick={() => openEdit(j)} disabled={loading || uploading || editUploading}>
                        Edit
                      </button>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Assigned: <b>{j.assignedTo ?? "—"}</b> • Status: <b>{prettyStatus(j.status)}</b>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 6, opacity: 0.9 }}>{j.address}</div>

                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={pill}>
                      Visit: {j.visitDate ? `${toGBDate(new Date(j.visitDate))}${j.startTime ? ` ${j.startTime}` : ""}` : "UNSCHEDULED"}
                    </span>
                    {typeof j.durationMins === "number" ? <span style={pill}>Duration: {j.durationMins} mins</span> : null}
                    {j.recurrenceActive ? <span style={pillAccent}>Recurring</span> : null}
                    {j.hardToFind ? <span style={pillAccent}>Hard to find</span> : null}
                  </div>

                  {j.what3wordsLink ? (
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                      <b>what3words:</b>{" "}
                      <a href={j.what3wordsLink} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", fontWeight: 900 }}>
                        Open ↗
                      </a>
                    </div>
                  ) : null}

                  {p.length > 0 ? (
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {p.slice(0, 6).map((u, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={`${u}-${idx}`} src={u} alt="job-photo" style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover", border: "1px solid #e5e7eb" }} />
                      ))}
                    </div>
                  ) : null}

                  {j.notes ? (
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                      <b>Notes (locked):</b> {j.notes}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Success popup */}
      {successOpen ? (
        <div onClick={() => setSuccessOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)", background: "#fff", borderRadius: 18, border: "1px solid #e5e7eb", padding: 14, boxShadow: "0 18px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>✅ Job successfully added</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 14 }}>
              <div>
                <b>Saved at:</b> {successNow}
              </div>
              <div>
                <b>Scheduled for:</b> {successScheduledFor}
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {successJobId ? (
                <button
                  type="button"
                  style={btn}
                  onClick={() => {
                    const j = jobs.find((x) => x.id === successJobId);
                    if (j) {
                      setSuccessOpen(false);
                      openEdit(j);
                    }
                  }}
                >
                  Edit this job
                </button>
              ) : null}

              <button type="button" style={btnPrimary} onClick={() => setSuccessOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit modal */}
      {editOpen && editJob ? (
        <div onClick={() => setEditOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", padding: 16 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(820px, 100%)",
              background: "#fff",
              borderRadius: 18,
              border: "1px solid #e5e7eb",
              boxShadow: "0 18px 60px rgba(0,0,0,0.18)",
              maxHeight: "85vh",
              overflowY: "auto",
              paddingBottom: 90,
            }}
          >
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 950, fontSize: 18 }}>
                  Edit job #{editJob.id} <span style={{ ...pill, marginLeft: 8 }}>{prettyStatus(editJob.status)}</span>
                </div>
                <button type="button" style={btn} onClick={() => setEditOpen(false)}>
                  Close
                </button>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {/* Actions */}
                <div style={{ ...card, background: "#fafafa", boxShadow: "none" }}>
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>Job actions</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {editJob.status !== "onhold" ? (
                      <button type="button" style={btnWarn} onClick={() => setJobStatus("onhold")} disabled={loading || editUploading}>
                        Put on hold
                      </button>
                    ) : (
                      <button type="button" style={btn} onClick={() => setJobStatus("unscheduled")} disabled={loading || editUploading}>
                        Take off hold
                      </button>
                    )}

                    {editJob.status !== "cancelled" ? (
                      <button type="button" style={btnDanger} onClick={() => setJobStatus("cancelled")} disabled={loading || editUploading}>
                        Cancel job
                      </button>
                    ) : (
                      <button type="button" style={btn} onClick={() => setJobStatus("unscheduled")} disabled={loading || editUploading}>
                        Re-open job
                      </button>
                    )}

                    <button type="button" style={btnDanger} onClick={deleteJob} disabled={loading || editUploading}>
                      Delete (hide)
                    </button>

                    <span style={{ marginLeft: "auto", ...pill }}>Created: {editJob.createdAt ? toGBDateTime(new Date(editJob.createdAt)) : "—"}</span>
                  </div>
                </div>

                <div>
                  <div style={label}>Customer name</div>
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={input} />
                </div>

                <div>
                  <div style={label}>Overview</div>
                  <textarea value={editOverview} onChange={(e) => setEditOverview(e.target.value)} style={{ ...input, minHeight: 84 }} />
                </div>

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1.6fr 1fr" }}>
                  <div>
                    <div style={label}>Address</div>
                    <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} style={input} />
                  </div>

                  <div>
                    <div style={label}>Postcode (full)</div>
                    <input value={editPostcodeFull} onChange={(e) => setEditPostcodeFull(e.target.value)} style={input} />
                  </div>
                </div>

                <div>
                  <div style={label}>Assigned to</div>
                  <input value={editAssignedTo} onChange={(e) => setEditAssignedTo(e.target.value)} style={input} placeholder="worker key (e.g. jacobwalters)" />
                </div>

                <div style={{ ...card, background: "#fafafa", boxShadow: "none" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                      <input
                        type="checkbox"
                        checked={editHardToFind}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setEditHardToFind(on);
                          if (!on) setEditWhat3wordsLink("");
                        }}
                      />
                      Is it hard to find?
                    </label>

                    <a href="https://what3words.com" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontWeight: 950, textDecoration: "underline" }}>
                      Open what3words ↗
                    </a>
                  </div>

                  {editHardToFind ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={label}>Attach what3words link here *</div>
                      <input value={editWhat3wordsLink} onChange={(e) => setEditWhat3wordsLink(e.target.value)} style={input} />
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>Leave this off unless it’s genuinely hard to locate.</div>
                  )}
                </div>

                {/* Edit photos */}
                <div style={{ ...card, background: "#fafafa", boxShadow: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 950 }}>Photos</div>

                    <input ref={editPhotoInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onPickEditPhotos(e.target.files)} disabled={editUploading || loading} />

                    <button type="button" style={btn} onClick={() => editPhotoInputRef.current?.click()} disabled={editUploading || loading}>
                      {editUploading ? `Uploading ${editUploadCount.done}/${editUploadCount.total}…` : "Add photos"}
                    </button>
                  </div>

                  {editPhotoUrls.length > 0 ? (
                    <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                      {editPhotoUrls.map((u, idx) => (
                        <div key={`${u}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 10, background: "#fff" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="Job photo" style={{ width: "100%", height: 110, borderRadius: 12, objectFit: "cover", border: "1px solid #e5e7eb" }} />
                          <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                            <a href={u} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 900, textDecoration: "underline" }}>
                              Open ↗
                            </a>
                            <button type="button" style={{ ...btnDanger, padding: "8px 10px", minHeight: 36, fontSize: 13 }} onClick={() => removeEditPhoto(idx)} disabled={editUploading || loading}>
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>No photos yet.</div>
                  )}
                </div>

                <div style={{ ...card, background: "#fafafa", boxShadow: "none" }}>
                  <div style={{ fontWeight: 950 }}>Notes (locked)</div>
                  <div style={{ marginTop: 8, whiteSpace: "pre-wrap", opacity: 0.9 }}>{editJob.notes || "—"}</div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 950 }}>Add note to log</div>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Author</span>
                        <input value={noteAuthor} onChange={(e) => setNoteAuthor(e.target.value)} style={{ ...input, width: 160 }} />
                      </div>
                    </div>

                    <textarea value={appendNote} onChange={(e) => setAppendNote(e.target.value)} style={{ ...input, minHeight: 90 }} placeholder="Add an update (this appends to notesLog)..." />

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="button" style={btnPrimary} onClick={addExtraNote} disabled={loading || editUploading || !clean(appendNote)}>
                        {loading ? "Saving…" : "Add note"}
                      </button>
                    </div>

                    {editJob.notesLog ? (
                      <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "pre-wrap" }}>
                        <b>Notes log:</b>
                        {"\n"}
                        {editJob.notesLog}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky footer */}
            <div style={{ position: "sticky", bottom: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(6px)", borderTop: "1px solid #e5e7eb", padding: 12, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" style={btn} onClick={() => setEditOpen(false)} disabled={loading || editUploading}>
                Cancel
              </button>
              <button type="button" style={btnPrimary} onClick={saveEdit} disabled={loading || editUploading}>
                {loading ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @media (max-width: 860px) {
          main div[style*="gridTemplateColumns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          main div[style*="gridTemplateColumns: 1fr 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}