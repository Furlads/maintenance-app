"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Worker = {
  id: string;
  name: string;
  phone: string;
  role?: string | null;
  photoUrl?: string | null;
  archivedAt?: string | null;

  // Optional / future-proof fields (depends what your /api/workers returns)
  business?: string | null;
  businessName?: string | null;
  company?: string | null;
  org?: string | null;
  businesses?: string[] | null;
};

type BusinessKey = "furlads" | "threecounties";

const BUSINESS_OPTIONS: { key: BusinessKey; label: string; aliases: string[] }[] = [
  { key: "furlads", label: "Furlads", aliases: ["furlads", "furlads ltd"] },
  {
    key: "threecounties",
    label: "Three Counties Property Care",
    aliases: ["three counties", "threecounties", "three counties property care", "threecounties property care"],
  },
];

function safeWorkers(data: any): Worker[] {
  const list = Array.isArray(data) ? data : Array.isArray(data?.workers) ? data.workers : [];
  return list.filter((w) => !w.archivedAt);
}

function safeNumber(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function cleanLower(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function workerBusinessKey(w: Worker): BusinessKey | null {
  // Try a bunch of possible shapes so this works even if the API differs slightly.
  const candidates: string[] = [];

  if (typeof w.business === "string") candidates.push(w.business);
  if (typeof w.businessName === "string") candidates.push(w.businessName);
  if (typeof w.company === "string") candidates.push(w.company);
  if (typeof w.org === "string") candidates.push(w.org);
  if (Array.isArray(w.businesses)) candidates.push(...w.businesses);

  const norm = candidates.map(cleanLower).filter(Boolean);

  if (norm.length === 0) return null;

  for (const opt of BUSINESS_OPTIONS) {
    for (const c of norm) {
      if (opt.aliases.some((a) => c.includes(a))) return opt.key;
    }
  }

  return null;
}

export default function AddJobPage() {
  const router = useRouter();

  // workers
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  // form
  const [business, setBusiness] = useState<BusinessKey | "">("");
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");

  // assigned worker (we store both id + name for safety)
  const [assignedWorkerId, setAssignedWorkerId] = useState<string>("");
  const [assignedToName, setAssignedToName] = useState<string>("");

  const [durationMins, setDurationMins] = useState<number>(120);

  // scheduling
  const [scheduleMode, setScheduleMode] = useState<"economic" | "fixed">("economic");
  const [visitDate, setVisitDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");

  // recurrence
  const [recurrenceActive, setRecurrenceActive] = useState(false);
  const [recurrenceEveryWeeks, setRecurrenceEveryWeeks] = useState<number>(4);
  const [recurrenceDurationMins, setRecurrenceDurationMins] = useState<number>(120);
  const [recurrencePreferredDOW, setRecurrencePreferredDOW] = useState<number>(1);
  const [recurrencePreferredTime, setRecurrencePreferredTime] = useState<string>("");

  // ui
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [created, setCreated] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingWorkers(true);
      setErrorMsg("");
      try {
        const res = await fetch("/api/workers", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? `Workers fetch failed: ${res.status}`);

        const list = safeWorkers(data);
        if (cancelled) return;

        setWorkers(list);
      } catch (e: any) {
        if (!cancelled) setErrorMsg(e?.message || "Failed to load workers");
      } finally {
        if (!cancelled) setLoadingWorkers(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredWorkers = useMemo(() => {
    const sorted = [...workers].sort((a, b) => a.name.localeCompare(b.name));
    if (!business) return sorted;

    // If workers carry business metadata, filter. If not, show all (so we never block Kelly).
    const anyHasBusinessInfo = sorted.some((w) => workerBusinessKey(w) !== null);
    if (!anyHasBusinessInfo) return sorted;

    return sorted.filter((w) => workerBusinessKey(w) === business);
  }, [workers, business]);

  // When business changes, pick a sensible default worker for that business
  useEffect(() => {
    if (!business) {
      setAssignedWorkerId("");
      setAssignedToName("");
      return;
    }

    // If current selection still valid, keep it
    const stillThere = filteredWorkers.find((w) => w.id === assignedWorkerId);
    if (stillThere) {
      setAssignedToName(stillThere.name);
      return;
    }

    // Otherwise choose first worker in filtered list
    const first = filteredWorkers[0];
    if (first) {
      setAssignedWorkerId(first.id);
      setAssignedToName(first.name);
    } else {
      setAssignedWorkerId("");
      setAssignedToName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business, filteredWorkers.length]);

  // When worker id changes, sync name
  useEffect(() => {
    const w = workers.find((x) => x.id === assignedWorkerId);
    if (w) setAssignedToName(w.name);
  }, [assignedWorkerId, workers]);

  async function submit() {
    setSubmitting(true);
    setErrorMsg("");

    try {
      const missing: string[] = [];
      if (!business) missing.push("Business");
      if (!title.trim()) missing.push("Title");
      if (!address.trim()) missing.push("Address");
      if (!assignedToName.trim()) missing.push("Assigned to");

      if (scheduleMode === "fixed" && !visitDate.trim()) missing.push("Visit date");

      if (missing.length) {
        setErrorMsg(`Missing: ${missing.join(", ")}`);
        setSubmitting(false);
        return;
      }

      const addressWithPostcode =
        postcode.trim().length > 0 ? `${address.trim()}\n${postcode.trim().toUpperCase()}` : address.trim();

      const payload: any = {
        business, // ✅ new (safe if API ignores, useful once stored)
        title: title.trim(),
        address: addressWithPostcode,
        notes: notes.trim(),

        // ✅ keep scheduler compatibility: assignedTo string
        assignedTo: assignedToName.trim(),

        // ✅ also send workerId for future-proofing
        assignedWorkerId: assignedWorkerId || null,

        durationMins: safeNumber(durationMins, 120),

        recurrenceActive: recurrenceActive === true,
        recurrenceEveryWeeks: recurrenceActive ? safeNumber(recurrenceEveryWeeks, 4) : null,
        recurrenceDurationMins: recurrenceActive ? safeNumber(recurrenceDurationMins, safeNumber(durationMins, 120)) : null,
        recurrencePreferredDOW: recurrenceActive ? safeNumber(recurrencePreferredDOW, 1) : null,
        recurrencePreferredTime: recurrenceActive ? (recurrencePreferredTime || "").trim() : "",
      };

      if (scheduleMode === "fixed") {
        payload.visitDate = visitDate.trim();
        payload.startTime = (startTime || "").trim();
      } else {
        payload.visitDate = null;
        payload.startTime = null;
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Failed to add job (${res.status})`);
      }

      const job = await res.json();
      setCreated(job);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to add job");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-xl border bg-white p-6">
          <div className="text-2xl font-semibold">✅ Job added</div>
          <div className="mt-2 text-sm text-gray-600">
            Business: <span className="font-semibold">{business ? BUSINESS_OPTIONS.find((b) => b.key === business)?.label : "—"}</span>
            <span className="mx-2">•</span>
            Assigned to <span className="font-semibold">{created.assignedTo}</span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded bg-black px-4 py-2 text-sm text-white hover:opacity-90"
              onClick={() => window.location.reload()}
            >
              Add another job
            </button>

            <button className="rounded border px-4 py-2 text-sm hover:bg-gray-50" onClick={() => router.push("/admin")}>
              Dashboard
            </button>

            <button
              className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
              onClick={() => router.push("/admin/unscheduled")}
            >
              View unscheduled list
            </button>
          </div>
        </div>
      </div>
    );
  }

  const businessLabel = business ? BUSINESS_OPTIONS.find((b) => b.key === business)?.label : "";

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Add job</h1>
          <p className="text-sm text-gray-600">Create a new visit and assign it to a worker</p>
        </div>
        <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50" onClick={() => router.push("/admin")}>
          ← Back to dashboard
        </button>
      </div>

      {errorMsg ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMsg}</div>
      ) : null}

      <div className="rounded-lg border bg-white p-4">
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Business *</label>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={business}
              onChange={(e) => setBusiness(e.target.value as any)}
            >
              <option value="">Select business…</option>
              {BUSINESS_OPTIONS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-gray-500">This controls which worker list shows up.</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Title *</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={businessLabel ? `${businessLabel} — e.g. Quote visit / Maintenance / Site check` : "e.g. Quote visit / Maintenance / Site check"}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Address *</label>
            <textarea
              className="w-full rounded border px-3 py-2 text-sm"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House name/number, street, town"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Postcode</label>
            <input className="w-full rounded border px-3 py-2 text-sm" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Assigned to *</label>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={assignedWorkerId}
              onChange={(e) => setAssignedWorkerId(e.target.value)}
              disabled={loadingWorkers || !business}
            >
              {!business ? (
                <option value="">Pick business first…</option>
              ) : filteredWorkers.length === 0 ? (
                <option value="">
                  {loadingWorkers ? "Loading workers..." : "No workers found for this business"}
                </option>
              ) : (
                <>
                  <option value="">Select worker…</option>
                  {filteredWorkers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.role ? ` — ${w.role}` : ""}
                    </option>
                  ))}
                </>
              )}
            </select>

            <div className="mt-1 text-xs text-gray-500">
              This list comes from the Workers page (including role). {business ? "Filtered by selected business." : ""}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Duration (mins)</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                type="number"
                min={15}
                step={15}
                value={durationMins}
                onChange={(e) => setDurationMins(safeNumber(e.target.value, 120))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Notes (visible to worker)</label>
              <textarea
                className="w-full rounded border px-3 py-2 text-sm"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gate code, access, customer requests, warnings, what to do…"
              />
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="mb-2 text-sm font-medium">Scheduling</div>

            <label className="flex items-start gap-2 text-sm">
              <input type="radio" checked={scheduleMode === "economic"} onChange={() => setScheduleMode("economic")} />
              <span>
                <b>Economic</b> — no date/time required (default)
              </span>
            </label>

            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="radio" checked={scheduleMode === "fixed"} onChange={() => setScheduleMode("fixed")} />
              <span>
                <b>Fixed</b> — customer insists on a set day/time
              </span>
            </label>

            {scheduleMode === "fixed" ? (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Visit date *</label>
                  <input className="w-full rounded border px-3 py-2 text-sm" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Start time (optional)</label>
                  <input className="w-full rounded border px-3 py-2 text-sm" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={recurrenceActive} onChange={(e) => setRecurrenceActive(e.target.checked)} />
              Recurring job
            </label>

            {recurrenceActive ? (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Every (weeks)</label>
                  <input className="w-full rounded border px-3 py-2 text-sm" type="number" min={1} value={recurrenceEveryWeeks} onChange={(e) => setRecurrenceEveryWeeks(safeNumber(e.target.value, 4))} />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Recurring duration (mins)</label>
                  <input className="w-full rounded border px-3 py-2 text-sm" type="number" min={15} step={15} value={recurrenceDurationMins} onChange={(e) => setRecurrenceDurationMins(safeNumber(e.target.value, durationMins))} />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Preferred day</label>
                  <select className="w-full rounded border px-3 py-2 text-sm" value={recurrencePreferredDOW} onChange={(e) => setRecurrencePreferredDOW(safeNumber(e.target.value, 1))}>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                    <option value={0}>Sunday</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Preferred time (optional)</label>
                  <input className="w-full rounded border px-3 py-2 text-sm" type="time" value={recurrencePreferredTime} onChange={(e) => setRecurrencePreferredTime(e.target.value)} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between">
            <button className="rounded border px-4 py-2 text-sm hover:bg-gray-50" type="button" onClick={() => router.push("/admin")}>
              Cancel
            </button>

            <button
              className="rounded bg-black px-5 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              type="button"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "Adding…" : "Add job"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}