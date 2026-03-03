"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CompanyKey = "furlads" | "threecounties";

type WorkerKey = "trev" | "kelly" | "jacob";

type JobStatus = "todo" | "in_progress" | "done";

type MaintenanceJob = {
  id: string;
  title: string;
  address: string;
  notes?: string;
  scheduledDate?: string; // YYYY-MM-DD
  status: JobStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

const ADMIN_WORKERS: WorkerKey[] = ["trev", "kelly"];

const LS_KEYS = {
  company: "company",
  worker: "worker",
  tcJobs: "threecounties_jobs_v1",
};

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
        status: (j.status as JobStatus) ?? "todo",
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

function formatPrettyDate(d?: string) {
  if (!d) return "No date";
  // d is YYYY-MM-DD
  const [y, m, day] = d.split("-").map((x) => Number(x));
  if (!y || !m || !day) return d;
  const date = new Date(y, m - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function statusLabel(s: JobStatus) {
  if (s === "todo") return "To do";
  if (s === "in_progress") return "In progress";
  return "Done";
}

function statusPillClasses(s: JobStatus) {
  // Three Counties green theme
  if (s === "done") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "in_progress")
    return "bg-lime-100 text-lime-800 border-lime-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

export default function AdminJobsPage() {
  const router = useRouter();

  const [company, setCompany] = useState<CompanyKey | null>(null);
  const [worker, setWorker] = useState<WorkerKey | null>(null);
  const [ready, setReady] = useState(false);

  const [jobs, setJobs] = useState<MaintenanceJob[]>([]);
  const [filter, setFilter] = useState<"all" | JobStatus>("all");
  const [query, setQuery] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newDate, setNewDate] = useState<string>("");

  // Identity + access gating (do not change identity logic — just read it)
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

      // /admin is admin-only: workers go back to /today
      if (!ADMIN_WORKERS.includes(w)) {
        router.replace("/today");
        return;
      }

      setReady(true);
    } catch {
      // If localStorage is blocked for any reason, force back to choose-company
      router.replace("/choose-company");
    }
  }, [router]);

  // Load Three Counties jobs (local-only store for now)
  useEffect(() => {
    if (!ready) return;
    // Only maintain Three Counties jobs list here (requested page)
    const stored = safeParseJobs(localStorage.getItem(LS_KEYS.tcJobs));

    // Helpful starter dataset if empty
    const seeded =
      stored.length > 0
        ? stored
        : [
            {
              id: crypto.randomUUID(),
              title: "Grass cut + edge",
              address: "Add address…",
              notes: "Standard maintenance visit",
              scheduledDate: "",
              status: "todo" as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ];

    setJobs(seeded);
    if (stored.length === 0) saveJobs(seeded);
  }, [ready]);

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs
      .filter((j) => (filter === "all" ? true : j.status === filter))
      .filter((j) => {
        if (!q) return true;
        return (
          j.title.toLowerCase().includes(q) ||
          j.address.toLowerCase().includes(q) ||
          (j.notes ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Sort by scheduledDate (soonest first), then updatedAt desc
        const ad = a.scheduledDate ? a.scheduledDate : "9999-12-31";
        const bd = b.scheduledDate ? b.scheduledDate : "9999-12-31";
        if (ad < bd) return -1;
        if (ad > bd) return 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [jobs, filter, query]);

  const counts = useMemo(() => {
    const c = { all: jobs.length, todo: 0, in_progress: 0, done: 0 } as const & {
      todo: number;
      in_progress: number;
      done: number;
    };
    for (const j of jobs) c[j.status] += 1;
    return c;
  }, [jobs]);

  function updateJob(id: string, patch: Partial<MaintenanceJob>) {
    setJobs((prev) => {
      const next = prev.map((j) =>
        j.id === id
          ? {
              ...j,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : j
      );
      saveJobs(next);
      return next;
    });
  }

  function deleteJob(id: string) {
    setJobs((prev) => {
      const next = prev.filter((j) => j.id !== id);
      saveJobs(next);
      return next;
    });
  }

  function resetCreateForm() {
    setNewTitle("");
    setNewAddress("");
    setNewNotes("");
    setNewDate("");
  }

  function createJob() {
    const title = newTitle.trim();
    const address = newAddress.trim();
    const notes = newNotes.trim();

    if (!title || !address) return;

    const now = new Date().toISOString();
    const job: MaintenanceJob = {
      id: crypto.randomUUID(),
      title,
      address,
      notes,
      scheduledDate: newDate ? newDate : "",
      status: "todo",
      createdAt: now,
      updatedAt: now,
    };

    setJobs((prev) => {
      const next = [job, ...prev];
      saveJobs(next);
      return next;
    });

    setIsCreateOpen(false);
    resetCreateForm();
  }

  // If identity is not ready, render nothing to avoid flicker/incorrect redirects
  if (!ready || !company || !worker) return null;

  // This page is specifically the Three Counties admin jobs list.
  // If user is in Furlads context, keep them inside admin but show a clear nudge.
  const isThreeCounties = company === "threecounties";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top brand bar (mobile-first) */}
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
              <div className="text-sm font-semibold text-slate-900">
                Admin · Jobs
              </div>
              <div className="text-xs text-slate-600">
                Three Counties maintenance list (quick & repeat-friendly)
              </div>
            </div>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
            >
              + New
            </button>
          </div>

          {/* Search + filters */}
          <div className="mt-3 flex flex-col gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, address, notes…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
            />

            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setFilter("all")}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  filter === "all"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                All · {counts.all}
              </button>
              <button
                onClick={() => setFilter("todo")}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  filter === "todo"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                To do · {counts.todo}
              </button>
              <button
                onClick={() => setFilter("in_progress")}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  filter === "in_progress"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                In progress · {counts.in_progress}
              </button>
              <button
                onClick={() => setFilter("done")}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  filter === "done"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Done · {counts.done}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-2xl px-4 py-4">
        {!isThreeCounties ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            You’re currently in <b>Furlads</b> mode. This page is the{" "}
            <b>Three Counties</b> admin jobs list. Switch user to continue in the
            correct brand.
          </div>
        ) : null}

        {filteredJobs.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <div className="text-base font-semibold text-slate-900">
              No jobs found
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Try a different filter or create a new maintenance job.
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              + Create job
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-base font-semibold text-slate-900">
                        {job.title}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPillClasses(
                          job.status
                        )}`}
                      >
                        {statusLabel(job.status)}
                      </span>
                    </div>

                    <div className="mt-1 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">
                        Address:
                      </span>{" "}
                      {job.address}
                    </div>

                    <div className="mt-1 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">When:</span>{" "}
                      {formatPrettyDate(job.scheduledDate)}
                    </div>

                    {job.notes ? (
                      <div className="mt-2 text-sm text-slate-600">
                        {job.notes}
                      </div>
                    ) : null}
                  </div>

                  <button
                    onClick={() => deleteJob(job.id)}
                    className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 active:scale-[0.99]"
                    aria-label="Delete job"
                    title="Delete job"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => updateJob(job.id, { status: "todo" })}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                        job.status === "todo"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      To do
                    </button>
                    <button
                      onClick={() =>
                        updateJob(job.id, { status: "in_progress" })
                      }
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                        job.status === "in_progress"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      In prog
                    </button>
                    <button
                      onClick={() => updateJob(job.id, { status: "done" })}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                        job.status === "done"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      Done
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      value={job.scheduledDate ?? ""}
                      onChange={(e) =>
                        updateJob(job.id, { scheduledDate: e.target.value })
                      }
                      type="date"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    />
                    <input
                      value={job.address}
                      onChange={(e) =>
                        updateJob(job.id, { address: e.target.value })
                      }
                      placeholder="Address"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  <textarea
                    value={job.notes ?? ""}
                    onChange={(e) => updateJob(job.id, { notes: e.target.value })}
                    placeholder="Notes (gate code, key location, what to do, etc.)"
                    className="min-h-[72px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create sheet (simple mobile-first overlay) */}
      {isCreateOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsCreateOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-base font-semibold text-slate-900">
                New maintenance job
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Job title (e.g., Cut & edge + tidy)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
              <input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Address"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
              <input
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="min-h-[90px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  resetCreateForm();
                }}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={createJob}
                disabled={!newTitle.trim() || !newAddress.trim()}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
              >
                Create
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Saved locally on this device (Three Counties mode).
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}