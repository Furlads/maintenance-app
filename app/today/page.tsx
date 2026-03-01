// app/today/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Who = "Kelly" | "Trev" | "Stephen" | "Jacob" | "";

type Me = {
  authenticated: boolean;
  name?: string;
  role?: string;
  isAdmin?: boolean;
};

type Job = {
  id: string;
  title: string;
  address: string;
  postcode: string;
  phone?: string | null;
  notes?: string | null;
  notesLog: string;
  status: "todo" | "done" | "unscheduled";
  visitDate?: string | null;
  startTime?: string | null;
  assignedTo: string;
  fixed: boolean;
  durationMins: number;
  overrunMins: number;
  arrivedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfToday() {
  const d = startOfToday();
  const e = new Date(d);
  e.setDate(e.getDate() + 1);
  return e;
}
function yyyyMmDd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function mapsLink(address: string, postcode: string) {
  const q = encodeURIComponent(`${address}\n${postcode}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function normalizePhoneForTel(raw: string) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/[^\d]/g, "");
  return digits ? `${plus}${digits}` : "";
}

function findPhoneNumberInText(text: string) {
  if (!text) return null;
  const candidates = text.match(/(\+?\d[\d\s().-]{7,}\d)/g);
  if (!candidates) return null;

  for (const c of candidates) {
    const tel = normalizePhoneForTel(c);
    if (!tel) continue;
    const digits = tel.replace(/[^\d]/g, "");
    if (digits.length >= 10 && digits.length <= 15) {
      return { display: c.trim(), tel: tel.startsWith("+") ? tel : digits };
    }
  }
  return null;
}

function getJobPhone(job: Job) {
  const fromField = (job.phone ?? "").trim();
  if (fromField) {
    const tel = normalizePhoneForTel(fromField);
    const digits = tel.replace(/[^\d]/g, "");
    return { display: fromField, tel: tel.startsWith("+") ? tel : digits || tel };
  }

  const sources = [job.notes ?? "", job.notesLog ?? "", job.address ?? ""].filter(Boolean);
  for (const s of sources) {
    const found = findPhoneNumberInText(s);
    if (found) return found;
  }
  return null;
}

function readWhoFromStorage(): Who {
  try {
    const v = (window.localStorage.getItem("who") || "").trim();
    if (v === "Kelly" || v === "Trev" || v === "Stephen" || v === "Jacob") return v;
    return "";
  } catch {
    return "";
  }
}

function saveWhoToStorage(who: Who) {
  try {
    window.localStorage.setItem("who", who);
  } catch {
    // ignore
  }
}

function whoFromMe(me: Me): Who {
  const n = String(me?.name || "").toLowerCase();
  if (n.includes("trevor")) return "Trev";
  if (n.includes("kelly")) return "Kelly";
  if (n.includes("stephen") || n.includes("steve")) return "Stephen";
  if (n.includes("jacob")) return "Jacob";
  return "";
}

export default function TodayPage() {
  const router = useRouter();

  const [who, setWho] = useState<Who>(""); // selected user
  const [booted, setBooted] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");

  const [todayLabel, setTodayLabel] = useState<string>("");

  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const notesRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const mapWindows = useRef<Record<string, Window | null>>({});

  const isTrev = who === "Trev";
  const todayStart = useMemo(() => startOfToday(), []);
  const todayEnd = useMemo(() => endOfToday(), []);

  async function loadMe(): Promise<Me> {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as Me;
      return data;
    } catch {
      return { authenticated: false };
    }
  }

  async function logoutAndGoLogin() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    try {
      window.localStorage.removeItem("who");
    } catch {
      // ignore
    }
    window.location.href = "/login";
  }

  // ✅ On mount: prefer session identity, fallback to storage
  useEffect(() => {
    setTodayLabel(yyyyMmDd(new Date()));

    (async () => {
      const me = await loadMe();
      const sessionWho = me.authenticated ? whoFromMe(me) : "";
      const storedWho = readWhoFromStorage();
      const chosen = sessionWho || storedWho || "";
      if (chosen) saveWhoToStorage(chosen);
      setWho(chosen);
      setBooted(true);

      // If not logged in, bounce to /login (proxy should do this too, but keep it explicit)
      if (!me.authenticated) {
        window.location.href = "/login";
      }
    })();
  }, []);

  async function fetchJobs(currentWho: Who) {
    setLoading(true);
    setMsg("");

    try {
      const params = new URLSearchParams();
      if (currentWho && currentWho !== "Trev") params.set("assignedTo", currentWho);

      const res = await fetch(`/api/jobs?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load jobs");

      const list = Array.isArray(data) ? data : Array.isArray(data.jobs) ? data.jobs : [];
      setJobs(list);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!who) return;
    fetchJobs(who);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who]);

  async function rebuild(scopeAssignedTo?: string) {
    await fetch("/api/schedule/rebuild", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: scopeAssignedTo ? JSON.stringify({ assignedTo: scopeAssignedTo }) : "",
    });
  }

  async function patchJob(id: string, body: any) {
    setMsg("");
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Update failed");
    return data.job as Job;
  }

  function openMapForJob(job: Job) {
    const url = mapsLink(job.address, job.postcode);
    const w = window.open(url, "_blank");
    mapWindows.current[job.id] = w ?? null;
    setMsg("🗺️ Opened Maps");
  }

  async function markArrived(job: Job) {
    try {
      await patchJob(job.id, { arrivedNow: true });

      const w = mapWindows.current[job.id];
      if (w && !w.closed) w.close();
      mapWindows.current[job.id] = null;

      await fetchJobs(who);

      const el = notesRefs.current[job.id];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }

      setMsg("✅ Arrived logged");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to mark arrived");
    }
  }

  async function finishAndNavigateNext(job: Job, visibleList: Job[]) {
    if (!isTrev && !job.arrivedAt) {
      setMsg("⚠️ You must tap “I’m here” first (arrival timestamp required).");
      const el = notesRefs.current[job.id];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
      return;
    }

    try {
      await patchJob(job.id, { finishedNow: true });
      await fetchJobs(who);

      const idx = visibleList.findIndex((j) => j.id === job.id);
      const next = idx >= 0 ? visibleList[idx + 1] : null;

      if (next) {
        openMapForJob(next);
        setMsg("✅ Finished logged — opening next job in Maps");
      } else {
        setMsg("✅ Finished logged — no next job");
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to finish");
    }
  }

  async function toggleDoneEnforced(job: Job) {
    if (!isTrev && job.status !== "done" && !job.finishedAt) {
      setMsg("⚠️ You must tap “I’m finished → Next job” before marking this job done.");
      return;
    }

    try {
      await patchJob(job.id, { toggleStatus: true });
      await fetchJobs(who);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to toggle status");
    }
  }

  async function onExtend(job: Job, mins: number) {
    try {
      await patchJob(job.id, { extendMins: mins });
      await fetchJobs(who);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to extend");
    }
  }

  async function onAddNote(job: Job) {
    const text = (noteDraft[job.id] ?? "").trim();
    if (!text) return;

    try {
      await patchJob(job.id, { appendNote: text });
      setNoteDraft((prev) => ({ ...prev, [job.id]: "" }));
      await fetchJobs(who);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to add note");
    }
  }

  const visible = useMemo(() => {
    const todoScheduled = jobs.filter((j) => j.status === "todo" && j.visitDate);
    const todayAndOverdue = todoScheduled.filter((j) => new Date(j.visitDate as string) < todayEnd);

    todayAndOverdue.sort((a, b) => {
      const ad = new Date(a.visitDate as string).getTime();
      const bd = new Date(b.visitDate as string).getTime();
      if (ad !== bd) return ad - bd;
      return (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });

    const doneToday = jobs.filter((j) => {
      if (j.status !== "done" || !j.visitDate) return false;
      const vd = new Date(j.visitDate);
      return vd >= todayStart && vd < todayEnd;
    });

    return { todayAndOverdue, doneToday };
  }, [jobs, todayEnd, todayStart]);

  // ✅ If no who yet, show chooser IN PLACE
  if (!booted || !who) {
    return (
      <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900 }}>Maintenance App</h1>
        <div style={{ marginTop: 10, opacity: 0.75 }}>Who are you?</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          {(["Stephen", "Jacob", "Trev", "Kelly"] as Who[]).map((name) => (
            <button
              key={name}
              onClick={() => {
                saveWhoToStorage(name);
                setWho(name);
              }}
              style={{
                padding: "14px 12px",
                borderRadius: 14,
                border: "1px solid #ccc",
                fontWeight: 900,
                fontSize: 18,
                background: "white",
              }}
            >
              {name}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 18, opacity: 0.7, fontSize: 12 }}>
          If this keeps resetting on iPhone, make sure you’re not in Private Browsing and try refreshing once.
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            onClick={logoutAndGoLogin}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", width: "100%" }}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  const rebuildLabel = isTrev ? "Rebuild all" : "Rebuild my diary";
  const rebuildScope = isTrev ? undefined : who;

  return (
    <div style={{ padding: 16, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>{isTrev ? "Overview (Trev)" : `${who}'s Jobs`}</h1>
          <div style={{ opacity: 0.75, marginTop: 2 }}>
            Today: <b>{todayLabel || "…"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            onClick={logoutAndGoLogin}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc" }}
          >
            Logout / Switch user
          </button>

          <button
            onClick={() => router.push("/my-visits")}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc" }}
          >
            /my-visits
          </button>

          <button
            onClick={async () => {
              setMsg("Rebuilding diary…");
              try {
                await rebuild(rebuildScope);
                await fetchJobs(who);
                setMsg("✅ Diary rebuilt");
              } catch {
                setMsg("Rebuild failed");
              }
            }}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #111", fontWeight: 900 }}
          >
            {rebuildLabel}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 14 }}>Loading jobs…</div>
      ) : (
        <>
          <h2 style={{ marginTop: 18, marginBottom: 10, fontSize: 16, fontWeight: 900 }}>
            Today + Overdue (TODO){" "}
            <span style={{ fontSize: 12, opacity: 0.7 }}>({visible.todayAndOverdue.length})</span>
          </h2>

          {visible.todayAndOverdue.length === 0 ? (
            <div style={{ padding: 12, borderRadius: 14, border: "1px dashed #ccc", opacity: 0.85 }}>
              Nothing due today or overdue 🎉
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {visible.todayAndOverdue.map((job) => {
                const phone = getJobPhone(job);
                const canFinish = isTrev || !!job.arrivedAt;
                const canMarkDone = isTrev || !!job.finishedAt || job.status === "done";

                return (
                  <div key={job.id} style={{ padding: 12, borderRadius: 14, border: "1px solid #ddd" }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>
                      {job.title}{" "}
                      <span style={{ fontSize: 12, opacity: 0.7 }}>
                        {job.fixed ? "(fixed)" : "(economic)"}
                      </span>
                    </div>

                    <div style={{ marginTop: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>{job.address}</div>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                      Postcode: <b>{job.postcode}</b>
                    </div>

                    {!isTrev && (
                      <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid #eee", fontSize: 12 }}>
                        {!job.arrivedAt && <div style={{ fontWeight: 900 }}>✅ Required: tap “I’m here” when you arrive.</div>}
                        {job.arrivedAt && !job.finishedAt && (
                          <div style={{ fontWeight: 900 }}>✅ Required: tap “I’m finished” before marking done.</div>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button onClick={() => openMapForJob(job)} style={btn(true, true)}>Navigate</button>
                      <button onClick={() => markArrived(job)} style={btn(true, true)}>I'm here</button>

                      <button
                        onClick={canFinish ? () => finishAndNavigateNext(job, visible.todayAndOverdue) : undefined}
                        disabled={!canFinish}
                        style={btn(canFinish, true)}
                      >
                        I'm finished → Next job
                      </button>

                      <button
                        onClick={canMarkDone ? () => toggleDoneEnforced(job) : undefined}
                        disabled={!canMarkDone}
                        style={btn(canMarkDone, false)}
                      >
                        {job.status === "done" ? "Undo done" : "Mark done"}
                      </button>

                      {job.status !== "done" && (
                        <>
                          <button onClick={() => onExtend(job, 30)} style={btn(true, false)}>Extend +30</button>
                          <button onClick={() => onExtend(job, 60)} style={btn(true, false)}>Extend +60</button>
                        </>
                      )}

                      <button
                        onClick={async () => {
                          const ok = await copyToClipboard(`${job.address}\n${job.postcode}`.trim());
                          setMsg(ok ? "✅ Address copied" : "Couldn’t copy");
                        }}
                        style={btn(true, false)}
                      >
                        Copy address
                      </button>

                      {phone && (
                        <a
                          href={`tel:${phone.tel}`}
                          style={{
                            display: "inline-block",
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #ccc",
                            textDecoration: "none",
                            color: "inherit",
                            fontWeight: 600,
                          }}
                        >
                          Call
                        </a>
                      )}
                    </div>

                    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>Notes</div>
                      <textarea
                        ref={(el) => (notesRefs.current[job.id] = el)}
                        value={noteDraft[job.id] ?? ""}
                        onChange={(e) => setNoteDraft((p) => ({ ...p, [job.id]: e.target.value }))}
                        rows={2}
                        placeholder="What needs doing / progress…"
                        style={{ padding: 10, borderRadius: 12, border: "1px solid #ccc" }}
                      />
                      <button
                        onClick={() => onAddNote(job)}
                        disabled={!(noteDraft[job.id] ?? "").trim()}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #ccc",
                          width: "fit-content",
                          opacity: (noteDraft[job.id] ?? "").trim() ? 1 : 0.5,
                        }}
                      >
                        Save note
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function btn(enabled: boolean, strong?: boolean) {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: strong ? "1px solid #111" : "1px solid #ccc",
    fontWeight: strong ? 900 : 600,
    opacity: enabled ? 1 : 0.35,
    cursor: enabled ? "pointer" : "not-allowed",
    background: "white",
  } as React.CSSProperties;
}