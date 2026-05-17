"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import WorkerMenu from "@/app/components/WorkerMenu";

type AuthMeResponse = {
  authenticated?: boolean;
  name?: string | null;
  role?: string | null;
  workerId?: number | null;
};

type Worker = {
  id: number;
  firstName: string;
  lastName: string;
};

type JobAssignment = {
  id: number;
  workerId: number;
  worker: Worker;
};

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email?: string | null;
  address: string | null;
  postcode: string | null;
};

type Job = {
  id: number;
  title: string;
  address: string;
  notes: string | null;
  status: string;
  jobType: string;
  createdAt: string;
  customer: Customer;
  assignments: JobAssignment[];
  visitDate?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
};

type JobsResponse = {
  items?: Job[];
};

type WeatherResponse = {
  ok?: boolean;
  postcode?: string;
  locationName?: string | null;
  summary?: string;
};

const DEFAULT_WEATHER_POSTCODE = "TF9 4BQ";

function getTodayDateKey() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(now);
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function formatShortDate() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatMinutes(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "0m";

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;

  return `${mins}m`;
}

function cleanTime(value?: string | null) {
  if (!value) return "Time not set";
  return value;
}

function normaliseStatus(status: string) {
  return status.trim().toLowerCase();
}

function isFinishedJob(job: Job) {
  const status = normaliseStatus(job.status);

  return (
    status === "done" ||
    status === "complete" ||
    status === "completed" ||
    status === "cancelled" ||
    status === "archived"
  );
}

function getJobPostcode(job: Job) {
  return job.customer?.postcode || "";
}

function getJobAddress(job: Job) {
  return job.address || job.customer?.address || "";
}

function buildMapsUrl(job: Job) {
  const postcode = getJobPostcode(job);
  const address = getJobAddress(job);
  const destination = postcode || address;

  if (!destination) return "/today";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    destination
  )}`;
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "W";

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0].slice(0, 1)}${parts[
    parts.length - 1
  ].slice(0, 1)}`.toUpperCase();
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f4f4f0",
  color: "#111",
};

const shellStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  margin: "0 auto",
  padding: "12px 14px 104px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
};

const headerIdentityStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

const avatarStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  background: "#111",
  color: "#ffd800",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 900,
  flex: "0 0 auto",
  boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.05,
  letterSpacing: -0.8,
};

const mutedStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#666",
  fontSize: 15,
  lineHeight: 1.4,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e1e1dc",
  borderRadius: 18,
  boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "22px 0 10px",
  fontSize: 18,
  lineHeight: 1.2,
};

const smallLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 900,
  color: "#777",
  textTransform: "uppercase",
  letterSpacing: 0.7,
};

const bigNumberStyle: React.CSSProperties = {
  margin: "5px 0 0",
  fontSize: 24,
  fontWeight: 900,
  color: "#111",
};

const buttonBaseStyle: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "#111",
};

const bottomNavStyle: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 50,
  background: "rgba(255,255,255,0.96)",
  borderTop: "1px solid #ddd",
  boxShadow: "0 -8px 22px rgba(0,0,0,0.08)",
};

export default function WorkerHomePage() {
  const [workerName, setWorkerName] = useState("Worker");
  const [workerId, setWorkerId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weatherSummary, setWeatherSummary] = useState("Loading weather...");

  const todayDateKey = useMemo(() => getTodayDateKey(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeData() {
      setLoading(true);
      setError("");

      try {
        const authRes = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        });

        const authData: AuthMeResponse | null = await authRes
          .json()
          .catch(() => null);

        if (!authRes.ok || !authData?.authenticated) {
          window.location.href = "/";
          return;
        }

        if (cancelled) return;

        const resolvedWorkerName = authData.name || "Worker";
        const resolvedWorkerId = authData.workerId || null;

        setWorkerName(resolvedWorkerName);
        setWorkerId(resolvedWorkerId);

        if (!resolvedWorkerId) {
          setJobs([]);
          return;
        }

        const jobsRes = await fetch(
          `/api/jobs?workerId=${resolvedWorkerId}&date=${todayDateKey}&pageSize=50`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        const jobsData: JobsResponse | null = await jobsRes
          .json()
          .catch(() => null);

        if (!jobsRes.ok) {
          throw new Error("Could not load today's jobs");
        }

        if (cancelled) return;

        setJobs(Array.isArray(jobsData?.items) ? jobsData.items : []);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Could not load worker home");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadHomeData();

    return () => {
      cancelled = true;
    };
  }, [todayDateKey]);

  const activeJobs = useMemo(() => jobs.filter((job) => !isFinishedJob(job)), [
    jobs,
  ]);

  const nextJob = useMemo(() => {
    if (activeJobs.length === 0) return null;

    return [...activeJobs].sort((a, b) => {
      const aTime = a.startTime || "99:99";
      const bTime = b.startTime || "99:99";
      return aTime.localeCompare(bTime);
    })[0];
  }, [activeJobs]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      const postcode = nextJob ? getJobPostcode(nextJob) : DEFAULT_WEATHER_POSTCODE;

      setWeatherSummary("Loading weather...");

      try {
        const res = await fetch(
          `/api/weather/postcode?postcode=${encodeURIComponent(postcode)}`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        const data: WeatherResponse | null = await res.json().catch(() => null);

        if (cancelled) return;

        setWeatherSummary(
          data?.summary ||
            "Weather unavailable — check conditions before setting off."
        );
      } catch {
        if (!cancelled) {
          setWeatherSummary(
            "Weather unavailable — check conditions before setting off."
          );
        }
      }
    }

    void loadWeather();

    return () => {
      cancelled = true;
    };
  }, [nextJob]);

  const totalPlannedMinutes = useMemo(() => {
    return activeJobs.reduce((total, job) => {
      return total + (job.durationMinutes || 0);
    }, 0);
  }, [activeJobs]);

  const quickActions = [
    {
      icon: "📍",
      title: "Today’s Jobs",
      text: "Job list, timings, notes and actions.",
      href: "/today",
    },
    {
      icon: "🧭",
      title: "Start Travel",
      text: nextJob ? "Open directions for your next job." : "No next job yet.",
      href: nextJob ? buildMapsUrl(nextJob) : "/today",
      external: !!nextJob,
    },
    {
      icon: "✅",
      title: "Start / Finish Work",
      text: "Start, pause, resume or complete jobs.",
      href: "/today",
    },
    {
      icon: "📸",
      title: "Upload Photos",
      text: "Add before and after job photos.",
      href: "/today",
    },
    {
      icon: "💬",
      title: "Ask CHAS",
      text: "Get quick job, plant and safety help.",
      href: "/today#chas",
    },
    {
      icon: "👤",
      title: "My Time Off",
      text: "Request holiday or time away.",
      href: "/worker/time-off",
    },
  ];

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <header style={headerStyle}>
          <div style={headerIdentityStyle}>
            <div style={avatarStyle}>{getInitials(workerName)}</div>

            <div>
              <h1 style={titleStyle}>
                {getGreeting()}, {getFirstName(workerName)} 👋
              </h1>

              <p style={mutedStyle}>
                {formatShortDate()} — here’s your work dashboard.
              </p>
            </div>
          </div>

          <WorkerMenu />
        </header>

        <div
          style={{
            ...cardStyle,
            padding: "10px 12px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#fffdf0",
          }}
        >
          <span style={{ fontSize: 21, lineHeight: 1 }}>🌦️</span>

          <p
            style={{
              margin: 0,
              color: "#555",
              fontSize: 14,
              lineHeight: 1.35,
            }}
          >
            {weatherSummary}
          </p>
        </div>

        {error && (
          <div
            style={{
              ...cardStyle,
              padding: 14,
              marginBottom: 14,
              borderColor: "#f0b5b5",
              background: "#fff5f5",
            }}
          >
            <strong>Something went wrong</strong>
            <p style={{ margin: "6px 0 0", color: "#7a1f1f" }}>{error}</p>
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ ...cardStyle, padding: 14 }}>
            <p style={smallLabelStyle}>Jobs Today</p>
            <p style={bigNumberStyle}>{loading ? "…" : activeJobs.length}</p>
          </div>

          <div style={{ ...cardStyle, padding: 14 }}>
            <p style={smallLabelStyle}>Next Start</p>
            <p style={bigNumberStyle}>
              {loading ? "…" : cleanTime(nextJob?.startTime)}
            </p>
          </div>

          <div style={{ ...cardStyle, padding: 14 }}>
            <p style={smallLabelStyle}>Planned</p>
            <p style={bigNumberStyle}>
              {loading ? "…" : formatMinutes(totalPlannedMinutes)}
            </p>
          </div>
        </section>

        <section style={{ ...cardStyle, padding: 16 }}>
          <p style={smallLabelStyle}>Next Job</p>

          {loading ? (
            <p style={mutedStyle}>Loading your next job…</p>
          ) : nextJob ? (
            <>
              <h2
                style={{
                  margin: "8px 0 6px",
                  fontSize: 24,
                  lineHeight: 1.15,
                }}
              >
                {nextJob.customer?.name || nextJob.title}
              </h2>

              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#111",
                }}
              >
                {cleanTime(nextJob.startTime)} · {nextJob.title}
              </p>

              <p style={mutedStyle}>
                {getJobPostcode(nextJob) ||
                  getJobAddress(nextJob) ||
                  "Address not set"}
              </p>

              {nextJob.notes && (
                <p
                  style={{
                    margin: "12px 0 0",
                    padding: 12,
                    borderRadius: 12,
                    background: "#fff9d7",
                    border: "1px solid #f0df8a",
                    lineHeight: 1.45,
                  }}
                >
                  {nextJob.notes}
                </p>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <Link
                  href="/today"
                  style={{
                    ...buttonBaseStyle,
                    padding: "13px 14px",
                    borderRadius: 12,
                    background: "#111",
                    color: "#fff",
                    textAlign: "center",
                    fontWeight: 900,
                  }}
                >
                  Open Job
                </Link>

                <a
                  href={buildMapsUrl(nextJob)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    ...buttonBaseStyle,
                    padding: "13px 14px",
                    borderRadius: 12,
                    background: "#ffd800",
                    color: "#111",
                    textAlign: "center",
                    fontWeight: 900,
                  }}
                >
                  Navigate
                </a>
              </div>
            </>
          ) : (
            <>
              <h2
                style={{
                  margin: "8px 0 6px",
                  fontSize: 24,
                  lineHeight: 1.15,
                }}
              >
                No jobs showing for today
              </h2>
              <p style={mutedStyle}>
                If you expected work here, check Today or ask Kelly/Trev to
                confirm your schedule.
              </p>
            </>
          )}
        </section>

        <h2 style={sectionTitleStyle}>Quick Actions</h2>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {quickActions.map((action) => {
            const content = (
              <div
                style={{
                  ...cardStyle,
                  padding: 14,
                  minHeight: 142,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    lineHeight: 1,
                    marginBottom: 12,
                  }}
                >
                  {action.icon}
                </div>

                <div>
                  <h3
                    style={{
                      margin: "0 0 6px",
                      fontSize: 17,
                      lineHeight: 1.2,
                    }}
                  >
                    {action.title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: "#666",
                      fontSize: 13,
                      lineHeight: 1.35,
                    }}
                  >
                    {action.text}
                  </p>
                </div>
              </div>
            );

            if (action.external) {
              return (
                <a
                  key={action.title}
                  href={action.href}
                  target="_blank"
                  rel="noreferrer"
                  style={buttonBaseStyle}
                >
                  {content}
                </a>
              );
            }

            return (
              <Link key={action.title} href={action.href} style={buttonBaseStyle}>
                {content}
              </Link>
            );
          })}
        </section>

        <h2 style={sectionTitleStyle}>Today Timeline</h2>

        <section style={{ ...cardStyle, overflow: "hidden" }}>
          {loading ? (
            <p style={{ ...mutedStyle, padding: 16 }}>Loading timeline…</p>
          ) : activeJobs.length > 0 ? (
            activeJobs
              .slice()
              .sort((a, b) => {
                const aTime = a.startTime || "99:99";
                const bTime = b.startTime || "99:99";
                return aTime.localeCompare(bTime);
              })
              .map((job, index) => (
                <Link
                  key={job.id}
                  href="/today"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "72px 1fr",
                    gap: 10,
                    padding: 14,
                    textDecoration: "none",
                    color: "#111",
                    borderTop: index === 0 ? "none" : "1px solid #eeeeea",
                  }}
                >
                  <strong>{cleanTime(job.startTime)}</strong>

                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {job.customer?.name || job.title}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        color: "#666",
                        fontSize: 13,
                        lineHeight: 1.35,
                      }}
                    >
                      {job.title}
                      {getJobPostcode(job)
                        ? ` · ${getJobPostcode(job)}`
                        : ""}
                    </div>
                  </div>
                </Link>
              ))
          ) : (
            <p style={{ ...mutedStyle, padding: 16 }}>
              No active jobs scheduled for today.
            </p>
          )}
        </section>

        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 16,
            background: "#111",
            color: "#fff",
            lineHeight: 1.45,
          }}
        >
          <strong>Worker reminder</strong>
          <p style={{ margin: "6px 0 0", color: "#f2f2f2" }}>
            If something looks wrong, weather changes, access is blocked, or a
            job needs longer, update Trev or Kelly before guessing.
          </p>
        </div>

        {!workerId && !loading && (
          <p style={{ ...mutedStyle, marginTop: 14 }}>
            Worker ID was not found on your session, so today’s jobs could not
            be filtered.
          </p>
        )}
      </div>

      <nav style={bottomNavStyle} aria-label="Worker quick navigation">
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 4,
            padding: "8px 10px calc(8px + env(safe-area-inset-bottom))",
          }}
        >
          <Link
            href="/worker/home"
            style={{
              ...buttonBaseStyle,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <div style={{ fontSize: 20 }}>🏠</div>
            Home
          </Link>

          <Link
            href="/today"
            style={{
              ...buttonBaseStyle,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <div style={{ fontSize: 20 }}>📅</div>
            Today
          </Link>

          <Link
            href="/today#chas"
            style={{
              ...buttonBaseStyle,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <div style={{ fontSize: 20 }}>💬</div>
            CHAS
          </Link>

          <Link
            href="/worker/time-off"
            style={{
              ...buttonBaseStyle,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <div style={{ fontSize: 20 }}>👤</div>
            Me
          </Link>
        </div>
      </nav>
    </main>
  );
}