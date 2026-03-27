"use client";

import { useEffect, useMemo, useState } from "react";

type Job = {
  id: number;
  title: string;
  address: string;
  notes: string;
  notesLog: string;
  status: string;
  visitDate: string | null;
  assignedTo: string | null;
  createdAt: string;
};

type Worker = {
  id: number;
  name: string;
  company: string;
  role: string | null;
  active: boolean;
};

function toGBDate(date: Date) {
  return date.toLocaleDateString("en-GB");
}

function formatStatus(status: string) {
  const value = String(status || "").trim().toLowerCase();

  if (value === "in_progress") return "In progress";
  if (value === "todo") return "To do";
  if (value === "done") return "Done";
  if (value === "quoted") return "Quoted";
  if (value === "unscheduled") return "Unscheduled";

  return status || "Unknown";
}

function getStatusPillStyle(status: string): React.CSSProperties {
  const value = String(status || "").trim().toLowerCase();

  if (value === "done") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (value === "in_progress") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }

  if (value === "quoted") {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    };
  }

  if (value === "unscheduled") {
    return {
      background: "#f4f4f5",
      color: "#3f3f46",
      border: "1px solid #e4e4e7",
    };
  }

  return {
    background: "#f4f4f5",
    color: "#3f3f46",
    border: "1px solid #e4e4e7",
  };
}

export default function MyVisitsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const [errorMsg, setErrorMsg] = useState("");

  async function loadJobs() {
    const res = await fetch("/api/jobs", { cache: "no-store" });
    const data = await res.json();
    setJobs(Array.isArray(data) ? data : []);
  }

  async function loadWorkers() {
    const res = await fetch("/api/workers", { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || data?.error || "Failed to load workers");
    }

    setWorkers(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    async function loadPage() {
      try {
        await Promise.all([loadJobs(), loadWorkers()]);
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to load page data");
      } finally {
        setInitialLoading(false);
      }
    }

    loadPage();
  }, []);

  const missing = useMemo(() => {
    const values: string[] = [];
    if (!title.trim()) values.push("Title");
    if (!address.trim()) values.push("Address");
    if (!assignedTo.trim()) values.push("Assigned to");
    return values;
  }, [title, address, assignedTo]);

  const canSubmit = missing.length === 0 && !loading;

  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!canSubmit) {
      setErrorMsg(`Please fill: ${missing.join(", ")}`);
      return;
    }

    setLoading(true);

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        address,
        notes,
        visitDate: visitDate.trim() ? visitDate.trim() : null,
        assignedTo: assignedTo.trim().toLowerCase(),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setErrorMsg(`Failed to add job (${res.status}). ${text}`);
      return;
    }

    setTitle("");
    setAddress("");
    setNotes("");
    setVisitDate("");
    setAssignedTo("");

    await loadJobs();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: 16,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
        }}
      >
        <section
          style={{
            background: "linear-gradient(135deg, #111 0%, #1e1e1e 100%)",
            color: "#fff",
            borderRadius: 20,
            padding: 20,
            marginBottom: 18,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            border: "1px solid #222",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(255, 204, 0, 0.14)",
                  color: "#ffcc00",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  marginBottom: 12,
                }}
              >
                KELLY ADMIN
              </div>

              <h1
                style={{
                  fontSize: 30,
                  lineHeight: 1.1,
                  margin: "0 0 8px 0",
                }}
              >
                Add Jobs
              </h1>

              <p
                style={{
                  margin: 0,
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 15,
                  maxWidth: 580,
                  lineHeight: 1.45,
                }}
              >
                Quickly add a new job, assign it, and review the latest jobs already
                in the system.
              </p>
            </div>
          </div>
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid #e7e7e7",
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
            boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                margin: "0 0 6px 0",
                fontSize: 22,
                lineHeight: 1.1,
                color: "#18181b",
              }}
            >
              New Job
            </h2>

            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "#52525b",
                lineHeight: 1.45,
              }}
            >
              Fill in the essentials below. Worker assignment is required before
              saving.
            </p>
          </div>

          <form onSubmit={addJob}>
            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#444",
                    marginBottom: 8,
                  }}
                >
                  Title *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid #d6d6d6",
                    fontSize: 16,
                    boxSizing: "border-box",
                    background: "#fcfcfc",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#444",
                    marginBottom: 8,
                  }}
                >
                  Address *
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid #d6d6d6",
                    fontSize: 16,
                    boxSizing: "border-box",
                    background: "#fcfcfc",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#444",
                    marginBottom: 8,
                  }}
                >
                  Assigned to *
                </label>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  {workers.map((worker) => {
                    const workerValue = worker.name.trim().toLowerCase();

                    return (
                      <button
                        type="button"
                        key={worker.id}
                        onClick={() => setAssignedTo(workerValue)}
                        style={{
                          minHeight: 42,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border:
                            assignedTo === workerValue
                              ? "2px solid #111"
                              : "1px solid #ddd",
                          background: "#fff",
                          textTransform: "capitalize",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {worker.name}
                      </button>
                    );
                  })}
                </div>

                <input
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="Or type worker name"
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid #d6d6d6",
                    fontSize: 16,
                    boxSizing: "border-box",
                    background: "#fcfcfc",
                    outline: "none",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#444",
                      marginBottom: 8,
                    }}
                  >
                    Visit date (optional)
                  </label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: 12,
                      border: "1px solid #d6d6d6",
                      fontSize: 16,
                      boxSizing: "border-box",
                      background: "#fcfcfc",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#444",
                    marginBottom: 8,
                  }}
                >
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 110,
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid #d6d6d6",
                    fontSize: 16,
                    boxSizing: "border-box",
                    background: "#fcfcfc",
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {errorMsg && (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid #fecaca",
                    background: "#fff1f2",
                    color: "#9f1239",
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: 1.45,
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="submit"
                  disabled={!canSubmit}
                  style={{
                    minHeight: 46,
                    padding: "12px 18px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: canSubmit ? "#111" : "#d4d4d8",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                  }}
                >
                  {loading ? "Adding..." : "Add Job"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid #e7e7e7",
            borderRadius: 18,
            padding: 16,
            boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: "0 0 6px 0",
                  fontSize: 22,
                  lineHeight: 1.1,
                  color: "#18181b",
                }}
              >
                Latest Jobs
              </h2>

              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "#52525b",
                  lineHeight: 1.45,
                }}
              >
                A quick view of the most recent jobs currently in the system.
              </p>
            </div>

            {!initialLoading && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#666",
                }}
              >
                {jobs.length} total
              </div>
            )}
          </div>

          {initialLoading ? (
            <div
              style={{
                borderRadius: 14,
                border: "1px solid #ececec",
                background: "#fafafa",
                padding: 16,
                color: "#52525b",
                fontWeight: 700,
              }}
            >
              Loading jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div
              style={{
                borderRadius: 14,
                border: "1px dashed #d4d4d8",
                background: "#fafafa",
                padding: 18,
                color: "#71717a",
              }}
            >
              No jobs found.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              {jobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    background: "#fafafa",
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          lineHeight: 1.2,
                          color: "#111",
                          marginBottom: 4,
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                      >
                        {job.title}
                      </div>

                      <div
                        style={{
                          fontSize: 14,
                          color: "#52525b",
                          lineHeight: 1.45,
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                      >
                        {job.address}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 800,
                        ...getStatusPillStyle(job.status),
                      }}
                    >
                      {formatStatus(job.status)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#777",
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: 0.3,
                        }}
                      >
                        Visit
                      </div>
                      <div style={{ fontSize: 14, color: "#222" }}>
                        {job.visitDate
                          ? toGBDate(new Date(job.visitDate))
                          : "Unscheduled"}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#777",
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: 0.3,
                        }}
                      >
                        Assigned
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "#222",
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                      >
                        {job.assignedTo ?? "None"}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#777",
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: 0.3,
                        }}
                      >
                        Created
                      </div>
                      <div style={{ fontSize: 14, color: "#222" }}>
                        {toGBDate(new Date(job.createdAt))}
                      </div>
                    </div>
                  </div>

                  {job.notes && (
                    <div
                      style={{
                        marginTop: 12,
                        background: "#fffdf4",
                        border: "1px solid #f3e6a8",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#7a6700",
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: 0.3,
                        }}
                      >
                        Notes
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "#3f3a22",
                          whiteSpace: "pre-line",
                        }}
                      >
                        {job.notes}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}