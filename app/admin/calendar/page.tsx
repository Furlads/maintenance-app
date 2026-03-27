"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MonthEntry = {
  id: string;
  type: "job" | "timeOff";
  workerId: number;
  workerName: string;
  title: string;
  subtitle: string | null;
  startTime: string | null;
  isFullDay: boolean;
  status: string;
};

type MonthDay = {
  date: string;
  entries: MonthEntry[];
};

type ScheduleMonthResponse = {
  month: string;
  days: MonthDay[];
};

type WorkerColour = {
  bg: string;
  text: string;
  border: string;
};

const MOBILE_BREAKPOINT = 900;

const WORKER_COLOURS: WorkerColour[] = [
  { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  { bg: "#ffedd5", text: "#9a3412", border: "#fdba74" },
  { bg: "#ede9fe", text: "#6d28d9", border: "#c4b5fd" },
  { bg: "#cffafe", text: "#155e75", border: "#67e8f9" },
  { bg: "#ffe4e6", text: "#be123c", border: "#fda4af" },
  { bg: "#e2e8f0", text: "#334155", border: "#cbd5e1" },
];

function getTodayDateString() {
  const today = new Date();
  return toMonthDayString(today);
}

function getTodayMonthString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthString(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1, 1, 12, 0, 0, 0);
}

function toMonthString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthDayString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatMonthHeading(month: string) {
  const date = parseMonthString(month);

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDayNumber(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.getDate();
}

function formatDayNameShort(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
  }).format(date);
}

function addMonths(month: string, amount: number) {
  const date = parseMonthString(month);
  date.setMonth(date.getMonth() + amount);
  return toMonthString(date);
}

function buildMonthGrid(month: string, days: MonthDay[]) {
  const firstOfMonth = parseMonthString(month);
  const year = firstOfMonth.getFullYear();
  const monthIndex = firstOfMonth.getMonth();

  const firstGridDate = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  const startWeekday = (firstGridDate.getDay() + 6) % 7;
  firstGridDate.setDate(firstGridDate.getDate() - startWeekday);

  const grid: Array<
    | {
        kind: "empty";
        date: string;
      }
    | {
        kind: "day";
        day: MonthDay;
        inCurrentMonth: boolean;
      }
  > = [];

  const daysMap = new Map(days.map((day) => [day.date, day]));
  const currentMonth = month;

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(firstGridDate);
    date.setDate(firstGridDate.getDate() + i);

    const dateString = toMonthDayString(date);
    const cellMonth = toMonthString(date);
    const existingDay = daysMap.get(dateString);

    if (existingDay) {
      grid.push({
        kind: "day",
        day: existingDay,
        inCurrentMonth: cellMonth === currentMonth,
      });
    } else {
      grid.push({
        kind: "empty",
        date: dateString,
      });
    }
  }

  return grid;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    function update() {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobile;
}

function hashString(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getWorkerColour(workerName: string): WorkerColour {
  const index = hashString(workerName) % WORKER_COLOURS.length;
  return WORKER_COLOURS[index];
}

function getEntryStyle(entry: MonthEntry): WorkerColour {
  if (entry.type === "timeOff") {
    if (entry.status === "pending") {
      return {
        bg: "#fef3c7",
        text: "#92400e",
        border: "#fcd34d",
      };
    }

    if (entry.status === "declined") {
      return {
        bg: "#f4f4f5",
        text: "#52525b",
        border: "#d4d4d8",
      };
    }

    return {
      bg: "#fee2e2",
      text: "#991b1b",
      border: "#fca5a5",
    };
  }

  return getWorkerColour(entry.workerName);
}

function getVisibleCount(isMobile: boolean) {
  return isMobile ? 3 : 5;
}

function formatEntryTime(entry: MonthEntry) {
  if (entry.type === "timeOff" && entry.isFullDay) return "All day";
  if (!entry.startTime) return "";
  return entry.startTime;
}

function buildEntryText(entry: MonthEntry) {
  if (entry.type === "timeOff") {
    return `${entry.workerName} • ${entry.title}`;
  }

  return `${entry.workerName} • ${entry.title}`;
}

function DayCell({
  day,
  isMobile,
  isToday,
  inCurrentMonth,
}: {
  day: MonthDay;
  isMobile: boolean;
  isToday: boolean;
  inCurrentMonth: boolean;
}) {
  const visibleCount = getVisibleCount(isMobile);
  const visibleEntries = day.entries.slice(0, visibleCount);
  const hiddenCount = Math.max(0, day.entries.length - visibleEntries.length);

  return (
    <Link
      href={`/admin/schedule?date=${day.date}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div
        style={{
          border: isToday ? "2px solid #facc15" : "1px solid #e5e7eb",
          borderRadius: isMobile ? 16 : 18,
          background: inCurrentMonth ? "#fff" : "#fafafa",
          padding: isMobile ? 12 : 14,
          minHeight: isMobile ? 150 : 180,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          opacity: inCurrentMonth ? 1 : 0.6,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#71717a",
                marginBottom: 4,
              }}
            >
              {formatDayNameShort(day.date)}
            </div>

            <div
              style={{
                fontSize: isMobile ? 22 : 24,
                fontWeight: 900,
                lineHeight: 1,
                color: "#18181b",
              }}
            >
              {formatDayNumber(day.date)}
            </div>
          </div>

          <div
            style={{
              borderRadius: 999,
              padding: "6px 9px",
              fontSize: 11,
              fontWeight: 800,
              background: day.entries.length > 0 ? "#18181b" : "#f4f4f5",
              color: day.entries.length > 0 ? "#fff" : "#52525b",
              border: day.entries.length > 0 ? "1px solid #18181b" : "1px solid #e4e4e7",
              whiteSpace: "nowrap",
            }}
          >
            {day.entries.length} item{day.entries.length === 1 ? "" : "s"}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {visibleEntries.length === 0 ? (
            <div
              style={{
                borderRadius: 12,
                border: "1px dashed #d4d4d8",
                background: "#fafafa",
                padding: "10px 12px",
                fontSize: 12,
                color: "#71717a",
              }}
            >
              Free day
            </div>
          ) : (
            visibleEntries.map((entry) => {
              const colour = getEntryStyle(entry);

              return (
                <div
                  key={entry.id}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${colour.border}`,
                    background: colour.bg,
                    padding: "9px 10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: colour.text,
                      lineHeight: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {buildEntryText(entry)}
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: colour.text,
                      opacity: 0.85,
                      lineHeight: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatEntryTime(entry)}
                    {entry.subtitle ? ` • ${entry.subtitle}` : ""}
                  </div>
                </div>
              );
            })
          )}

          {hiddenCount > 0 && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#52525b",
                padding: "2px 2px 0 2px",
              }}
            >
              +{hiddenCount} more
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function MobileAgendaDay({
  day,
  isToday,
}: {
  day: MonthDay;
  isToday: boolean;
}) {
  return (
    <div
      style={{
        border: isToday ? "2px solid #facc15" : "1px solid #e5e7eb",
        borderRadius: 18,
        background: "#fff",
        padding: 14,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#71717a",
              marginBottom: 4,
            }}
          >
            {formatDayNameShort(day.date)}
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#18181b",
              lineHeight: 1,
            }}
          >
            {formatDayNumber(day.date)}
          </div>
        </div>

        <Link
          href={`/admin/schedule?date=${day.date}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            borderRadius: 10,
            border: "1px solid #18181b",
            background: "#18181b",
            color: "#fff",
            padding: "10px 12px",
            fontSize: 13,
            fontWeight: 800,
            minHeight: 42,
          }}
        >
          Open day
        </Link>
      </div>

      {day.entries.length === 0 ? (
        <div
          style={{
            borderRadius: 12,
            border: "1px dashed #d4d4d8",
            background: "#fafafa",
            padding: 12,
            fontSize: 13,
            color: "#71717a",
          }}
        >
          Free day
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {day.entries.map((entry) => {
            const colour = getEntryStyle(entry);

            return (
              <div
                key={entry.id}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${colour.border}`,
                  background: colour.bg,
                  padding: 11,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: colour.text,
                    lineHeight: 1.3,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {buildEntryText(entry)}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: colour.text,
                    opacity: 0.9,
                    lineHeight: 1.3,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {formatEntryTime(entry)}
                  {entry.subtitle ? ` • ${entry.subtitle}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminCalendarPage() {
  const [month, setMonth] = useState(getTodayMonthString());
  const [data, setData] = useState<ScheduleMonthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isMobile = useIsMobile();
  const todayString = getTodayDateString();

  async function loadMonth(selectedMonth: string, manual = false) {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const res = await fetch(`/api/schedule/month?month=${selectedMonth}`, {
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load month calendar");
      }

      setData(json);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load month calendar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadMonth(month);
  }, [month]);

  const monthDays = useMemo(() => data?.days ?? [], [data]);
  const monthGrid = useMemo(() => buildMonthGrid(month, monthDays), [month, monthDays]);
  const mobileAgendaDays = useMemo(
    () => monthDays.filter((day) => day.entries.length > 0 || day.date.startsWith(month)),
    [month, monthDays]
  );

  if (isMobile === null) {
    return (
      <main style={{ minHeight: "100vh", background: "#f5f5f5" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: 16 }}>
          <div style={messageCard()}>
            <div style={{ fontWeight: 700 }}>Loading calendar...</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f5f5f5", overflowX: "hidden" }}>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: isMobile ? 10 : 24,
        }}
      >
        <section
          style={{
            overflow: "hidden",
            borderRadius: isMobile ? 16 : 24,
            border: "1px solid #e5e7eb",
            background: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              background: "#18181b",
              color: "#fff",
              padding: isMobile ? 12 : 24,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: isMobile ? "stretch" : "end",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#facc15",
                    marginBottom: 6,
                  }}
                >
                  Furlads Calendar
                </div>

                <h1
                  style={{
                    fontSize: isMobile ? 24 : 34,
                    lineHeight: 1.08,
                    margin: 0,
                    marginBottom: 8,
                  }}
                >
                  {isMobile ? "Month calendar" : "Kelly month calendar"}
                </h1>

                <p
                  style={{
                    margin: 0,
                    maxWidth: 760,
                    color: "#d4d4d8",
                    fontSize: isMobile ? 13 : 15,
                    lineHeight: 1.4,
                  }}
                >
                  Mobile-first month view for quickly seeing who is doing what and when. Tap any
                  day to open the detailed schedule board.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, auto)",
                  gap: 8,
                  width: isMobile ? "100%" : "auto",
                }}
              >
                <Link
                  href="/admin"
                  style={{ ...headerSecondaryButton(), width: isMobile ? "100%" : "auto" }}
                >
                  Back to Dashboard
                </Link>

                <Link
                  href="/admin/schedule"
                  style={{ ...headerSecondaryButton(), width: isMobile ? "100%" : "auto" }}
                >
                  Open day board
                </Link>

                <button
                  type="button"
                  onClick={() => setMonth(getTodayMonthString())}
                  style={{ ...headerPrimaryButton(), width: isMobile ? "100%" : "auto" }}
                >
                  This month
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              background: "#fafafa",
              padding: isMobile ? 10 : 16,
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : "auto auto 1fr auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => setMonth((current) => addMonths(current, -1))}
                style={{ ...toolbarButton(), width: "100%" }}
              >
                ← Prev
              </button>

              <button
                type="button"
                onClick={() => setMonth((current) => addMonths(current, 1))}
                style={{ ...toolbarButton(), width: "100%" }}
              >
                Next →
              </button>

              <div
                style={{
                  fontSize: isMobile ? 18 : 24,
                  fontWeight: 900,
                  color: "#18181b",
                  gridColumn: isMobile ? "1 / -1" : "auto",
                }}
              >
                {formatMonthHeading(month)}
              </div>

              <button
                type="button"
                onClick={() => loadMonth(month, true)}
                disabled={refreshing}
                style={{
                  ...toolbarButton(),
                  width: isMobile ? "100%" : "auto",
                  gridColumn: isMobile ? "1 / -1" : "auto",
                  opacity: refreshing ? 0.7 : 1,
                  cursor: refreshing ? "default" : "pointer",
                }}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {["Stephen", "Jacob", "Trevor", "Will", "Kelly"].map((name) => {
                const colour = getWorkerColour(name);

                return (
                  <div
                    key={name}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 999,
                      padding: "7px 10px",
                      border: `1px solid ${colour.border}`,
                      background: colour.bg,
                      color: colour.text,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {name}
                  </div>
                );
              })}

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  padding: "7px 10px",
                  border: "1px solid #fca5a5",
                  background: "#fee2e2",
                  color: "#991b1b",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                Time off
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <div style={messageCard()}>
            <div style={{ fontWeight: 700 }}>Loading calendar...</div>
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              ...messageCard(),
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#9f1239",
            }}
          >
            <div style={{ fontWeight: 700 }}>Something went wrong</div>
            <div style={{ marginTop: 6 }}>{error}</div>
          </div>
        )}

        {!loading && !error && (
          <>
            {isMobile ? (
              <section style={{ display: "grid", gap: 12 }}>
                {mobileAgendaDays.map((day) => (
                  <MobileAgendaDay
                    key={day.date}
                    day={day}
                    isToday={day.date === todayString}
                  />
                ))}
              </section>
            ) : (
              <section>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
                    <div
                      key={dayName}
                      style={{
                        padding: "6px 8px",
                        fontSize: 12,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#71717a",
                      }}
                    >
                      {dayName}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {monthGrid.map((cell, index) => {
                    if (cell.kind === "empty") {
                      return (
                        <div
                          key={`${cell.date}-${index}`}
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 18,
                            background: "#fafafa",
                            minHeight: 180,
                            opacity: 0.6,
                          }}
                        />
                      );
                    }

                    return (
                      <DayCell
                        key={cell.day.date}
                        day={cell.day}
                        isMobile={false}
                        isToday={cell.day.date === todayString}
                        inCurrentMonth={cell.inCurrentMonth}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function headerSecondaryButton(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    border: "1px solid #3f3f46",
    background: "#27272a",
    color: "#fff",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
    padding: "12px 14px",
    minHeight: 46,
  };
}

function headerPrimaryButton(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    border: "1px solid #facc15",
    background: "#facc15",
    color: "#18181b",
    fontSize: 14,
    fontWeight: 800,
    padding: "12px 14px",
    minHeight: 46,
  };
}

function toolbarButton(): React.CSSProperties {
  return {
    padding: "10px 12px",
    fontSize: 14,
    border: "1px solid #d4d4d8",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    minHeight: 44,
  };
}

function messageCard(): React.CSSProperties {
  return {
    padding: 18,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    marginBottom: 20,
  };
}