"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CompanyKey = "furlads" | "threecounties";
type WorkerKey = "trev" | "kelly" | "jacob";

type JobStatus = "todo" | "in_progress" | "done";
type FollowUpType = "booking" | "quote" | "acknowledge" | "";

// Quick worker flags (for Kelly end-of-day + ops)
type BlockedReason =
  | ""
  | "gate_locked"
  | "no_access"
  | "customer_not_home"
  | "weather"
  | "materials_missing"
  | "danger";

type RunningOver = {
  mins: number;
  reason?: string;
  at: string; // ISO
  by: WorkerKey;
};

type ExtraRequest =
  | {
      kind: "extra_today";
      size: "30m" | "60m" | "half_day" | "full_day" | "custom";
      mins?: number; // if custom
      details?: string;
      at: string;
      by: WorkerKey;
    }
  | {
      kind: "extra_visit";
      urgency: "asap" | "next_week" | "two_weeks" | "custom";
      when?: string; // if custom
      details?: string;
      at: string;
      by: WorkerKey;
    };

type RescheduleRequest = {
  to: "tomorrow" | "next_week" | "custom";
  when?: string;
  reason?: string;
  at: string;
  by: WorkerKey;
};

type OnSiteSession = {
  startAt: string; // ISO
  endAt?: string; // ISO
  minutes?: number;
};

// First visit questionnaire (stored on the job)
type FirstVisitQuestionnaire = {
  // THIS FLAG controls whether the questionnaire is available
  isFirstVisit: boolean;

  completedAt?: string; // ISO
  completedBy?: WorkerKey;

  // Core planning info
  overallGoal?: string;
  priorityAreas?: string;
  visitFrequency?: "weekly" | "fortnightly" | "monthly" | "seasonal" | "ad_hoc" | "";
  preferredDayTime?: string;
  budgetGuideline?: string;
  seasonalFocus?: string;

  // Access / practical
  gateAccess?: string;
  parking?: string;
  pets?: string;
  waterAccess?: string;
  wastePreference?: string;
  what3wordsConfirm?: string;

  // Comms + quality
  customerNotes?: string;
  photoConsent?: "yes" | "no" | "";

  // Stamped log (append-only)
  log?: string; // stamped lines
};

type MaintenanceJob = {
  id: string;
  title: string;
  address: string;
  notes?: string;

  scheduledDate?: string; // YYYY-MM-DD
  assignedTo?: WorkerKey; // trev | jacob (kelly admin)
  durationMins?: number; // default 60
  travelMins?: number; // default 10
  delayMins?: number; // worker "push back" per-job

  what3words?: string;

  status: JobStatus;

  // Worker notes (stamped log)
  completionNotes?: string; // stamped log
  completedOn?: string; // YYYY-MM-DD

  followUpNeeded?: boolean;
  followUpType?: FollowUpType;
  followUpNote?: string; // stamped log
  acknowledged?: boolean;

  moreTimeRequested?: boolean;
  moreTimeMins?: number;

  // On-site clocking
  onSiteActive?: boolean;
  onSiteStartAt?: string; // ISO (only when active)
  onSiteSessions?: OnSiteSession[];
  onSiteMinutesTotal?: number;

  // Worker quick flags
  runningOver?: RunningOver[];
  blocked?: {
    reason: BlockedReason;
    note?: string;
    at: string;
    by: WorkerKey;
  }[];
  extraRequests?: ExtraRequest[];
  rescheduleRequests?: RescheduleRequest[];

  // First visit questionnaire
  firstVisit?: FirstVisitQuestionnaire;

  createdAt: string; // ISO
  updatedAt: string; // ISO
};

type PhotoRecord = {
  id: string;
  jobId: string;
  createdAt: string; // ISO
  name: string;
  type: string;
  blob: Blob;
};

type PhotoView = {
  id: string;
  jobId: string;
  createdAt: string;
  name: string;
  type: string;
  url: string; // object URL
};

const LS_KEYS = {
  company: "company",
  worker: "worker",
  tcJobs: "threecounties_jobs_v1",
};

const ADMIN_WORKERS: WorkerKey[] = ["trev", "kelly"];

const DAY_START_HOUR = 8;
const DAY_START_MIN = 30; // 08:30
const DAY_WORK_MINS = 7 * 60; // 7h from 08:30 = 15:30
const PREP_MINS = 30;
const BREAK_MINS = 20;
const BREAK_TARGET_HOUR = 12;
const BREAK_TARGET_MIN = 0;

// IndexedDB (photos)
const DB_NAME = "maintenance_app_v1";
const DB_VERSION = 1;
const STORE_PHOTOS = "tc_photos_v1";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function minutesFromDayStart(h: number, m: number) {
  return h * 60 + m - (DAY_START_HOUR * 60 + DAY_START_MIN);
}

function minsToClock(minsFromStart: number) {
  const total = DAY_START_HOUR * 60 + DAY_START_MIN + minsFromStart;
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return `${pad2(h)}:${pad2(mm)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeParseJobs(raw: string | null): MaintenanceJob[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((j) => j && typeof j === "object")
      .map((j) => ({
        id: String(j.id ?? ""),
        title: String(j.title ?? ""),
        address: String(j.address ?? ""),
        notes: j.notes ? String(j.notes) : "",
        scheduledDate: j.scheduledDate ? String(j.scheduledDate) : "",
        assignedTo: (j.assignedTo as WorkerKey) ?? undefined,
        durationMins:
          typeof j.durationMins === "number" && Number.isFinite(j.durationMins)
            ? j.durationMins
            : undefined,
        travelMins:
          typeof j.travelMins === "number" && Number.isFinite(j.travelMins)
            ? j.travelMins
            : undefined,
        delayMins:
          typeof j.delayMins === "number" && Number.isFinite(j.delayMins)
            ? j.delayMins
            : undefined,
        what3words: j.what3words ? String(j.what3words) : "",
        status: (j.status as JobStatus) ?? "todo",
        completionNotes: j.completionNotes ? String(j.completionNotes) : "",
        completedOn: j.completedOn ? String(j.completedOn) : "",
        followUpNeeded: Boolean(j.followUpNeeded ?? false),
        followUpType: (j.followUpType as FollowUpType) ?? "",
        followUpNote: j.followUpNote ? String(j.followUpNote) : "",
        acknowledged: Boolean(j.acknowledged ?? false),
        moreTimeRequested: Boolean(j.moreTimeRequested ?? false),
        moreTimeMins:
          typeof j.moreTimeMins === "number" && Number.isFinite(j.moreTimeMins)
            ? j.moreTimeMins
            : undefined,
        onSiteActive: Boolean(j.onSiteActive ?? false),
        onSiteStartAt: j.onSiteStartAt ? String(j.onSiteStartAt) : "",
        onSiteSessions: Array.isArray(j.onSiteSessions)
          ? (j.onSiteSessions as OnSiteSession[])
          : [],
        onSiteMinutesTotal:
          typeof j.onSiteMinutesTotal === "number" && Number.isFinite(j.onSiteMinutesTotal)
            ? j.onSiteMinutesTotal
            : 0,
        runningOver: Array.isArray(j.runningOver) ? (j.runningOver as RunningOver[]) : [],
        blocked: Array.isArray(j.blocked)
          ? (j.blocked as MaintenanceJob["blocked"])
          : [],
        extraRequests: Array.isArray(j.extraRequests)
          ? (j.extraRequests as ExtraRequest[])
          : [],
        rescheduleRequests: Array.isArray(j.rescheduleRequests)
          ? (j.rescheduleRequests as RescheduleRequest[])
          : [],
        firstVisit:
          j.firstVisit && typeof j.firstVisit === "object"
            ? (j.firstVisit as FirstVisitQuestionnaire)
            : undefined,
        createdAt: String(j.createdAt ?? new Date().toISOString()),
        updatedAt: String(j.updatedAt ?? new Date().toISOString()),
      }))
      .filter((j) => j.id && j.title && j.address);
  } catch {
    return [];
  }
}

function saveJobs(jobs: MaintenanceJob[]) {
  try {
    localStorage.setItem(LS_KEYS.tcJobs, JSON.stringify(jobs));
  } catch {
    // ignore
  }
}

function diffMinutes(startISO: string, endISO: string) {
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  return Math.max(0, Math.round((e - s) / 60000));
}

function formatDuration(mins: number) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

function workerLabel(w: WorkerKey) {
  if (w === "trev") return "Trev";
  if (w === "jacob") return "Jacob";
  return "Kelly";
}

function stampLine(worker: WorkerKey, text: string) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const stamp = `[${yyyy}-${mm}-${dd} ${hh}:${mi}] ${workerLabel(worker)}`;
  return `${stamp}: ${text.trim()}`;
}

function openGoogleMapsNavigation(destination: string) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    // ignore
  }
}

// ---------------- IndexedDB helpers (no external libs) ----------------
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        const store = db.createObjectStore(STORE_PHOTOS, { keyPath: "id" });
        store.createIndex("jobId", "jobId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addPhotosToDb(jobId: string, files: File[]) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, "readwrite");
    const store = tx.objectStore(STORE_PHOTOS);
    for (const f of files) {
      const rec: PhotoRecord = {
        id: crypto.randomUUID(),
        jobId,
        createdAt: new Date().toISOString(),
        name: f.name,
        type: f.type || "image/*",
        blob: f,
      };
      store.put(rec);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function listPhotosForJob(jobId: string): Promise<PhotoRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, "readonly");
    const store = tx.objectStore(STORE_PHOTOS);
    const idx = store.index("jobId");
    const req = idx.getAll(jobId);
    req.onsuccess = () => {
      const out = (req.result as PhotoRecord[]) ?? [];
      out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      db.close();
      resolve(out);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function deletePhotoFromDb(photoId: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, "readwrite");
    const store = tx.objectStore(STORE_PHOTOS);
    store.delete(photoId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

// ---------------- Scheduling blocks ----------------
type DayBlock =
  | { kind: "prep" | "break" | "wrap"; label: string; startMins: number; endMins: number }
  | { kind: "travel"; label: string; startMins: number; endMins: number; jobId: string }
  | { kind: "job"; label: string; startMins: number; endMins: number; job: MaintenanceJob };

function blockedLabel(r: BlockedReason) {
  switch (r) {
    case "gate_locked":
      return "Gate locked";
    case "no_access":
      return "No access";
    case "customer_not_home":
      return "Customer not home";
    case "weather":
      return "Weather stopped work";
    case "materials_missing":
      return "Materials missing";
    case "danger":
      return "Danger / unsafe";
    default:
      return "Blocked";
  }
}

type AskChasPreset =
  | "general"
  | "plant_id"
  | "pest_disease"
  | "pruning"
  | "watering_drainage"
  | "hardscape"
  | "customer_extra";

function askChasPresetLabel(p: AskChasPreset) {
  switch (p) {
    case "plant_id":
      return "Plant ID / care";
    case "pest_disease":
      return "Pest / disease";
    case "pruning":
      return "Pruning";
    case "watering_drainage":
      return "Watering / drainage";
    case "hardscape":
      return "Hardscape issue";
    case "customer_extra":
      return "Customer asked for extra";
    default:
      return "General";
  }
}

export default function CalendarPage() {
  const router = useRouter();

  const [company, setCompany] = useState<CompanyKey | null>(null);
  const [worker, setWorker] = useState<WorkerKey | null>(null);
  const [ready, setReady] = useState(false);

  const [jobs, setJobs] = useState<MaintenanceJob[]>([]);
  const [date, setDate] = useState<string>(todayYYYYMMDD());

  const [photoViews, setPhotoViews] = useState<Record<string, PhotoView[]>>({});
  const objectUrlsRef = useRef<string[]>([]);

  const [, setTick] = useState(0);

  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const [draftWorkNote, setDraftWorkNote] = useState<Record<string, string>>({});
  const [draftFollowupNote, setDraftFollowupNote] = useState<Record<string, string>>({});

  // Quick action inline UIs
  const [openOverrunForJob, setOpenOverrunForJob] = useState<string | null>(null);
  const [openExtraForJob, setOpenExtraForJob] = useState<string | null>(null);
  const [openBlockedForJob, setOpenBlockedForJob] = useState<string | null>(null);
  const [openRescheduleForJob, setOpenRescheduleForJob] = useState<string | null>(null);
  const [openAskChasForJob, setOpenAskChasForJob] = useState<string | null>(null);

  // FIRST VISIT questionnaire panel
  const [openFirstVisitForJob, setOpenFirstVisitForJob] = useState<string | null>(null);

  // Quick action draft fields
  const [overrunReason, setOverrunReason] = useState<Record<string, string>>({});
  const [blockedNote, setBlockedNote] = useState<Record<string, string>>({});
  const [blockedReason, setBlockedReason] = useState<Record<string, BlockedReason>>({});
  const [extraDetails, setExtraDetails] = useState<Record<string, string>>({});
  const [extraCustomMins, setExtraCustomMins] = useState<Record<string, string>>({});
  const [rescheduleReason, setRescheduleReason] = useState<Record<string, string>>({});
  const [rescheduleWhen, setRescheduleWhen] = useState<Record<string, string>>({});
  const [askChasPreset, setAskChasPreset] = useState<Record<string, AskChasPreset>>({});
  const [askChasQuestion, setAskChasQuestion] = useState<Record<string, string>>({});

  // First visit questionnaire draft fields (per job)
  const [fvOverallGoal, setFvOverallGoal] = useState<Record<string, string>>({});
  const [fvPriorityAreas, setFvPriorityAreas] = useState<Record<string, string>>({});
  const [fvVisitFrequency, setFvVisitFrequency] = useState<
    Record<string, FirstVisitQuestionnaire["visitFrequency"]>
  >({});
  const [fvPreferredDayTime, setFvPreferredDayTime] = useState<Record<string, string>>({});
  const [fvBudgetGuideline, setFvBudgetGuideline] = useState<Record<string, string>>({});
  const [fvSeasonalFocus, setFvSeasonalFocus] = useState<Record<string, string>>({});
  const [fvGateAccess, setFvGateAccess] = useState<Record<string, string>>({});
  const [fvParking, setFvParking] = useState<Record<string, string>>({});
  const [fvPets, setFvPets] = useState<Record<string, string>>({});
  const [fvWaterAccess, setFvWaterAccess] = useState<Record<string, string>>({});
  const [fvWastePreference, setFvWastePreference] = useState<Record<string, string>>({});
  const [fvW3wConfirm, setFvW3wConfirm] = useState<Record<string, string>>({});
  const [fvCustomerNotes, setFvCustomerNotes] = useState<Record<string, string>>({});
  const [fvPhotoConsent, setFvPhotoConsent] = useState<
    Record<string, FirstVisitQuestionnaire["photoConsent"]>
  >({});

  const isAdmin = worker ? ADMIN_WORKERS.includes(worker) : false;

  useEffect(() => {
    try {
      const c = localStorage.getItem(LS_KEYS.company) as CompanyKey | null;
      const w = localStorage.getItem(LS_KEYS.worker) as WorkerKey | null;

      if (!c) {
        router.replace("/choose-company");
        return;
      }
      if (!w) {
        router.replace("/choose-worker");
        return;
      }

      setCompany(c);
      setWorker(w);
      setReady(true);
    } catch {
      router.replace("/choose-company");
    }
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const stored = safeParseJobs(localStorage.getItem(LS_KEYS.tcJobs));
    setJobs(stored);
  }, [ready]);

  const anyActive = useMemo(() => jobs.some((j) => j.onSiteActive), [jobs]);
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [anyActive]);

  function updateJobsBatch(mutator: (prev: MaintenanceJob[]) => MaintenanceJob[]) {
    setJobs((prev) => {
      const next = mutator(prev).map((j) => ({
        ...j,
        updatedAt: new Date().toISOString(),
      }));
      saveJobs(next);
      return next;
    });
  }

  function updateJob(id: string, patch: Partial<MaintenanceJob>) {
    updateJobsBatch((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  const dayJobs = useMemo(() => {
    if (!worker) return [];
    const list = jobs.filter((j) => j.scheduledDate === date);
    if (isAdmin) return list;
    return list.filter((j) => (j.assignedTo ? j.assignedTo === worker : true));
  }, [jobs, date, worker, isAdmin]);

  const blocks = useMemo<DayBlock[]>(() => {
    const sorted = [...dayJobs].sort((a, b) => {
      const statusRank = (s: JobStatus) => (s === "todo" ? 0 : s === "in_progress" ? 1 : 2);
      const sr = statusRank(a.status) - statusRank(b.status);
      if (sr !== 0) return sr;

      const ad = a.delayMins ?? 0;
      const bd = b.delayMins ?? 0;
      if (ad !== bd) return ad - bd;

      return a.title.localeCompare(b.title);
    });

    const list: DayBlock[] = [];
    let cursor = 0;

    list.push({
      kind: "prep",
      label: "Prep / load up (30m)",
      startMins: cursor,
      endMins: cursor + PREP_MINS,
    });
    cursor += PREP_MINS;

    const breakTargetFromStart = minutesFromDayStart(BREAK_TARGET_HOUR, BREAK_TARGET_MIN);
    let breakInserted = false;

    const ensureBreak = () => {
      if (breakInserted) return;
      if (cursor >= breakTargetFromStart) {
        list.push({
          kind: "break",
          label: "Break (20m)",
          startMins: cursor,
          endMins: cursor + BREAK_MINS,
        });
        cursor += BREAK_MINS;
        breakInserted = true;
      }
    };

    for (const job of sorted) {
      ensureBreak();

      const travel = clamp(job.travelMins ?? 10, 0, 180);
      if (travel > 0) {
        list.push({
          kind: "travel",
          label: `Travel (${travel}m)`,
          startMins: cursor,
          endMins: cursor + travel,
          jobId: job.id,
        });
        cursor += travel;
      }

      ensureBreak();

      const delay = clamp(job.delayMins ?? 0, 0, 6 * 60);
      if (delay > 0) {
        list.push({
          kind: "wrap",
          label: `Pushed back (+${delay}m)`,
          startMins: cursor,
          endMins: cursor + delay,
        });
        cursor += delay;
      }

      const dur = clamp(job.durationMins ?? 60, 10, 8 * 60);
      list.push({ kind: "job", label: job.title, startMins: cursor, endMins: cursor + dur, job });
      cursor += dur;
    }

    if (!breakInserted) {
      const insertAt = Math.max(breakTargetFromStart, PREP_MINS);
      if (cursor < insertAt) {
        list.push({ kind: "wrap", label: "Buffer", startMins: cursor, endMins: insertAt });
        cursor = insertAt;
      }
      list.push({ kind: "break", label: "Break (20m)", startMins: cursor, endMins: cursor + BREAK_MINS });
      cursor += BREAK_MINS;
    }

    list.push({
      kind: "wrap",
      label: `Day target ends (${minsToClock(DAY_WORK_MINS)})`,
      startMins: DAY_WORK_MINS,
      endMins: DAY_WORK_MINS,
    });

    return list;
  }, [dayJobs]);

  const totalPlannedEnd = useMemo(() => {
    const last = blocks
      .filter((b) => b.kind !== "wrap" || b.startMins !== b.endMins)
      .reduce((mx, b) => Math.max(mx, b.endMins), 0);
    return last;
  }, [blocks]);

  const nextJob = useMemo(() => {
    const jobBlocks = blocks.filter((b): b is Extract<DayBlock, { kind: "job" }> => b.kind === "job");
    const firstTodoOrInProg = jobBlocks.find((b) => b.job.status !== "done");
    return firstTodoOrInProg?.job ?? null;
  }, [blocks]);

  function getNextJobAfter(currentJobId: string): MaintenanceJob | null {
    const jobBlocks = blocks.filter((b): b is Extract<DayBlock, { kind: "job" }> => b.kind === "job");
    const idx = jobBlocks.findIndex((b) => b.job.id === currentJobId);
    if (idx < 0) return nextJob;
    for (let i = idx + 1; i < jobBlocks.length; i++) {
      const cand = jobBlocks[i].job;
      if (cand.id !== currentJobId && cand.status !== "done") return cand;
    }
    const fallback = jobBlocks.find((b) => b.job.id !== currentJobId && b.job.status !== "done")?.job ?? null;
    return fallback;
  }

  // Load photos for jobs on current day
  useEffect(() => {
    let cancelled = false;

    async function run() {
      for (const u of objectUrlsRef.current) URL.revokeObjectURL(u);
      objectUrlsRef.current = [];
      setPhotoViews({});

      const jobIds = Array.from(new Set(dayJobs.map((j) => j.id)));
      const map: Record<string, PhotoView[]> = {};

      for (const jobId of jobIds) {
        try {
          const recs = await listPhotosForJob(jobId);
          const views: PhotoView[] = recs.map((r) => {
            const url = URL.createObjectURL(r.blob);
            objectUrlsRef.current.push(url);
            return { id: r.id, jobId: r.jobId, createdAt: r.createdAt, name: r.name, type: r.type, url };
          });
          map[jobId] = views;
        } catch {
          map[jobId] = [];
        }
      }

      if (!cancelled) setPhotoViews(map);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [dayJobs]);

  useEffect(() => {
    return () => {
      for (const u of objectUrlsRef.current) URL.revokeObjectURL(u);
      objectUrlsRef.current = [];
    };
  }, []);

  function computeOnSiteMinutes(job: MaintenanceJob) {
    const sessions = job.onSiteSessions ?? [];
    const closed = sessions.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
    const live =
      job.onSiteActive && job.onSiteStartAt ? diffMinutes(job.onSiteStartAt, new Date().toISOString()) : 0;
    const base = job.onSiteMinutesTotal ?? 0;
    return sessions.length > 0 ? closed + live : base + live;
  }

  function stopActiveJob(job: MaintenanceJob, endISO: string): MaintenanceJob {
    if (!job.onSiteActive || !job.onSiteStartAt) return job;

    const sessions = Array.isArray(job.onSiteSessions) ? [...job.onSiteSessions] : [];
    const mins = diffMinutes(job.onSiteStartAt, endISO);

    sessions.push({ startAt: job.onSiteStartAt, endAt: endISO, minutes: mins });

    return {
      ...job,
      onSiteActive: false,
      onSiteStartAt: "",
      onSiteSessions: sessions,
      onSiteMinutesTotal: sessions.reduce((s, x) => s + (x.minutes ?? 0), 0),
    };
  }

  function scrollToNotes(jobId: string) {
    const el = document.getElementById(`job-${jobId}-notes`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function highlightJob(jobId: string) {
    setExpandedJobId(jobId);
    window.setTimeout(() => setExpandedJobId(null), 1500);
  }

  function closeAllPanels() {
    setOpenOverrunForJob(null);
    setOpenExtraForJob(null);
    setOpenBlockedForJob(null);
    setOpenRescheduleForJob(null);
    setOpenAskChasForJob(null);
    setOpenFirstVisitForJob(null);
  }

  function startOnSite(jobId: string) {
    closeAllPanels();
    scrollToNotes(jobId);
    highlightJob(jobId);

    const now = new Date().toISOString();

    updateJobsBatch((prev) => {
      if (!worker) return prev;

      // Only one active job at a time (per worker + same day)
      const out = prev.map((j) => {
        const isSameWorker = j.assignedTo ? j.assignedTo === worker : true;
        const isSameDay = j.scheduledDate === date;

        if (j.id !== jobId && j.onSiteActive && isSameDay && isSameWorker) {
          return stopActiveJob(j, now);
        }
        return j;
      });

      return out.map((j) => {
        if (j.id !== jobId) return j;
        if (j.onSiteActive) return j;
        return {
          ...j,
          status: "in_progress",
          onSiteActive: true,
          onSiteStartAt: now,
        };
      });
    });
  }

  function stopOnSiteAndNavigate(jobId: string) {
    closeAllPanels();

    const next = getNextJobAfter(jobId);

    const now = new Date().toISOString();
    updateJobsBatch((prev) =>
      prev.map((j) => {
        if (j.id !== jobId) return j;
        const stopped = stopActiveJob(j, now);
        return {
          ...stopped,
          status: "done",
          completedOn: date,
        };
      })
    );

    if (next) {
      const dest = (next.address && next.address.trim()) || (next.what3words && next.what3words.trim()) || "";
      if (dest) openGoogleMapsNavigation(dest);
    }
  }

  async function handleAddPhotos(jobId: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;

    try {
      await addPhotosToDb(jobId, files);
      const recs = await listPhotosForJob(jobId);

      setPhotoViews((prev) => {
        const existing = prev[jobId] ?? [];
        for (const v of existing) URL.revokeObjectURL(v.url);
        objectUrlsRef.current = objectUrlsRef.current.filter((u) => !existing.some((v) => v.url === u));

        const views: PhotoView[] = recs.map((r) => {
          const url = URL.createObjectURL(r.blob);
          objectUrlsRef.current.push(url);
          return { id: r.id, jobId: r.jobId, createdAt: r.createdAt, name: r.name, type: r.type, url };
        });

        return { ...prev, [jobId]: views };
      });
    } catch {
      // ignore
    }
  }

  async function handleDeletePhoto(jobId: string, photoId: string) {
    try {
      await deletePhotoFromDb(photoId);
      setPhotoViews((prev) => {
        const list = prev[jobId] ?? [];
        const keep = list.filter((p) => p.id !== photoId);
        const gone = list.find((p) => p.id === photoId);
        if (gone) {
          URL.revokeObjectURL(gone.url);
          objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== gone.url);
        }
        return { ...prev, [jobId]: keep };
      });
    } catch {
      // ignore
    }
  }

  function appendStampedWorkNote(job: MaintenanceJob) {
    if (!worker) return;
    const text = (draftWorkNote[job.id] ?? "").trim();
    if (!text) return;

    const line = stampLine(worker, text);
    const existing = (job.completionNotes ?? "").trim();
    const next = existing ? `${existing}\n${line}` : line;

    updateJob(job.id, { completionNotes: next });
    setDraftWorkNote((p) => ({ ...p, [job.id]: "" }));
  }

  function appendStampedFollowup(job: MaintenanceJob) {
    if (!worker) return;
    const text = (draftFollowupNote[job.id] ?? "").trim();
    if (!text) return;

    const line = stampLine(worker, text);
    const existing = (job.followUpNote ?? "").trim();
    const next = existing ? `${existing}\n${line}` : line;

    updateJob(job.id, { followUpNote: next });
    setDraftFollowupNote((p) => ({ ...p, [job.id]: "" }));
  }

  // ---------------- Quick actions (structured flags + stamped notes) ----------------
  function addRunningOver(job: MaintenanceJob, mins: number, reason?: string) {
    if (!worker) return;
    const now = new Date().toISOString();

    const entry: RunningOver = { mins, reason: reason?.trim() || "", at: now, by: worker };

    updateJobsBatch((prev) =>
      prev.map((j) => {
        if (j.id !== job.id) return j;

        const ro = Array.isArray(j.runningOver) ? [...j.runningOver] : [];
        ro.push(entry);

        const note = `Running over +${mins}m${reason ? ` (reason: ${reason.trim()})` : ""}.`;
        const line = stampLine(worker, note);
        const existing = (j.completionNotes ?? "").trim();
        const nextNotes = existing ? `${existing}\n${line}` : line;

        return {
          ...j,
          runningOver: ro,
          completionNotes: nextNotes,
          // reflect reality in the day plan
          delayMins: (j.delayMins ?? 0) + mins,
          moreTimeRequested: true,
          moreTimeMins: clamp((j.moreTimeMins ?? 0) + mins, 0, 240),
          followUpNeeded: true,
          followUpType: j.followUpType || "acknowledge",
        };
      })
    );
  }

  function addBlocked(job: MaintenanceJob, reason: BlockedReason, note?: string) {
    if (!worker) return;
    const now = new Date().toISOString();
    const entry = { reason, note: note?.trim() || "", at: now, by: worker };

    updateJobsBatch((prev) =>
      prev.map((j) => {
        if (j.id !== job.id) return j;

        const arr = Array.isArray(j.blocked) ? [...j.blocked] : [];
        arr.push(entry);

        const line = stampLine(worker, `BLOCKED: ${blockedLabel(reason)}${note ? ` — ${note.trim()}` : ""}`);
        const existingWork = (j.completionNotes ?? "").trim();
        const nextWork = existingWork ? `${existingWork}\n${line}` : line;

        const existingFU = (j.followUpNote ?? "").trim();
        const fuLine = stampLine(worker, `Blocked: ${blockedLabel(reason)}${note ? ` — ${note.trim()}` : ""}`);
        const nextFU = existingFU ? `${existingFU}\n${fuLine}` : fuLine;

        return {
          ...j,
          blocked: arr,
          completionNotes: nextWork,
          followUpNeeded: true,
          followUpType: j.followUpType || "booking",
          followUpNote: nextFU,
        };
      })
    );
  }

  function addExtraRequest(job: MaintenanceJob, req: ExtraRequest) {
    if (!worker) return;

    updateJobsBatch((prev) =>
      prev.map((j) => {
        if (j.id !== job.id) return j;

        const arr = Array.isArray(j.extraRequests) ? [...j.extraRequests] : [];
        arr.push(req);

        let message = "";
        if (req.kind === "extra_today") {
          const base =
            req.size === "30m"
              ? "+30m"
              : req.size === "60m"
              ? "+60m"
              : req.size === "half_day"
              ? "Half day"
              : req.size === "full_day"
              ? "Full day"
              : req.mins
              ? `+${req.mins}m`
              : "Custom";
          message = `Customer asked for extra TODAY (${base})${req.details ? ` — ${req.details}` : ""}.`;
        } else {
          message = `Customer asked for an EXTRA VISIT (${req.urgency.replace("_", " ")})${
            req.when ? ` — when: ${req.when}` : ""
          }${req.details ? ` — ${req.details}` : ""}.`;
        }

        const line = stampLine(worker, message);
        const existingWork = (j.completionNotes ?? "").trim();
        const nextWork = existingWork ? `${existingWork}\n${line}` : line;

        const needType: FollowUpType = req.kind === "extra_today" ? "quote" : "booking";

        const existingFU = (j.followUpNote ?? "").trim();
        const fuLine = stampLine(worker, message);
        const nextFU = existingFU ? `${existingFU}\n${fuLine}` : fuLine;

        return {
          ...j,
          extraRequests: arr,
          completionNotes: nextWork,
          followUpNeeded: true,
          followUpType: needType,
          followUpNote: nextFU,
        };
      })
    );
  }

  function addRescheduleRequest(job: MaintenanceJob, req: RescheduleRequest) {
    if (!worker) return;

    updateJobsBatch((prev) =>
      prev.map((j) => {
        if (j.id !== job.id) return j;

        const arr = Array.isArray(j.rescheduleRequests) ? [...j.rescheduleRequests] : [];
        arr.push(req);

        const msg = `Reschedule requested: ${req.to}${req.when ? ` — ${req.when}` : ""}${
          req.reason ? ` — ${req.reason}` : ""
        }.`;
        const line = stampLine(worker, msg);

        const existingWork = (j.completionNotes ?? "").trim();
        const nextWork = existingWork ? `${existingWork}\n${line}` : line;

        const existingFU = (j.followUpNote ?? "").trim();
        const nextFU = existingFU ? `${existingFU}\n${line}` : line;

        return {
          ...j,
          rescheduleRequests: arr,
          completionNotes: nextWork,
          followUpNeeded: true,
          followUpType: "booking",
          followUpNote: nextFU,
        };
      })
    );
  }

  async function askChas(job: MaintenanceJob) {
    const helpUrl = process.env.NEXT_PUBLIC_HELP_URL || "https://chatgpt.com/";
    const preset = askChasPreset[job.id] ?? "general";
    const question = (askChasQuestion[job.id] ?? "").trim();

    const prompt = [
      `Company: ${company}`,
      `Worker: ${workerLabel(worker as WorkerKey)}`,
      `Date: ${date}`,
      "",
      `JOB: ${job.title}`,
      `Address: ${job.address}`,
      job.what3words ? `what3words: ${job.what3words}` : "",
      "",
      `CATEGORY: ${askChasPresetLabel(preset)}`,
      "",
      `What needs doing (job notes):`,
      job.notes ? job.notes : "(none)",
      "",
      `On-site time so far: ${formatDuration(computeOnSiteMinutes(job))}`,
      job.onSiteActive && job.onSiteStartAt
        ? `Currently on site since: ${new Date(job.onSiteStartAt).toLocaleTimeString()}`
        : "",
      "",
      `Recent worker notes (stamped):`,
      job.completionNotes ? job.completionNotes : "(none yet)",
      "",
      "QUESTION:",
      question || "(Type your question here.)",
      "",
      "If useful, reply with: (1) what to do now, (2) what NOT to do, (3) quick checklist, (4) whether to book a follow-up/quote.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // ignore
    }

    try {
      window.open(helpUrl, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }

    if (worker) {
      const line = stampLine(worker, `Asked Chas (${askChasPresetLabel(preset)}). ${question ? `Q: ${question}` : ""}`.trim());
      const existing = (job.completionNotes ?? "").trim();
      const next = existing ? `${existing}\n${line}` : line;
      updateJob(job.id, { completionNotes: next });
    }
  }

  // ---------------- First visit questionnaire (ONLY for jobs marked firstVisit.isFirstVisit=true) ----------------
  function isFirstVisitJob(job: MaintenanceJob) {
    return Boolean(job.firstVisit?.isFirstVisit);
  }

  function fvCompleted(job: MaintenanceJob) {
    return Boolean(job.firstVisit?.isFirstVisit && job.firstVisit?.completedAt);
  }

  function markJobAsFirstVisit(jobId: string) {
    if (!worker) return;
    const now = new Date().toISOString();

    updateJobsBatch((prev) =>
      prev.map((j) => {
        if (j.id !== jobId) return j;

        const existingLog = (j.firstVisit?.log ?? "").trim();
        const line = stampLine(worker, "Marked job as FIRST VISIT (questionnaire enabled).");
        const nextLog = existingLog ? `${existingLog}\n${line}` : line;

        const fv: FirstVisitQuestionnaire = {
          ...(j.firstVisit ?? {}),
          isFirstVisit: true,
          log: nextLog,
        };

        return {
          ...j,
          firstVisit: fv,
          followUpNeeded: true,
          followUpType: j.followUpType || "acknowledge",
          followUpNote: (() => {
            const fu = (j.followUpNote ?? "").trim();
            const fuLine = stampLine(worker, "First visit questionnaire needs completing.");
            return fu ? `${fu}\n${fuLine}` : fuLine;
          })(),
        };
      })
    );
  }

  function initFirstVisitDraft(job: MaintenanceJob) {
    const fv = job.firstVisit;
    setFvOverallGoal((p) => ({ ...p, [job.id]: fv?.overallGoal ?? "" }));
    setFvPriorityAreas((p) => ({ ...p, [job.id]: fv?.priorityAreas ?? "" }));
    setFvVisitFrequency((p) => ({ ...p, [job.id]: fv?.visitFrequency ?? "" }));
    setFvPreferredDayTime((p) => ({ ...p, [job.id]: fv?.preferredDayTime ?? "" }));
    setFvBudgetGuideline((p) => ({ ...p, [job.id]: fv?.budgetGuideline ?? "" }));
    setFvSeasonalFocus((p) => ({ ...p, [job.id]: fv?.seasonalFocus ?? "" }));
    setFvGateAccess((p) => ({ ...p, [job.id]: fv?.gateAccess ?? "" }));
    setFvParking((p) => ({ ...p, [job.id]: fv?.parking ?? "" }));
    setFvPets((p) => ({ ...p, [job.id]: fv?.pets ?? "" }));
    setFvWaterAccess((p) => ({ ...p, [job.id]: fv?.waterAccess ?? "" }));
    setFvWastePreference((p) => ({ ...p, [job.id]: fv?.wastePreference ?? "" }));
    setFvW3wConfirm((p) => ({ ...p, [job.id]: fv?.what3wordsConfirm ?? "" }));
    setFvCustomerNotes((p) => ({ ...p, [job.id]: fv?.customerNotes ?? "" }));
    setFvPhotoConsent((p) => ({ ...p, [job.id]: fv?.photoConsent ?? "" }));
  }

  function saveFirstVisit(job: MaintenanceJob) {
    if (!worker) return;
    const now = new Date().toISOString();

    const overallGoal = (fvOverallGoal[job.id] ?? "").trim();
    const priorityAreas = (fvPriorityAreas[job.id] ?? "").trim();
    const visitFrequency = (fvVisitFrequency[job.id] ?? "") as FirstVisitQuestionnaire["visitFrequency"];
    const preferredDayTime = (fvPreferredDayTime[job.id] ?? "").trim();
    const budgetGuideline = (fvBudgetGuideline[job.id] ?? "").trim();
    const seasonalFocus = (fvSeasonalFocus[job.id] ?? "").trim();
    const gateAccess = (fvGateAccess[job.id] ?? "").trim();
    const parking = (fvParking[job.id] ?? "").trim();
    const pets = (fvPets[job.id] ?? "").trim();
    const waterAccess = (fvWaterAccess[job.id] ?? "").trim();
    const wastePreference = (fvWastePreference[job.id] ?? "").trim();
    const w3wConfirm = (fvW3wConfirm[job.id] ?? "").trim();
    const customerNotes = (fvCustomerNotes[job.id] ?? "").trim();
    const photoConsent = (fvPhotoConsent[job.id] ?? "") as FirstVisitQuestionnaire["photoConsent"];

    const summaryBits: string[] = [];
    if (overallGoal) summaryBits.push(`Goal: ${overallGoal}`);
    if (priorityAreas) summaryBits.push(`Priority: ${priorityAreas}`);
    if (visitFrequency) summaryBits.push(`Frequency: ${visitFrequency.replace("_", " ")}`);
    if (preferredDayTime) summaryBits.push(`Preferred: ${preferredDayTime}`);
    if (gateAccess) summaryBits.push(`Access: ${gateAccess}`);
    if (pets) summaryBits.push(`Pets: ${pets}`);
    if (waterAccess) summaryBits.push(`Water: ${waterAccess}`);
    if (wastePreference) summaryBits.push(`Waste: ${wastePreference}`);
    if (budgetGuideline) summaryBits.push(`Budget: ${budgetGuideline}`);
    if (seasonalFocus) summaryBits.push(`Seasonal: ${seasonalFocus}`);
    if (photoConsent) summaryBits.push(`Photo consent: ${photoConsent}`);
    if (w3wConfirm) summaryBits.push(`w3w: ${w3wConfirm}`);
    const summary = summaryBits.join(" | ");

    updateJobsBatch((prev) =>
      prev.map((j) => {
        if (j.id !== job.id) return j;

        const prevFv = j.firstVisit;
        const existingLog = (prevFv?.log ?? "").trim();

        const logLines: string[] = [];
        logLines.push(stampLine(worker, "First visit questionnaire COMPLETED."));
        if (summary) logLines.push(stampLine(worker, `Summary: ${summary}`));
        if (customerNotes) logLines.push(stampLine(worker, `Customer notes: ${customerNotes}`));

        const nextLog = existingLog ? `${existingLog}\n${logLines.join("\n")}` : logLines.join("\n");

        const nextFirstVisit: FirstVisitQuestionnaire = {
          isFirstVisit: true,
          completedAt: now,
          completedBy: worker,
          overallGoal,
          priorityAreas,
          visitFrequency,
          preferredDayTime,
          budgetGuideline,
          seasonalFocus,
          gateAccess,
          parking,
          pets,
          waterAccess,
          wastePreference,
          what3wordsConfirm: w3wConfirm,
          customerNotes,
          photoConsent,
          log: nextLog,
        };

        const fuLine = stampLine(worker, `First visit plan captured. ${summary || "(see questionnaire)"}`);
        const existingFU = (j.followUpNote ?? "").trim();
        const nextFU = existingFU ? `${existingFU}\n${fuLine}` : fuLine;

        return {
          ...j,
          firstVisit: nextFirstVisit,
          followUpNeeded: true,
          followUpType: j.followUpType || "acknowledge",
          followUpNote: nextFU,
        };
      })
    );

    setOpenFirstVisitForJob(null);
  }

  // ---------------- UI ----------------
  if (!ready || !company || !worker) return null;

  const isThreeCounties = company === "threecounties";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
              <Image
                src="/branding/threecounties-logo.png"
                alt="Three Counties Property Care"
                fill
                className="object-contain p-1"
                priority
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">Diary · {workerLabel(worker)}</div>
              <div className="text-xs text-slate-600">Start 08:30 · Prep 30m · Break 20m · Target 7h</div>
            </div>

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              aria-label="Select date"
            />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-600">Planned end</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">{minsToClock(totalPlannedEnd)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-600">Target end</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">{minsToClock(DAY_WORK_MINS)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-600">Next</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900 truncate">{nextJob ? nextJob.title : "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-2xl px-4 py-4">
        {!isThreeCounties ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            You’re currently in <b>Furlads</b> mode. This worker diary is built for <b>Three Counties</b>. Switch user to use the correct brand.
          </div>
        ) : null}

        {isThreeCounties && blocks.filter((b) => b.kind === "job").length === 0 ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <div className="text-base font-semibold text-slate-900">No jobs scheduled</div>
            <div className="mt-1 text-sm text-slate-600">Nothing assigned for this date yet (or jobs aren’t set to this date).</div>
          </div>
        ) : null}

        {isThreeCounties ? (
          <div className="mt-3 flex flex-col gap-3">
            {blocks.map((b, idx) => {
              const isMarker = b.kind === "wrap" && b.startMins === b.endMins;

              if (isMarker) {
                const over = totalPlannedEnd > DAY_WORK_MINS ? totalPlannedEnd - DAY_WORK_MINS : 0;
                return (
                  <div key={`marker-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{b.label}</div>
                      {over > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800">
                          Running +{over}m
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          On target
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">Target working time: 08:30 → 15:30 (7h)</div>
                  </div>
                );
              }

              const time = `${minsToClock(b.startMins)}–${minsToClock(b.endMins)}`;

              if (b.kind === "prep" || b.kind === "break" || b.kind === "wrap") {
                const style = b.kind === "break" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white";
                return (
                  <div key={`${b.kind}-${idx}`} className={`rounded-2xl border ${style} p-4`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{b.label}</div>
                      <div className="text-xs font-semibold text-slate-700">{time}</div>
                    </div>
                    {b.kind === "wrap" ? (
                      <div className="mt-1 text-xs text-slate-600">Buffer time (overruns, quick stops, materials, etc.)</div>
                    ) : null}
                  </div>
                );
              }

              if (b.kind === "travel") {
                return (
                  <div key={`travel-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{b.label}</div>
                      <div className="text-xs font-semibold text-slate-700">{time}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">Between jobs</div>
                  </div>
                );
              }

              const job = b.job;
              const duration = clamp(job.durationMins ?? 60, 10, 480);
              const travel = clamp(job.travelMins ?? 10, 0, 180);
              const delay = clamp(job.delayMins ?? 0, 0, 6 * 60);

              const onSiteMins = computeOnSiteMinutes(job);

              const statusPill =
                job.status === "done"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : job.status === "in_progress"
                  ? "border-lime-200 bg-lime-50 text-lime-800"
                  : "border-slate-200 bg-slate-50 text-slate-800";

              const isActive = Boolean(job.onSiteActive && job.onSiteStartAt);
              const photos = photoViews[job.id] ?? [];
              const highlight = expandedJobId === job.id;

              const firstVisitEnabled = isFirstVisitJob(job);
              const firstVisitDone = fvCompleted(job);

              return (
                <div
                  key={`job-${job.id}`}
                  className={`rounded-2xl border bg-white p-4 shadow-sm ${
                    highlight ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-semibold text-slate-900">{job.title}</div>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPill}`}>
                          {job.status === "todo" ? "To do" : job.status === "in_progress" ? "In progress" : "Done"}
                        </span>
                        {isActive ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            On site
                          </span>
                        ) : null}
                        {firstVisitEnabled ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            First visit
                          </span>
                        ) : null}
                        {firstVisitDone ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            Plan done
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Planned:</span> {time}
                      </div>

                      <div className="mt-1 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Address:</span> {job.address}
                      </div>

                      {job.what3words ? (
                        <div className="mt-1 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">what3words:</span> {job.what3words}
                        </div>
                      ) : null}

                      {job.notes ? (
                        <div className="mt-2 text-sm text-slate-600">
                          <span className="font-semibold text-slate-900">What needs doing:</span> {job.notes}
                        </div>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                          On-site: {formatDuration(onSiteMins)}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                          Duration: {duration}m
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                          Travel: {travel}m
                        </span>
                        {delay > 0 ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                            Pushed: +{delay}m
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* On-site controls */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => startOnSite(job.id)}
                      disabled={isActive}
                      className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
                    >
                      I’m here
                    </button>

                    <button
                      onClick={() => stopOnSiteAndNavigate(job.id)}
                      disabled={!isActive}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm disabled:opacity-40"
                    >
                      I’m done
                    </button>
                  </div>

                  {/* Worker quick buttons */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        closeAllPanels();
                        setOpenOverrunForJob(job.id);
                        scrollToNotes(job.id);
                      }}
                      className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900"
                    >
                      I’m running over
                    </button>

                    <button
                      onClick={() => {
                        closeAllPanels();
                        setOpenExtraForJob(job.id);
                        scrollToNotes(job.id);
                      }}
                      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
                    >
                      Customer wants extra
                    </button>

                    <button
                      onClick={() => {
                        closeAllPanels();
                        setOpenBlockedForJob(job.id);
                        scrollToNotes(job.id);
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
                    >
                      Blocked / issue
                    </button>

                    <button
                      onClick={() => {
                        closeAllPanels();
                        setOpenAskChasForJob(job.id);
                        scrollToNotes(job.id);
                      }}
                      className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
                    >
                      Ask Chas (ChatGPT)
                    </button>
                  </div>

                  {/* FIRST VISIT: only show if job is marked firstVisit.isFirstVisit=true.
                      If not marked, admins get a tiny "Mark as first visit" control. */}
                  <div className="mt-2">
                    {firstVisitEnabled ? (
                      <button
                        onClick={() => {
                          closeAllPanels();
                          initFirstVisitDraft(job);
                          setOpenFirstVisitForJob(job.id);
                          scrollToNotes(job.id);
                        }}
                        className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm ${
                          firstVisitDone
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border border-slate-200 bg-white text-slate-900"
                        }`}
                      >
                        {firstVisitDone ? "View / update first visit plan" : "First visit questionnaire (plan the year)"}
                      </button>
                    ) : isAdmin ? (
                      <button
                        onClick={() => markJobAsFirstVisit(job.id)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
                      >
                        Mark as first visit (enable questionnaire)
                      </button>
                    ) : null}
                  </div>

                  {/* Running over panel */}
                  {openOverrunForJob === job.id ? (
                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                      <div className="text-xs font-semibold text-rose-900">Running over — how much?</div>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {[15, 30, 60].map((m) => (
                          <button
                            key={m}
                            onClick={() => {
                              addRunningOver(job, m, overrunReason[job.id]);
                              setOpenOverrunForJob(null);
                            }}
                            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-rose-900 border border-rose-200"
                          >
                            +{m}m
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            const v = Number(overrunReason[job.id]?.match(/\d+/)?.[0] ?? 0);
                            if (v > 0) {
                              addRunningOver(job, v, overrunReason[job.id]);
                              setOpenOverrunForJob(null);
                            }
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-rose-900 border border-rose-200"
                        >
                          Custom
                        </button>
                      </div>

                      <input
                        value={overrunReason[job.id] ?? ""}
                        onChange={(e) => setOverrunReason((p) => ({ ...p, [job.id]: e.target.value }))}
                        placeholder="Reason (optional) — e.g. heavy weeds, extra pruning…"
                        className="mt-2 w-full rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none"
                      />

                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setOpenOverrunForJob(null)}
                          className="flex-1 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-900"
                        >
                          Close
                        </button>
                      </div>
                      <div className="mt-2 text-[11px] text-rose-900/80">
                        This logs a flagged note for Kelly and adjusts the plan.
                      </div>
                    </div>
                  ) : null}

                  {/* Extra request panel */}
                  {openExtraForJob === job.id ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <div className="text-xs font-semibold text-amber-900">Customer wants extra — choose type</div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            if (!worker) return;
                            const now = new Date().toISOString();
                            addExtraRequest(job, {
                              kind: "extra_today",
                              size: "30m",
                              details: extraDetails[job.id]?.trim() || "",
                              at: now,
                              by: worker,
                            });
                            setOpenExtraForJob(null);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                        >
                          Extra today (+30m)
                        </button>

                        <button
                          onClick={() => {
                            if (!worker) return;
                            const now = new Date().toISOString();
                            addExtraRequest(job, {
                              kind: "extra_today",
                              size: "60m",
                              details: extraDetails[job.id]?.trim() || "",
                              at: now,
                              by: worker,
                            });
                            setOpenExtraForJob(null);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                        >
                          Extra today (+60m)
                        </button>

                        <button
                          onClick={() => {
                            if (!worker) return;
                            const now = new Date().toISOString();
                            addExtraRequest(job, {
                              kind: "extra_today",
                              size: "half_day",
                              details: extraDetails[job.id]?.trim() || "",
                              at: now,
                              by: worker,
                            });
                            setOpenExtraForJob(null);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                        >
                          Half day (today)
                        </button>

                        <button
                          onClick={() => {
                            if (!worker) return;
                            const now = new Date().toISOString();
                            addExtraRequest(job, {
                              kind: "extra_today",
                              size: "full_day",
                              details: extraDetails[job.id]?.trim() || "",
                              at: now,
                              by: worker,
                            });
                            setOpenExtraForJob(null);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                        >
                          Full day (today)
                        </button>

                        <div className="col-span-2 rounded-2xl border border-amber-200 bg-white p-2">
                          <div className="text-[11px] font-semibold text-amber-900">Custom minutes (today)</div>
                          <div className="mt-1 flex gap-2">
                            <input
                              inputMode="numeric"
                              value={extraCustomMins[job.id] ?? ""}
                              onChange={(e) => setExtraCustomMins((p) => ({ ...p, [job.id]: e.target.value }))}
                              placeholder="e.g. 90"
                              className="w-24 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
                            />
                            <button
                              onClick={() => {
                                if (!worker) return;
                                const mins = Number(extraCustomMins[job.id] ?? 0);
                                if (!Number.isFinite(mins) || mins <= 0) return;
                                const now = new Date().toISOString();
                                addExtraRequest(job, {
                                  kind: "extra_today",
                                  size: "custom",
                                  mins: Math.round(mins),
                                  details: extraDetails[job.id]?.trim() || "",
                                  at: now,
                                  by: worker,
                                });
                                setOpenExtraForJob(null);
                              }}
                              className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                            >
                              Log custom
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (!worker) return;
                            const now = new Date().toISOString();
                            addExtraRequest(job, {
                              kind: "extra_visit",
                              urgency: "asap",
                              details: extraDetails[job.id]?.trim() || "",
                              at: now,
                              by: worker,
                            });
                            setOpenExtraForJob(null);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                        >
                          Extra visit (ASAP)
                        </button>

                        <button
                          onClick={() => {
                            if (!worker) return;
                            const now = new Date().toISOString();
                            addExtraRequest(job, {
                              kind: "extra_visit",
                              urgency: "next_week",
                              details: extraDetails[job.id]?.trim() || "",
                              at: now,
                              by: worker,
                            });
                            setOpenExtraForJob(null);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                        >
                          Extra visit (next week)
                        </button>

                        <button
                          onClick={() => {
                            if (!worker) return;
                            const now = new Date().toISOString();
                            addExtraRequest(job, {
                              kind: "extra_visit",
                              urgency: "two_weeks",
                              details: extraDetails[job.id]?.trim() || "",
                              at: now,
                              by: worker,
                            });
                            setOpenExtraForJob(null);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                        >
                          Extra visit (2 weeks)
                        </button>

                        <button
                          onClick={() => {
                            closeAllPanels();
                            setOpenRescheduleForJob(job.id);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                        >
                          Can’t fit today → reschedule
                        </button>
                      </div>

                      <textarea
                        value={extraDetails[job.id] ?? ""}
                        onChange={(e) => setExtraDetails((p) => ({ ...p, [job.id]: e.target.value }))}
                        placeholder="Details (what extra work?) — helps Trev/Kelly quote/book"
                        className="mt-2 min-h-[72px] w-full resize-none rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
                      />

                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setOpenExtraForJob(null)}
                          className="flex-1 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-900"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Blocked panel */}
                  {openBlockedForJob === job.id ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-900">Blocked / issue</div>

                      <select
                        value={blockedReason[job.id] ?? ""}
                        onChange={(e) =>
                          setBlockedReason((p) => ({ ...p, [job.id]: e.target.value as BlockedReason }))
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
                      >
                        <option value="">Choose reason…</option>
                        <option value="gate_locked">Gate locked</option>
                        <option value="no_access">No access</option>
                        <option value="customer_not_home">Customer not home</option>
                        <option value="weather">Weather stopped work</option>
                        <option value="materials_missing">Materials missing</option>
                        <option value="danger">Danger / unsafe</option>
                      </select>

                      <textarea
                        value={blockedNote[job.id] ?? ""}
                        onChange={(e) => setBlockedNote((p) => ({ ...p, [job.id]: e.target.value }))}
                        placeholder="Note (optional) — e.g. ‘Gate padlocked’, ‘Dog loose’, ‘Rain stopped at 12:10’…"
                        className="mt-2 min-h-[64px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      />

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            const r = blockedReason[job.id] ?? "";
                            if (!r) return;
                            addBlocked(job, r, blockedNote[job.id]);
                            setOpenBlockedForJob(null);
                          }}
                          className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Log blocked
                        </button>
                        <button
                          onClick={() => setOpenBlockedForJob(null)}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Reschedule request panel */}
                  {openRescheduleForJob === job.id ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <div className="text-xs font-semibold text-amber-900">Reschedule request</div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            if (!worker) return;
                            addRescheduleRequest(job, {
                              to: "tomorrow",
                              at: new Date().toISOString(),
                              by: worker,
                              reason: rescheduleReason[job.id]?.trim() || "",
                            });
                            setOpenRescheduleForJob(null);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                        >
                          Tomorrow
                        </button>
                        <button
                          onClick={() => {
                            if (!worker) return;
                            addRescheduleRequest(job, {
                              to: "next_week",
                              at: new Date().toISOString(),
                              by: worker,
                              reason: rescheduleReason[job.id]?.trim() || "",
                            });
                            setOpenRescheduleForJob(null);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                        >
                          Next week
                        </button>
                        <button
                          onClick={() => {
                            if (!worker) return;
                            const when = (rescheduleWhen[job.id] ?? "").trim();
                            if (!when) return;
                            addRescheduleRequest(job, {
                              to: "custom",
                              when,
                              at: new Date().toISOString(),
                              by: worker,
                              reason: rescheduleReason[job.id]?.trim() || "",
                            });
                            setOpenRescheduleForJob(null);
                          }}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 border border-amber-200"
                        >
                          Custom
                        </button>
                      </div>

                      <input
                        value={rescheduleWhen[job.id] ?? ""}
                        onChange={(e) => setRescheduleWhen((p) => ({ ...p, [job.id]: e.target.value }))}
                        placeholder="Custom when (e.g. ‘Thu AM’, ‘2026-03-06’) — required if Custom"
                        className="mt-2 w-full rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
                      />

                      <textarea
                        value={rescheduleReason[job.id] ?? ""}
                        onChange={(e) => setRescheduleReason((p) => ({ ...p, [job.id]: e.target.value }))}
                        placeholder="Reason (optional) — helps Kelly plan"
                        className="mt-2 min-h-[64px] w-full resize-none rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
                      />

                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setOpenRescheduleForJob(null)}
                          className="flex-1 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-900"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Ask Chas panel */}
                  {openAskChasForJob === job.id ? (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <div className="text-xs font-semibold text-emerald-900">Ask Chas (ChatGPT)</div>

                      <select
                        value={askChasPreset[job.id] ?? "general"}
                        onChange={(e) =>
                          setAskChasPreset((p) => ({ ...p, [job.id]: e.target.value as AskChasPreset }))
                        }
                        className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
                      >
                        <option value="general">General</option>
                        <option value="plant_id">Plant ID / care</option>
                        <option value="pest_disease">Pest / disease</option>
                        <option value="pruning">Pruning</option>
                        <option value="watering_drainage">Watering / drainage</option>
                        <option value="hardscape">Hardscape issue</option>
                        <option value="customer_extra">Customer asked for extra</option>
                      </select>

                      <textarea
                        value={askChasQuestion[job.id] ?? ""}
                        onChange={(e) => setAskChasQuestion((p) => ({ ...p, [job.id]: e.target.value }))}
                        placeholder="Type your question…"
                        className="mt-2 min-h-[72px] w-full resize-none rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                      />

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            askChas(job);
                            setOpenAskChasForJob(null);
                          }}
                          className="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Copy + open
                        </button>
                        <button
                          onClick={() => setOpenAskChasForJob(null)}
                          className="rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* FIRST VISIT questionnaire panel */}
                  {openFirstVisitForJob === job.id ? (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-emerald-900">First visit questionnaire</div>
                        <button
                          onClick={() => setOpenFirstVisitForJob(null)}
                          className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-2 rounded-2xl border border-emerald-200 bg-white p-3">
                        <div className="text-[11px] font-semibold text-slate-900">
                          1) Overall goal (what are we aiming for this year?)
                        </div>
                        <textarea
                          value={fvOverallGoal[job.id] ?? ""}
                          onChange={(e) => setFvOverallGoal((p) => ({ ...p, [job.id]: e.target.value }))}
                          placeholder="e.g. ‘Keep it tidy weekly’, ‘Bring borders back under control’, ‘Low-maintenance family garden’…"
                          className="mt-1 min-h-[64px] w-full resize-none rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                      </div>

                      <div className="mt-2 rounded-2xl border border-emerald-200 bg-white p-3">
                        <div className="text-[11px] font-semibold text-slate-900">
                          2) Priority areas (top 3 things they care about)
                        </div>
                        <textarea
                          value={fvPriorityAreas[job.id] ?? ""}
                          onChange={(e) => setFvPriorityAreas((p) => ({ ...p, [job.id]: e.target.value }))}
                          placeholder="e.g. front tidy, lawn stripes, borders weed-free, hedges neat…"
                          className="mt-1 min-h-[64px] w-full resize-none rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-900">3) Visit frequency</div>
                          <select
                            value={fvVisitFrequency[job.id] ?? ""}
                            onChange={(e) =>
                              setFvVisitFrequency((p) => ({
                                ...p,
                                [job.id]: e.target.value as FirstVisitQuestionnaire["visitFrequency"],
                              }))
                            }
                            className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
                          >
                            <option value="">Choose…</option>
                            <option value="weekly">Weekly</option>
                            <option value="fortnightly">Fortnightly</option>
                            <option value="monthly">Monthly</option>
                            <option value="seasonal">Seasonal</option>
                            <option value="ad_hoc">Ad hoc</option>
                          </select>
                        </div>

                        <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-900">4) Preferred day/time</div>
                          <input
                            value={fvPreferredDayTime[job.id] ?? ""}
                            onChange={(e) => setFvPreferredDayTime((p) => ({ ...p, [job.id]: e.target.value }))}
                            placeholder="e.g. ‘Mon AM’, ‘Any weekday’, ‘Avoid school run’…"
                            className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-900">5) Budget guideline</div>
                          <input
                            value={fvBudgetGuideline[job.id] ?? ""}
                            onChange={(e) => setFvBudgetGuideline((p) => ({ ...p, [job.id]: e.target.value }))}
                            placeholder="e.g. ‘Keep it tight’, ‘Happy to pay for quality’, ‘Needs quote first’…"
                            className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                          />
                        </div>

                        <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-900">6) Seasonal focus</div>
                          <input
                            value={fvSeasonalFocus[job.id] ?? ""}
                            onChange={(e) => setFvSeasonalFocus((p) => ({ ...p, [job.id]: e.target.value }))}
                            placeholder="e.g. spring tidy, summer pruning, autumn leaf clearance…"
                            className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-2 rounded-2xl border border-emerald-200 bg-white p-3">
                        <div className="text-[11px] font-semibold text-slate-900">7) Access (gate/key/code)</div>
                        <input
                          value={fvGateAccess[job.id] ?? ""}
                          onChange={(e) => setFvGateAccess((p) => ({ ...p, [job.id]: e.target.value }))}
                          placeholder="e.g. side gate key in lockbox, code, leave open…"
                          className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                        <div className="mt-2 text-[11px] font-semibold text-slate-900">Parking</div>
                        <input
                          value={fvParking[job.id] ?? ""}
                          onChange={(e) => setFvParking((p) => ({ ...p, [job.id]: e.target.value }))}
                          placeholder="e.g. driveway ok, permit, avoid blocking, neighbours…"
                          className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-900">8) Pets / hazards</div>
                          <input
                            value={fvPets[job.id] ?? ""}
                            onChange={(e) => setFvPets((p) => ({ ...p, [job.id]: e.target.value }))}
                            placeholder="e.g. dog in garden, keep gate shut…"
                            className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                          />
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-900">9) Water access</div>
                          <input
                            value={fvWaterAccess[job.id] ?? ""}
                            onChange={(e) => setFvWaterAccess((p) => ({ ...p, [job.id]: e.target.value }))}
                            placeholder="e.g. outside tap left side, hose ok…"
                            className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-900">10) Waste preference</div>
                          <input
                            value={fvWastePreference[job.id] ?? ""}
                            onChange={(e) => setFvWastePreference((p) => ({ ...p, [job.id]: e.target.value }))}
                            placeholder="e.g. use green bin, take away, compost corner…"
                            className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                          />
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-900">11) Photo consent</div>
                          <select
                            value={fvPhotoConsent[job.id] ?? ""}
                            onChange={(e) =>
                              setFvPhotoConsent((p) => ({
                                ...p,
                                [job.id]: e.target.value as FirstVisitQuestionnaire["photoConsent"],
                              }))
                            }
                            className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
                          >
                            <option value="">Choose…</option>
                            <option value="yes">Yes (before/after ok)</option>
                            <option value="no">No</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-2 rounded-2xl border border-emerald-200 bg-white p-3">
                        <div className="text-[11px] font-semibold text-slate-900">12) what3words confirm (optional)</div>
                        <input
                          value={fvW3wConfirm[job.id] ?? ""}
                          onChange={(e) => setFvW3wConfirm((p) => ({ ...p, [job.id]: e.target.value }))}
                          placeholder="If address is tricky, confirm what3words (e.g. word.word.word)"
                          className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                      </div>

                      <div className="mt-2 rounded-2xl border border-emerald-200 bg-white p-3">
                        <div className="text-[11px] font-semibold text-slate-900">Anything else the customer wants us to know?</div>
                        <textarea
                          value={fvCustomerNotes[job.id] ?? ""}
                          onChange={(e) => setFvCustomerNotes((p) => ({ ...p, [job.id]: e.target.value }))}
                          placeholder="e.g. ‘Don’t cut this shrub’, ‘Kids toys in lawn’, ‘Focus on front first’…"
                          className="mt-1 min-h-[72px] w-full resize-none rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => saveFirstVisit(job)}
                          className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
                        >
                          Save plan
                        </button>
                        <button
                          onClick={() => setOpenFirstVisitForJob(null)}
                          className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-900"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="mt-2 text-[11px] text-emerald-900/80">
                        Saving creates a stamped summary + a follow-up entry so Kelly can plan the year.
                      </div>
                    </div>
                  ) : null}

                  {/* Notes section */}
                  <div id={`job-${job.id}-notes`} className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-900">Worker notes (stamped)</div>

                    <textarea
                      value={(job.completionNotes ?? "").trim()}
                      readOnly
                      placeholder="No worker notes yet."
                      className="mt-2 min-h-[92px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none"
                    />

                    <div className="mt-2 grid gap-2">
                      <input
                        value={draftWorkNote[job.id] ?? ""}
                        onChange={(e) => setDraftWorkNote((p) => ({ ...p, [job.id]: e.target.value }))}
                        placeholder="Add a note… (this will be stamped)"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                      />
                      <button
                        onClick={() => appendStampedWorkNote(job)}
                        className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                      >
                        Add stamped note
                      </button>
                    </div>

                    {/* First visit log view (if any) */}
                    {job.firstVisit?.log ? (
                      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs font-semibold text-emerald-900">First visit plan log</div>
                        <textarea
                          value={(job.firstVisit.log ?? "").trim()}
                          readOnly
                          className="mt-2 min-h-[88px] w-full resize-none rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* Follow-up */}
                  <div className="mt-3 grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(job.followUpNeeded)}
                          onChange={(e) =>
                            updateJob(job.id, {
                              followUpNeeded: e.target.checked,
                              acknowledged: e.target.checked ? false : job.acknowledged,
                            })
                          }
                        />
                        <span className="text-sm font-semibold text-slate-900">Follow-up needed</span>
                      </label>

                      <select
                        value={job.followUpType ?? ""}
                        onChange={(e) => updateJob(job.id, { followUpType: e.target.value as FollowUpType })}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">Type…</option>
                        <option value="booking">Book more dates</option>
                        <option value="quote">Quote needed</option>
                        <option value="acknowledge">Needs acknowledgement</option>
                      </select>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-900">Follow-up notes (stamped)</div>
                      <textarea
                        value={(job.followUpNote ?? "").trim()}
                        readOnly
                        placeholder="No follow-up notes yet."
                        className="mt-2 min-h-[72px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none"
                      />

                      <div className="mt-2 grid gap-2">
                        <input
                          value={draftFollowupNote[job.id] ?? ""}
                          onChange={(e) => setDraftFollowupNote((p) => ({ ...p, [job.id]: e.target.value }))}
                          placeholder="Add follow-up note for Kelly… (stamped)"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        />
                        <button
                          onClick={() => appendStampedFollowup(job)}
                          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm"
                        >
                          Add stamped follow-up
                        </button>
                      </div>
                    </div>

                    <input
                      value={job.what3words ?? ""}
                      onChange={(e) => updateJob(job.id, { what3words: e.target.value })}
                      placeholder="what3words (optional, if tricky to find)"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  {/* Photos */}
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-slate-900">Photos</div>
                      <label className="inline-flex cursor-pointer items-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                        + Add
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleAddPhotos(job.id, e.target.files)}
                        />
                      </label>
                    </div>

                    {photos.length === 0 ? (
                      <div className="mt-2 text-xs text-slate-600">Add before/after photos (stored on this device for now).</div>
                    ) : (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {photos.slice(0, 9).map((p) => (
                          <div key={p.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt={p.name} className="h-24 w-full object-cover" />
                            <button
                              onClick={() => handleDeletePhoto(job.id, p.id)}
                              className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white"
                              aria-label="Delete photo"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}