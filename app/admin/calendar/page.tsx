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
  startDate?: string;
  endDate?: string;
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

type GroupedDayEntry = {
  workerName: string;
  count: number;
  hasTimeOff: boolean;
  hasPendingTimeOff: boolean;
};

type ViewMode = "month" | "week" | "day";

type MultiDayBar = {
  key: string;
  title: string;
  workerName: string;
  type: "job" | "timeOff";
  startDate: string;
  endDate: string;
};

type MultiDayBarForDate = {
  key: string;
  title: string;
  workerName: string;
  type: "job" | "timeOff";
  isStart: boolean;
  isEnd: boolean;
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

function getTodayDate() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
}

function getTodayDateString() {
  return toMonthDayString(getTodayDate());
}

function getTodayMonthString() {
  return toMonthString(getTodayDate());
}

function parseMonthString(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1, 1, 12, 0, 0, 0);
}

function parseDateString(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
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

function formatDateHeading(dateString: string) {
  const date = parseDateString(dateString);

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDateHeading(dateString: string) {
  const date = parseDateString(dateString);

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatWeekHeading(startDateString: string, endDateString: string) {
  const start = parseDateString(startDateString);
  const end = parseDateString(endDateString);

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    return `${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
    }).format(start)}–${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(end)}`;
  }

  return `${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(start)} – ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(end)}`;
}

function formatDayNumber(dateString: string) {
  const date = parseDateString(dateString);
  return date.getDate();
}

function formatDayNameShort(dateString: string) {
  const date = parseDateString(dateString);

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
  }).format(date);
}

function formatDayNameLong(dateString: string) {
  const date = parseDateString(dateString);

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
  }).format(date);
}

function addMonths(month: string, amount: number) {
  const date = parseMonthString(month);
  date.setMonth(date.getMonth() + amount);
  return toMonthString(date);
}

function addDays(dateString: string, amount: number) {
  const date = parseDateString(dateString);
  date.setDate(date.getDate() + amount);
  return toMonthDayString(date);
}

function startOfWeek(dateString: string) {
  const date = parseDateString(dateString);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return toMonthDayString(date);
}

function endOfWeek(dateString: string) {
  return addDays(startOfWeek(dateString), 6);
}

function eachDateInRange(startDateString: string, endDateString: string) {
  const result: string[] = [];
  let current = parseDateString(startDateString);
  const end = parseDateString(endDateString);

  while (current <= end) {
    result.push(toMonthDayString(current));
    current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 12, 0, 0, 0);
  }

  return result;
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

function normaliseFilterValue(value: string) {
  return value.trim().toLowerCase();
}

function buildSpanKey(entry: MonthEntry) {
  return [
    entry.type,
    String(entry.workerId),
    normaliseFilterValue(entry.workerName),
    normaliseFilterValue(entry.title),
    normaliseFilterValue(entry.startDate || ""),
    normaliseFilterValue(entry.endDate || ""),
  ].join("::");
}

function groupEntriesByWorker(entries: MonthEntry[], excludedKeys: Set<string> = new Set()): GroupedDayEntry[] {
  const map = new Map<string, GroupedDayEntry>();

  for (const entry of entries) {
    if (entry.startDate && entry.endDate && entry.startDate !== entry.endDate) {
      const spanKey = buildSpanKey(entry);
      if (excludedKeys.has(spanKey)) {
        continue;
      }
    }

    const key = entry.workerName.trim() || "Unknown";

    if (!map.has(key)) {
      map.set(key, {
        workerName: key,
        count: 0,
        hasTimeOff: false,
        hasPendingTimeOff: false,
      });
    }

    const current = map.get(key)!;

    if (entry.type === "timeOff") {
      current.hasTimeOff = true;
      if (entry.status === "pending") {
        current.hasPendingTimeOff = true;
      }
    } else {
      current.count += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.hasTimeOff && !b.hasTimeOff) return -1;
    if (!a.hasTimeOff && b.hasTimeOff) return 1;
    if (a.count !== b.count) return b.count - a.count;
    return a.workerName.localeCompare(b.workerName);
  });
}

function getGroupedEntryStyle(entry: GroupedDayEntry): WorkerColour {
  if (entry.hasPendingTimeOff) {
    return {
      bg: "#fef3c7",
      text: "#92400e",
      border: "#fcd34d",
    };
  }

  if (entry.hasTimeOff) {
    return {
      bg: "#fee2e2",
      text: "#991b1b",
      border: "#fca5a5",
    };
  }

  return getWorkerColour(entry.workerName);
}

function getVisibleCount(isMobile: boolean) {
  return isMobile ? 3 : 4;
}

function buildGroupedLabel(entry: GroupedDayEntry) {
  if (entry.hasPendingTimeOff) {
    return `${entry.workerName} pending`;
  }

  if (entry.hasTimeOff) {
    return `${entry.workerName} off`;
  }

  if (entry.count <= 1) {
    return entry.workerName;
  }

  return `${entry.workerName} • ${entry.count}`;
}

function getDayItemCountText(entries: MonthEntry[]) {
  return `${entries.length} item${entries.length === 1 ? "" : "s"}`;
}

function buildDayMap(days: MonthDay[]) {
  return new Map(days.map((day) => [day.date, day]));
}

function getWeekDays(selectedDate: string, dayMap: Map<string, MonthDay>) {
  const start = startOfWeek(selectedDate);
  const end = endOfWeek(selectedDate);

  return eachDateInRange(start, end).map((date) => {
    return (
      dayMap.get(date) || {
        date,
        entries: [],
      }
    );
  });
}

function getDayData(selectedDate: string, dayMap: Map<string, MonthDay>) {
  return (
    dayMap.get(selectedDate) || {
      date: selectedDate,
      entries: [],
    }
  );
}

function buildMultiDayBars(days: MonthDay[]): MultiDayBar[] {
  const map = new Map<string, MultiDayBar>();

  for (const day of days) {
    for (const entry of day.entries) {
      if (!entry.startDate || !entry.endDate) continue;
      if (entry.startDate === entry.endDate) continue;

      const key = buildSpanKey(entry);

      if (!map.has(key)) {
        map.set(key, {
          key,
          title: entry.title,
          workerName: entry.workerName,
          type: entry.type,
          startDate: entry.startDate,
          endDate: entry.endDate,
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    if (a.workerName !== b.workerName) return a.workerName.localeCompare(b.workerName);
    return a.title.localeCompare(b.title);
  });
}

function buildMultiDayBarsByDate(bars: MultiDayBar[]) {
  const map = new Map<string, MultiDayBarForDate[]>();

  for (const bar of bars) {
    for (const date of eachDateInRange(bar.startDate, bar.endDate)) {
      if (!map.has(date)) {
        map.set(date, []);
      }

      map.get(date)!.push({
        key: bar.key,
        title: bar.title,
        workerName: bar.workerName,
        type: bar.type,
        isStart: date === bar.startDate,
        isEnd: date === bar.endDate,
      });
    }
  }

  for (const [date, dateBars] of map.entries()) {
    map.set(
      date,
      [...dateBars].sort((a, b) => {
        if (a.workerName !== b.workerName) return a.workerName.localeCompare(b.workerName);
        return a.title.localeCompare(b.title);
      })
    );
  }

  return map;
}

function getBarStyle(bar: MultiDayBarForDate): React.CSSProperties {
  if (bar.type === "timeOff") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
      borderRadius: 0,
      borderTopLeftRadius: bar.isStart ? 8 : 0,
      borderBottomLeftRadius: bar.isStart ? 8 : 0,
      borderTopRightRadius: bar.isEnd ? 8 : 0,
      borderBottomRightRadius: bar.isEnd ? 8 : 0,
    };
  }

  const colour = getWorkerColour(bar.workerName);

  return {
    background: colour.bg,
    color: colour.text,
    border: `1px solid ${colour.border}`,
    borderRadius: 0,
    borderTopLeftRadius: bar.isStart ? 8 : 0,
    borderBottomLeftRadius: bar.isStart ? 8 : 0,
    borderTopRightRadius: bar.isEnd ? 8 : 0,
    borderBottomRightRadius: bar.isEnd ? 8 : 0,
  };
}

function DayCell({
  day,
  isMobile,
  isToday,
  inCurrentMonth,
  multiDayBars = [],
}: {
  day: MonthDay;
  isMobile: boolean;
  isToday: boolean;
  inCurrentMonth: boolean;
  multiDayBars?: MultiDayBarForDate[];
}) {
  const excludedKeys = new Set(multiDayBars.map((bar) => bar.key));
  const groupedEntries = groupEntriesByWorker(day.entries, excludedKeys);
  const visibleCount = getVisibleCount(isMobile);
  const visibleEntries = groupedEntries.slice(0, visibleCount);
  const hiddenCount = Math.max(0, groupedEntries.length - visibleEntries.length);

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
          border: isToday ? "2px solid #facc15" : "1px solid #ececec",
          borderRadius: 16,
          background: inCurrentMonth ? "#ffffff" : "#fafafa",
          padding: 10,
          minHeight: isMobile ? 132 : 160,
          opacity: inCurrentMonth ? 1 : 0.58,
          boxShadow: inCurrentMonth ? "0 1px 2px rgba(0,0,0,0.02)" : "none",
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
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#8a8a8a",
                marginBottom: 2,
              }}
            >
              {formatDayNameShort(day.date)}
            </div>

            <div
              style={{
                fontSize: 19,
                fontWeight: 800,
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
              padding: "4px 8px",
              fontSize: 10,
              fontWeight: 700,
              background: day.entries.length > 0 ? "#18181b" : "#f4f4f5",
              color: day.entries.length > 0 ? "#fff" : "#666",
              border: day.entries.length > 0 ? "1px solid #18181b" : "1px solid #e4e4e7",
              whiteSpace: "nowrap",
            }}
          >
            {getDayItemCountText(day.entries)}
          </div>
        </div>

        {multiDayBars.length > 0 && (
          <div style={{ display: "grid", gap: 4, marginBottom: 8 }}>
            {multiDayBars.slice(0, 2).map((bar) => (
              <div
                key={`${day.date}-${bar.key}`}
                style={{
                  ...getBarStyle(bar),
                  padding: "5px 8px",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {bar.isStart ? bar.title : "\u00A0"}
              </div>
            ))}

            {multiDayBars.length > 2 && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#7a7a7a",
                  paddingLeft: 2,
                }}
              >
                +{multiDayBars.length - 2} more bars
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 6 }}>
          {visibleEntries.length === 0 ? (
            <div
              style={{
                borderRadius: 10,
                border: "1px dashed #d7d7d7",
                background: "#fafafa",
                padding: "8px 9px",
                fontSize: 11,
                color: "#8a8a8a",
              }}
            >
              Free day
            </div>
          ) : (
            visibleEntries.map((entry) => {
              const colour = getGroupedEntryStyle(entry);

              return (
                <div
                  key={`${day.date}-${entry.workerName}`}
                  style={{
                    borderRadius: 8,
                    background: colour.bg,
                    color: colour.text,
                    border: `1px solid ${colour.border}`,
                    padding: "5px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {buildGroupedLabel(entry)}
                </div>
              );
            })
          )}

          {hiddenCount > 0 && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#7a7a7a",
                paddingLeft: 2,
                paddingTop: 1,
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

function WeekDayColumn({
  day,
  isToday,
  multiDayBars = [],
}: {
  day: MonthDay;
  isToday: boolean;
  multiDayBars?: MultiDayBarForDate[];
}) {
  const excludedKeys = new Set(multiDayBars.map((bar) => bar.key));
  const groupedEntries = groupEntriesByWorker(day.entries, excludedKeys);

  return (
    <div
      style={{
        border: isToday ? "2px solid #facc15" : "1px solid #ececec",
        borderRadius: 16,
        background: "#fff",
        padding: 12,
        minHeight: 240,
        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "start",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#8a8a8a",
              marginBottom: 3,
            }}
          >
            {formatDayNameShort(day.date)}
          </div>

          <div
            style={{
              fontSize: 21,
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
            textDecoration: "none",
            borderRadius: 999,
            padding: "5px 9px",
            fontSize: 10,
            fontWeight: 700,
            background: "#18181b",
            color: "#fff",
            border: "1px solid #18181b",
          }}
        >
          Open
        </Link>
      </div>

      {multiDayBars.length > 0 && (
        <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>
          {multiDayBars.map((bar) => (
            <div
              key={`${day.date}-${bar.key}`}
              style={{
                ...getBarStyle(bar),
                padding: "6px 8px",
                fontSize: 11,
                fontWeight: 800,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {bar.isStart ? bar.title : "\u00A0"}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: 7 }}>
        {groupedEntries.length === 0 ? (
          <div
            style={{
              borderRadius: 10,
              border: "1px dashed #d7d7d7",
              background: "#fafafa",
              padding: 10,
              fontSize: 12,
              color: "#8a8a8a",
            }}
          >
            Free day
          </div>
        ) : (
          groupedEntries.map((entry) => {
            const colour = getGroupedEntryStyle(entry);

            return (
              <div
                key={`${day.date}-${entry.workerName}`}
                style={{
                  borderRadius: 10,
                  background: colour.bg,
                  color: colour.text,
                  border: `1px solid ${colour.border}`,
                  padding: "8px 9px",
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.2,
                }}
              >
                {buildGroupedLabel(entry)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function DayViewCard({
  day,
  isToday,
}: {
  day: MonthDay;
  isToday: boolean;
}) {
  const groupedEntries = groupEntriesByWorker(day.entries);

  return (
    <section
      style={{
        border: isToday ? "2px solid #facc15" : "1px solid #ececec",
        borderRadius: 18,
        background: "#fff",
        padding: 18,
        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#8a8a8a",
              marginBottom: 4,
            }}
          >
            {formatDayNameLong(day.date)}
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 30,
              lineHeight: 1.05,
              fontWeight: 900,
              color: "#18181b",
            }}
          >
            {formatDateHeading(day.date)}
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Link href={`/admin/schedule?date=${day.date}`} style={headerPrimaryButton()}>
            Open advanced schedule board
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gap: 9 }}>
        {groupedEntries.length === 0 ? (
          <div
            style={{
              borderRadius: 10,
              border: "1px dashed #d7d7d7",
              background: "#fafafa",
              padding: 12,
              fontSize: 14,
              color: "#8a8a8a",
            }}
          >
            Free day
          </div>
        ) : (
          groupedEntries.map((entry) => {
            const colour = getGroupedEntryStyle(entry);

            return (
              <div
                key={`${day.date}-${entry.workerName}`}
                style={{
                  borderRadius: 10,
                  background: colour.bg,
                  color: colour.text,
                  border: `1px solid ${colour.border}`,
                  padding: "10px 12px",
                  fontSize: 14,
                  fontWeight: 800,
                  lineHeight: 1.2,
                }}
              >
                {buildGroupedLabel(entry)}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default function AdminCalendarPage() {
  const [month, setMonth] = useState(getTodayMonthString());
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [data, setData] = useState<ScheduleMonthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedWorker, setSelectedWorker] = useState<string>("all");

  const isMobile = useIsMobile();
  const todayString = getTodayDateString();

  useEffect(() => {
    const dateMonth = toMonthString(parseDateString(selectedDate));
    if (dateMonth !== month) {
      setMonth(dateMonth);
    }
  }, [selectedDate, month]);

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
        throw new Error(json?.error || "Failed to load calendar");
      }

      setData(json);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadMonth(month);
  }, [month]);

  const allWorkerNames = useMemo(() => {
    const names = new Set<string>();

    for (const day of data?.days ?? []) {
      for (const entry of day.entries) {
        names.add(entry.workerName);
      }
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredMonthDays = useMemo(() => {
    const filter = normaliseFilterValue(selectedWorker);

    return (data?.days ?? []).map((day) => {
      if (filter === "all") {
        return day;
      }

      return {
        ...day,
        entries: day.entries.filter(
          (entry) => normaliseFilterValue(entry.workerName) === filter
        ),
      };
    });
  }, [data, selectedWorker]);

  const dayMap = useMemo(() => buildDayMap(filteredMonthDays), [filteredMonthDays]);
  const monthGrid = useMemo(() => buildMonthGrid(month, filteredMonthDays), [month, filteredMonthDays]);
  const weekDays = useMemo(() => getWeekDays(selectedDate, dayMap), [selectedDate, dayMap]);
  const selectedDay = useMemo(() => getDayData(selectedDate, dayMap), [selectedDate, dayMap]);

  const multiDayBars = useMemo(() => buildMultiDayBars(filteredMonthDays), [filteredMonthDays]);
  const multiDayBarsByDate = useMemo(() => buildMultiDayBarsByDate(multiDayBars), [multiDayBars]);

  const weekStart = startOfWeek(selectedDate);
  const weekEnd = endOfWeek(selectedDate);

  function goPrev() {
    if (viewMode === "month") {
      const nextMonth = addMonths(month, -1);
      setMonth(nextMonth);
      setSelectedDate(toMonthDayString(parseMonthString(nextMonth)));
      return;
    }

    if (viewMode === "week") {
      setSelectedDate((current) => addDays(current, -7));
      return;
    }

    setSelectedDate((current) => addDays(current, -1));
  }

  function goNext() {
    if (viewMode === "month") {
      const nextMonth = addMonths(month, 1);
      setMonth(nextMonth);
      setSelectedDate(toMonthDayString(parseMonthString(nextMonth)));
      return;
    }

    if (viewMode === "week") {
      setSelectedDate((current) => addDays(current, 7));
      return;
    }

    setSelectedDate((current) => addDays(current, 1));
  }

  function goToday() {
    setSelectedDate(todayString);
    setMonth(getTodayMonthString());
  }

  function currentHeading() {
    if (viewMode === "month") {
      return formatMonthHeading(month);
    }

    if (viewMode === "week") {
      return formatWeekHeading(weekStart, weekEnd);
    }

    return formatDateHeading(selectedDate);
  }

  if (isMobile === null) {
    return (
      <main style={{ minHeight: "100vh", background: "#f6f6f6" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: 16 }}>
          <div style={messageCard()}>
            <div style={{ fontWeight: 700 }}>Loading calendar...</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f6f6f6", overflowX: "hidden" }}>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: isMobile ? 10 : 20,
        }}
      >
        <section
          style={{
            overflow: "hidden",
            borderRadius: isMobile ? 18 : 22,
            border: "1px solid #e8e8e8",
            background: "#fff",
            marginBottom: 12,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <div
            style={{
              background: "#fff",
              color: "#18181b",
              padding: isMobile ? 12 : 18,
              borderBottom: "1px solid #eeeeee",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: isMobile ? "stretch" : "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#8a8a8a",
                    marginBottom: 4,
                  }}
                >
                  Furlads
                </div>

                <h1
                  style={{
                    fontSize: isMobile ? 24 : 30,
                    lineHeight: 1.08,
                    margin: 0,
                    marginBottom: 6,
                    fontWeight: 900,
                  }}
                >
                  {currentHeading()}
                </h1>

                <p
                  style={{
                    margin: 0,
                    maxWidth: 760,
                    color: "#7a7a7a",
                    fontSize: isMobile ? 13 : 14,
                    lineHeight: 1.45,
                  }}
                >
                  Main diary view for Kelly. Use Month for planning, Week for forward booking, Day
                  for detail. Advanced changes still live in the schedule board.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(2, auto)",
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
                  href={`/admin/schedule?date=${selectedDate}`}
                  style={{ ...headerPrimaryButton(), width: isMobile ? "100%" : "auto" }}
                >
                  Advanced scheduler
                </Link>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              padding: isMobile ? 10 : 14,
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : "auto auto auto auto 1fr auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                style={{
                  ...toolbarInput(),
                  width: "100%",
                  gridColumn: isMobile ? "1 / -1" : "auto",
                }}
              >
                <option value="month">Month view</option>
                <option value="week">Week view</option>
                <option value="day">Day view</option>
              </select>

              <button
                type="button"
                onClick={goPrev}
                style={{ ...toolbarButton(), width: "100%" }}
              >
                ← Prev
              </button>

              <button
                type="button"
                onClick={goNext}
                style={{ ...toolbarButton(), width: "100%" }}
              >
                Next →
              </button>

              <button
                type="button"
                onClick={goToday}
                style={{ ...toolbarButton(), width: "100%" }}
              >
                Today
              </button>

              <div
                style={{
                  fontSize: isMobile ? 18 : 22,
                  fontWeight: 900,
                  color: "#18181b",
                  gridColumn: isMobile ? "1 / -1" : "auto",
                }}
              >
                {currentHeading()}
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
              <button
                type="button"
                onClick={() => setSelectedWorker("all")}
                style={{
                  borderRadius: 999,
                  padding: "7px 11px",
                  border:
                    selectedWorker === "all" ? "2px solid #18181b" : "1px solid #dddddd",
                  background: selectedWorker === "all" ? "#18181b" : "#fff",
                  color: selectedWorker === "all" ? "#fff" : "#18181b",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                All workers
              </button>

              {allWorkerNames.map((name) => {
                const colour = getWorkerColour(name);
                const active = normaliseFilterValue(selectedWorker) === normaliseFilterValue(name);

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      setSelectedWorker((current) =>
                        normaliseFilterValue(current) === normaliseFilterValue(name) ? "all" : name
                      )
                    }
                    style={{
                      borderRadius: 999,
                      padding: "7px 11px",
                      border: active ? `2px solid ${colour.text}` : `1px solid ${colour.border}`,
                      background: colour.bg,
                      color: colour.text,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {name}
                  </button>
                );
              })}

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 999,
                  padding: "7px 11px",
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
            {viewMode === "month" && (
              <>
                {isMobile ? (
                  <section style={{ display: "grid", gap: 12 }}>
                    {filteredMonthDays
                      .filter((day) => day.entries.length > 0 || day.date.startsWith(month))
                      .map((day) => (
                        <div key={day.date}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color: "#7a7a7a",
                              marginBottom: 6,
                              paddingLeft: 2,
                            }}
                          >
                            {formatDayNameLong(day.date)} {formatShortDateHeading(day.date)}
                          </div>
                          <DayCell
                            day={day}
                            isMobile={true}
                            isToday={day.date === todayString}
                            inCurrentMonth={true}
                            multiDayBars={multiDayBarsByDate.get(day.date) || []}
                          />
                        </div>
                      ))}
                  </section>
                ) : (
                  <section>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
                        <div
                          key={dayName}
                          style={{
                            padding: "4px 6px",
                            fontSize: 11,
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: "#8a8a8a",
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
                        gap: 8,
                      }}
                    >
                      {monthGrid.map((cell, index) => {
                        if (cell.kind === "empty") {
                          return (
                            <div
                              key={`${cell.date}-${index}`}
                              style={{
                                border: "1px solid #eeeeee",
                                borderRadius: 16,
                                background: "#fafafa",
                                minHeight: 160,
                                opacity: 0.5,
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
                            multiDayBars={multiDayBarsByDate.get(cell.day.date) || []}
                          />
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}

            {viewMode === "week" && (
              <>
                {isMobile ? (
                  <section style={{ display: "grid", gap: 12 }}>
                    {weekDays.map((day) => (
                      <section key={day.date}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#7a7a7a",
                            marginBottom: 6,
                            paddingLeft: 2,
                          }}
                        >
                          {formatDayNameLong(day.date)} {formatShortDateHeading(day.date)}
                        </div>
                        <WeekDayColumn
                          day={day}
                          isToday={day.date === todayString}
                          multiDayBars={multiDayBarsByDate.get(day.date) || []}
                        />
                      </section>
                    ))}
                  </section>
                ) : (
                  <section>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      {weekDays.map((day) => (
                        <WeekDayColumn
                          key={day.date}
                          day={day}
                          isToday={day.date === todayString}
                          multiDayBars={multiDayBarsByDate.get(day.date) || []}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {viewMode === "day" && (
              <DayViewCard day={selectedDay} isToday={selectedDay.date === todayString} />
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
    border: "1px solid #dddddd",
    background: "#fff",
    color: "#18181b",
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
    border: "1px solid #18181b",
    background: "#18181b",
    color: "#fff",
    textDecoration: "none",
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
    border: "1px solid #dddddd",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    minHeight: 44,
    color: "#18181b",
  };
}

function toolbarInput(): React.CSSProperties {
  return {
    padding: "10px 12px",
    fontSize: 14,
    border: "1px solid #dddddd",
    borderRadius: 10,
    background: "#fff",
    fontWeight: 700,
    minHeight: 44,
    color: "#18181b",
  };
}

function messageCard(): React.CSSProperties {
  return {
    padding: 18,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
    marginBottom: 20,
    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
  };
}