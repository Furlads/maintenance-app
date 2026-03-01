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
};

function safeWorkers(data: any): Worker[] {
  const list = Array.isArray(data) ? data : Array.isArray(data?.workers) ? data.workers : [];
  return list.filter((w) => !w.archivedAt);
}

function safeNumber(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function AddJobPage() {
  const router = useRouter();

  // workers
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  // form
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");

  // ✅ IMPORTANT: store full worker name
  const [assignedTo, setAssignedTo] = useState("");

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

        // default to first worker
        if (!assignedTo && list.length > 0) {
          setAssignedTo(list[0].name);
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workerOptions = useMemo(() => {
    return [...workers].sort((a, b) => a.name.localeCompare(b.name));
  }, [workers]);

  async function submit() {
    setSubmitting(true);
    setErrorMsg("");

    try {
      const missing: string[] = [];
      if (!title.trim()) missing.push("Title");
      if (!address.trim()) missing.push("Address");
      if (!assignedTo.trim()) missing.push("Assigned to");

      if (scheduleMode === "fixed" && !visitDate.trim()) missing.push("Visit date");

      if (missing.length) {
        setErrorMsg(`Missing: ${missing.join(", ")}`);
        setSubmitting(false);
        return;
      }

      const addressWithPostcode =
        postcode.trim().length > 0 ? `${address.trim()}\n${postcode.trim().toUpperCase()}` : address.trim();

      const payload: any = {
        title: title.trim(),
        address: addressWithPostcode,
        notes: notes.trim(),
        // ✅ full name saved into job
        assignedTo: assignedTo.trim(),
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
            Assigned to <span className="font-semibold">{created.assignedTo}</span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded bg-black px-4 py-2 text-sm text-white hover:opacity-90"
              onClick={() => window.location.reload()}
            >
              Add another job
            </button>

            <button
              className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
              onClick={() => router.push("/admin")}
            >
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
            <label className="mb-1 block text-sm font-medium">Title *</label>
            <input className="w-full rounded border px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Address *</label>
            <textarea className="w-full rounded border px-3 py-2 text-sm" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Postcode</label>
            <input className="w-full rounded border px-3 py-2 text-sm" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Assigned to *</label>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={loadingWorkers}
            >
              {workerOptions.length === 0 ? (
                <option value="">{loadingWorkers ? "Loading workers..." : "No workers found"}</option>
              ) : (
                workerOptions.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}{w.role ? ` — ${w.role}` : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Duration (mins)</label>
              <input className="w-full rounded border px-3 py-2 text-sm" type="number" min={15} step={15} value={durationMins} onChange={(e) => setDurationMins(safeNumber(e.target.value, 120))} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <input className="w-full rounded border px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="mb-2 text-sm font-medium">Scheduling</div>

            <label className="flex items-start gap-2 text-sm">
              <input type="radio" checked={scheduleMode === "economic"} onChange={() => setScheduleMode("economic")} />
              <span><b>Economic</b> — no date/time required</span>
            </label>

            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="radio" checked={scheduleMode === "fixed"} onChange={() => setScheduleMode("fixed")} />
              <span><b>Fixed</b> — customer insists on a set day/time</span>
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

            <button className="rounded bg-black px-5 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50" type="button" onClick={submit} disabled={submitting}>
              {submitting ? "Adding…" : "Add job"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}