"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TimeOffAlert from "@/app/components/kelly/TimeOffAlert";

type ScheduleJob = {
  id: number;
  title: string;
  jobType: string;
  customerName: string;
  postcode: string | null;
  address: string;
  startTime: string | null;
  durationMinutes: number | null;
  status: string;
  needsSchedulingAttention: boolean;
  schedulingAttentionReason: string | null;
  schedulingLastAttemptAt: string | null;
};

type ScheduleAvailabilityBlock = {
  id: number;
  workerId: number;
  title: string;
  startTime: string | null;
  endTime: string | null;
  isFullDay: boolean;
  notes: string | null;
  source: string;
  status: "pending" | "approved" | "declined";
  timeOffRequestId: number | null;
};

type ScheduleWorker = {
  id: number;
  name: string;
  jobs: ScheduleJob[];
  availabilityBlocks: ScheduleAvailabilityBlock[];
};

type ScheduleResponse = {
  date: string;
  workers: ScheduleWorker[];
};

type JobsApiJob = {
  id: number;
  title: string;
  address: string;
  status: string;
  jobType: string;
  startTime: string | null;
  visitDate: string | null;
  durationMinutes: number | null;
  createdAt: string;
  needsSchedulingAttention?: boolean;
  schedulingAttentionReason?: string | null;
  schedulingLastAttemptAt?: string | null;
  customer: {
    name: string | null;
    postcode?: string | null;
  } | null;
  assignments: Array<{
    worker: {
      firstName: string;
      lastName: string;
    };
  }>;
};

type TimelinePlacedJob = ScheduleJob & {
  startMinutes: number;
  endMinutes: number;
  lane: number;
};

const PREP_START_MINUTES = 8 * 60 + 30;
const WORK_START_MINUTES = 9 * 60;
const DAY_END_MINUTES = 16 * 60 + 30;
const TOTAL_DAY_MINUTES = DAY_END_MINUTES - PREP_START_MINUTES;
const TIMELINE_MARKERS = [
  { label: "08:30", minutes: PREP_START_MINUTES },
  { label: "09:00", minutes: WORK_START_MINUTES },
  { label: "10:00", minutes: 10 * 60 },
  { label: "11:00", minutes: 11 * 60 },
  { label: "12:00", minutes: 12 * 60 },
  { label: "13:00", minutes: 13 * 60 },
  { label: "14:00", minutes: 14 * 60 },
  { label: "15:00", minutes: 15 * 60 },
  { label: "16:00", minutes: 16 * 60 },
];

function getTodayDateString() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

function parseTimeToMinutes(time: string | null) {
  if (!time) return null;

  const parts = time.split(":").map(Number);
  if (parts.length !== 2) return null;

  const [hours, minutes] = parts;

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const safe = Math.max(0, minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function formatTimeRange(startTime: string | null, durationMinutes: number | null) {
  const start = parseTimeToMinutes(startTime);
  const duration = durationMinutes ?? 60;

  if (start === null) return "No time set";

  return `${minutesToTime(start)} → ${minutesToTime(start + duration)}`;
}

function formatBlockTimeRange(block: ScheduleAvailabilityBlock) {
  if (block.isFullDay) {
    return "Full day";
  }

  if (block.startTime && block.endTime) {
    return `${block.startTime} → ${block.endTime}`;
  }

  if (block.startTime) {
    return `${block.startTime} onwards`;
  }

  if (block.endTime) {
    return `Until ${block.endTime}`;
  }

  return "Blocked time";
}

function formatStatus(status: string) {
  const clean = String(status || "").trim().toLowerCase();

  if (clean === "in_progress") return "In progress";
  if (clean === "done") return "Done";
  if (clean === "paused") return "Paused";
  if (clean === "unscheduled") return "Unscheduled";
  if (clean === "todo") return "To do";
  if (clean === "quoted") return "Quoted";
  if (clean === "scheduled") return "Scheduled";

  return status || "Unknown";
}

function formatJobType(jobType: string) {
  const value = String(jobType || "").trim();
  return value || "General";
}

function formatRemaining(minutes: number) {
  if (minutes <= 30) return "FULL";

  const safe = Math.max(0, minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;

  if (hours === 0) return `${mins}m free`;
  if (mins === 0) return `${hours}h free`;

  return `${hours}h ${mins}m free`;
}

function formatDate(date: string | null) {
  if (!date) return "Not scheduled";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return "Unknown";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatWorkers(
  assignments: Array<{
    worker: {
      firstName: string;
      lastName: string;
    };
  }>
) {
  if (!assignments || assignments.length === 0) return "Unassigned";

  return assignments
    .map((assignment) =>
      `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim()
    )
    .join(", ");
}

function normaliseDisplayText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string | null | undefined) {
  const clean = normaliseDisplayText(value);
  if (!clean) return "";

  return clean
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getDisplayAddress(job: Pick<ScheduleJob, "customerName" | "title" | "address">) {
  const customer = normaliseDisplayText(job.customerName).toLowerCase();
  const title = normaliseDisplayText(job.title).toLowerCase();
  const address = normaliseDisplayText(job.address);

  if (!address) return "";
  if (address.toLowerCase() === customer) return "";
  if (address.toLowerCase() === title) return "";

  return titleCase(address);
}

function getStatusBadgeStyle(status: string): React.CSSProperties {
  const value = String(status || "").toLowerCase();

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

  if (value === "paused") {
    return {
      background: "#ffedd5",
      color: "#9a3412",
      border: "1px solid #fed7aa",
    };
  }

  if (value === "quoted") {
    return {
      background: "#f3e8ff",
      color: "#7e22ce",
      border: "1px solid #e9d5ff",
    };
  }

  if (value === "unscheduled") {
    return {
      background: "#f4f4f5",
      color: "#3f3f46",
      border: "1px solid #e4e4e7",
    };
  }

  if (value === "scheduled") {
    return {
      background: "#ecfeff",
      color: "#155e75",
      border: "1px solid #a5f3fc",
    };
  }

  return {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
  };
}

function getJobTypeBadgeStyle(jobType: string): React.CSSProperties {
  const value = String(jobType || "").toLowerCase();

  if (value.includes("maint")) {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (value.includes("land")) {
    return {
      background: "#e0f2fe",
      color: "#075985",
      border: "1px solid #bae6fd",
    };
  }

  if (value.includes("quote")) {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    };
  }

  if (value.includes("prep")) {
    return {
      background: "#e5e7eb",
      color: "#374151",
      border: "1px solid #d1d5db",
    };
  }

  return {
    background: "#f4f4f5",
    color: "#3f3f46",
    border: "1px solid #e4e4e7",
  };
}

function getCardColor(job: ScheduleJob): {
  background: string;
  border: string;
} {
  const jobType = String(job.jobType || "").toLowerCase();
  const status = String(job.status || "").toLowerCase();

  if (job.needsSchedulingAttention) {
    return {
      background: "#fff1f2",
      border: "#fda4af",
    };
  }

  if (status === "done") {
    return {
      background: "#dcfce7",
      border: "#86efac",
    };
  }

  if (status === "in_progress") {
    return {
      background: "#dbeafe",
      border: "#93c5fd",
    };
  }

  if (status === "paused") {
    return {
      background: "#ffedd5",
      border: "#fdba74",
    };
  }

  if (jobType.includes("quote")) {
    return {
      background: "#fef3c7",
      border: "#fcd34d",
    };
  }

  if (jobType.includes("maint")) {
    return {
      background: "#dcfce7",
      border: "#86efac",
    };
  }

  if (jobType.includes("land")) {
    return {
      background: "#e0f2fe",
      border: "#7dd3fc",
    };
  }

  if (jobType.includes("prep")) {
    return {
      background: "#f3f4f6",
      border: "#d1d5db",
    };
  }

  return {
    background: "#e8f3ff",
    border: "#8db6ff",
  };
}

function getAvailabilityBlockColor(block: ScheduleAvailabilityBlock): {
  background: string;
  border: string;
  text: string;
} {
  const status = String(block.status || "").toLowerCase();
  const title = String(block.title || "").toLowerCase();

  if (status === "pending") {
    return {
      background: "rgba(250, 204, 21, 0.18)",
      border: "#facc15",
      text: "#92400e",
    };
  }

  if (status === "declined") {
    return {
      background: "rgba(161, 161, 170, 0.14)",
      border: "#a1a1aa",
      text: "#52525b",
    };
  }

  if (title.includes("holiday")) {
    return {
      background: "rgba(239, 68, 68, 0.12)",
      border: "#fca5a5",
      text: "#991b1b",
    };
  }

  if (title.includes("sick")) {
    return {
      background: "rgba(249, 115, 22, 0.12)",
      border: "#fdba74",
      text: "#9a3412",
    };
  }

  if (title.includes("late start") || title.includes("early finish") || title.includes("appointment")) {
    return {
      background: "rgba(168, 85, 247, 0.12)",
      border: "#d8b4fe",
      text: "#7e22ce",
    };
  }

  return {
    background: "rgba(107, 114, 128, 0.12)",
    border: "#d4d4d8",
    text: "#3f3f46",
  };
}

function getBlockStatusBadgeStyle(status: ScheduleAvailabilityBlock["status"]): React.CSSProperties {
  if (status === "pending") {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    };
  }

  if (status === "declined") {
    return {
      background: "#f4f4f5",
      color: "#52525b",
      border: "1px solid #d4d4d8",
    };
  }

  return {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
  };
}

function sortUnscheduledJobs(a: JobsApiJob, b: JobsApiJob) {
  const attentionA = a.needsSchedulingAttention ? 0 : 1;
  const attentionB = b.needsSchedulingAttention ? 0 : 1;

  if (attentionA !== attentionB) {
    return attentionA - attentionB;
  }

  const maintenanceA = String(a.jobType || "").toLowerCase().includes("maint")
    ? 0
    : 1;
  const maintenanceB = String(b.jobType || "").toLowerCase().includes("maint")
    ? 0
    : 1;

  if (maintenanceA !== maintenanceB) {
    return maintenanceA - maintenanceB;
  }

  const assignedA = a.assignments.length > 0 ? 0 : 1;
  const assignedB = b.assignments.length > 0 ? 0 : 1;

  if (assignedA !== assignedB) {
    return assignedA - assignedB;
  }

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function sortWorkerJobs(a: ScheduleJob, b: ScheduleJob) {
  const aStart = parseTimeToMinutes(a.startTime);
  const bStart = parseTimeToMinutes(b.startTime);

  if (aStart === null && bStart === null) return a.id - b.id;
  if (aStart === null) return 1;
  if (bStart === null) return -1;

  if (aStart !== bStart) return aStart - bStart;

  const aDuration = a.durationMinutes ?? 60;
  const bDuration = b.durationMinutes ?? 60;

  if (aDuration !== bDuration) return aDuration - bDuration;

  return a.id - b.id;
}

function sortAvailabilityBlocks(a: ScheduleAvailabilityBlock, b: ScheduleAvailabilityBlock) {
  const aStart = a.isFullDay ? PREP_START_MINUTES : parseTimeToMinutes(a.startTime) ?? PREP_START_MINUTES;
  const bStart = b.isFullDay ? PREP_START_MINUTES : parseTimeToMinutes(b.startTime) ?? PREP_START_MINUTES;

  if (aStart !== bStart) return aStart - bStart;
  return a.id - b.id;
}

function buildTimelineLanes(jobs: ScheduleJob[]) {
  const scheduled = jobs
    .map((job) => {
      const start = parseTimeToMinutes(job.startTime);
      if (start === null) return null;

      const duration = Math.max(job.durationMinutes ?? 60, 15);
      const end = start + duration;

      return {
        ...job,
        startMinutes: start,
        endMinutes: end,
      };
    })
    .filter((job): job is Omit<TimelinePlacedJob, "lane"> => job !== null)
    .sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      return a.endMinutes - b.endMinutes;
    });

  const laneEndTimes: number[] = [];
  const placed: TimelinePlacedJob[] = [];

  for (const job of scheduled) {
    let placedLane = -1;

    for (let laneIndex = 0; laneIndex < laneEndTimes.length; laneIndex++) {
      if (job.startMinutes >= laneEndTimes[laneIndex]) {
        placedLane = laneIndex;
        break;
      }
    }

    if (placedLane === -1) {
      placedLane = laneEndTimes.length;
      laneEndTimes.push(job.endMinutes);
    } else {
      laneEndTimes[placedLane] = job.endMinutes;
    }

    placed.push({
      ...job,
      lane: placedLane,
    });
  }

  return {
    jobs: placed,
    laneCount: Math.max(laneEndTimes.length, 1),
  };
}

function getTimelineLeft(minutes: number) {
  const clamped = Math.max(PREP_START_MINUTES, Math.min(minutes, DAY_END_MINUTES));
  return ((clamped - PREP_START_MINUTES) / TOTAL_DAY_MINUTES) * 100;
}

function getTimelineWidth(startMinutes: number, endMinutes: number) {
  const clampedStart = Math.max(PREP_START_MINUTES, Math.min(startMinutes, DAY_END_MINUTES));
  const clampedEnd = Math.max(PREP_START_MINUTES, Math.min(endMinutes, DAY_END_MINUTES));
  const safeMinutes = Math.max(clampedEnd - clampedStart, 18);
  return (safeMinutes / TOTAL_DAY_MINUTES) * 100;
}

function isOffHours(job: ScheduleJob) {
  const start = parseTimeToMinutes(job.startTime);
  if (start === null) return false;

  const end = start + (job.durationMinutes ?? 60);
  return start < WORK_START_MINUTES || end > DAY_END_MINUTES;
}

function getBlockStartMinutes(block: ScheduleAvailabilityBlock) {
  if (block.isFullDay) return PREP_START_MINUTES;
  return parseTimeToMinutes(block.startTime) ?? PREP_START_MINUTES;
}

function getBlockEndMinutes(block: ScheduleAvailabilityBlock) {
  if (block.isFullDay) return DAY_END_MINUTES;
  return parseTimeToMinutes(block.endTime) ?? DAY_END_MINUTES;
}

function WorkerTimeline({
  worker,
  busyTimeOffId,
  onApproveTimeOff,
  onDeclineTimeOff,
}: {
  worker: ScheduleWorker;
  busyTimeOffId: number | null;
  onApproveTimeOff: (block: ScheduleAvailabilityBlock) => void;
  onDeclineTimeOff: (block: ScheduleAvailabilityBlock) => void;
}) {
  const sortedJobs = [...worker.jobs].sort(sortWorkerJobs);
  const sortedBlocks = [...(worker.availabilityBlocks ?? [])].sort(sortAvailabilityBlocks);
  const timeline = buildTimelineLanes(sortedJobs);
  const laneHeight = 52;
  const timelineHeight = 38 + Math.max(timeline.laneCount, 1) * laneHeight + 14;

  return (
    <div
      style={{
        position: "relative",
        border: "1px solid #d4d4d8",
        borderRadius: 12,
        minHeight: timelineHeight,
        background: "#fafafa",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${getTimelineLeft(PREP_START_MINUTES)}%`,
          width: `${getTimelineWidth(PREP_START_MINUTES, WORK_START_MINUTES)}%`,
          top: 0,
          bottom: 0,
          background: "rgba(250, 204, 21, 0.10)",
          borderRight: "1px dashed #eab308",
          pointerEvents: "none",
        }}
      />

      {TIMELINE_MARKERS.map((marker) => {
        const left = getTimelineLeft(marker.minutes);

        return (
          <div
            key={marker.label}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: marker.minutes === WORK_START_MINUTES ? "#d4d4d8" : "#e4e4e7",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 6,
                fontSize: 11,
                color: "#71717a",
                whiteSpace: "nowrap",
                fontWeight: marker.minutes === PREP_START_MINUTES ? 700 : 500,
              }}
            >
              {marker.label}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          top: 8,
          left: 10,
          fontSize: 11,
          fontWeight: 800,
          color: "#a16207",
          background: "#fef3c7",
          border: "1px solid #fde68a",
          borderRadius: 999,
          padding: "3px 8px",
          zIndex: 3,
        }}
      >
        Prep 08:30–09:00
      </div>

      {sortedBlocks.map((block) => {
        const startMinutes = getBlockStartMinutes(block);
        const endMinutes = getBlockEndMinutes(block);
        const left = getTimelineLeft(startMinutes);
        const width = getTimelineWidth(startMinutes, endMinutes);
        const blockColor = getAvailabilityBlockColor(block);
        const isPendingRequest =
          block.source === "time_off_request" &&
          block.status === "pending" &&
          typeof block.timeOffRequestId === "number";
        const isBusy = busyTimeOffId === block.timeOffRequestId;

        return (
          <div
            key={`block-${block.id}`}
            title={`${block.title} • ${formatBlockTimeRange(block)}${block.notes ? ` • ${block.notes}` : ""}`}
            style={{
              position: "absolute",
              left: `${left}%`,
              width: `${width}%`,
              top: 38,
              bottom: 12,
              background: blockColor.background,
              border: `1px dashed ${blockColor.border}`,
              borderRadius: 10,
              boxSizing: "border-box",
              zIndex: 1,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                right: 8,
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: blockColor.text,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                }}
              >
                {block.title} • {formatBlockTimeRange(block)}
              </div>

              <div
                style={{
                  ...pillBase(),
                  ...getBlockStatusBadgeStyle(block.status),
                  fontSize: 10,
                  padding: "3px 8px",
                  flexShrink: 0,
                }}
              >
                {block.status}
              </div>
            </div>

            {isPendingRequest && (
              <div
                style={{
                  position: "absolute",
                  left: 8,
                  right: 8,
                  bottom: 8,
                  display: "flex",
                  gap: 6,
                  zIndex: 3,
                }}
              >
                <button
                  type="button"
                  onClick={() => onApproveTimeOff(block)}
                  disabled={isBusy}
                  style={{
                    flex: 1,
                    borderRadius: 8,
                    border: "1px solid #166534",
                    background: "#166534",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "6px 8px",
                    cursor: isBusy ? "default" : "pointer",
                    opacity: isBusy ? 0.7 : 1,
                  }}
                >
                  {isBusy ? "Working..." : "Approve"}
                </button>

                <button
                  type="button"
                  onClick={() => onDeclineTimeOff(block)}
                  disabled={isBusy}
                  style={{
                    flex: 1,
                    borderRadius: 8,
                    border: "1px solid #b91c1c",
                    background: "#fff",
                    color: "#b91c1c",
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "6px 8px",
                    cursor: isBusy ? "default" : "pointer",
                    opacity: isBusy ? 0.7 : 1,
                  }}
                >
                  {isBusy ? "Working..." : "Decline"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {timeline.jobs.map((job) => {
        const left = getTimelineLeft(job.startMinutes);
        const width = getTimelineWidth(job.startMinutes, job.endMinutes);
        const top = 38 + job.lane * laneHeight;
        const cardColor = getCardColor(job);
        const offHours = isOffHours(job);

        return (
          <Link
            key={job.id}
            href={`/jobs/${job.id}`}
            title={`${job.startTime ?? "TBD"} • ${job.title} • ${job.customerName} • ${
              job.postcode ?? ""
            }${job.needsSchedulingAttention && job.schedulingAttentionReason ? ` • ${job.schedulingAttentionReason}` : ""}`}
            style={{
              position: "absolute",
              left: `${left}%`,
              width: `${width}%`,
              top,
              height: 42,
              background: offHours ? "#fee2e2" : cardColor.background,
              border: `1px solid ${offHours ? "#fca5a5" : cardColor.border}`,
              borderRadius: 8,
              padding: "6px 8px",
              overflow: "hidden",
              fontSize: 12,
              boxSizing: "border-box",
              textDecoration: "none",
              color: "#18181b",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              zIndex: 2,
            }}
          >
            <div
              style={{
                fontWeight: 800,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginBottom: 2,
              }}
            >
              {job.startTime ?? "TBD"} • {titleCase(job.customerName) || "No customer"}
            </div>

            <div
              style={{
                fontSize: 11,
                color: "#52525b",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {job.postcode ?? "No postcode"} • {job.durationMinutes ?? 60}m
              {offHours ? " • Off-hours" : ""}
              {job.needsSchedulingAttention ? " • Attention" : ""}
            </div>
          </Link>
        );
      })}

      {sortedJobs.filter((job) => parseTimeToMinutes(job.startTime) === null).length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 10,
            fontSize: 12,
            color: "#71717a",
            background: "#fff",
            border: "1px solid #e4e4e7",
            borderRadius: 999,
            padding: "6px 10px",
            zIndex: 2,
          }}
        >
          {
            sortedJobs.filter((job) => parseTimeToMinutes(job.startTime) === null)
              .length
          }{" "}
          without a time
        </div>
      )}

      {worker.jobs.length === 0 && worker.availabilityBlocks.length === 0 && (
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 56,
            fontSize: 13,
            color: "#71717a",
          }}
        >
          No jobs scheduled for this worker.
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const [date, setDate] = useState(getTodayDateString());
  const [scheduleData, setScheduleData] = useState<ScheduleResponse | null>(null);
  const [jobsData, setJobsData] = useState<JobsApiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [refittingJobId, setRefittingJobId] = useState<number | null>(null);
  const [refittingWorkerId, setRefittingWorkerId] = useState<number | null>(null);
  const [busyTimeOffId, setBusyTimeOffId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const workers = useMemo(() => {
    return (scheduleData?.workers ?? []).map((worker) => ({
      ...worker,
      jobs: [...worker.jobs].sort(sortWorkerJobs),
      availabilityBlocks: [...(worker.availabilityBlocks ?? [])].sort(sortAvailabilityBlocks),
    }));
  }, [scheduleData]);

  const unscheduledJobs = useMemo(() => {
    return jobsData
      .filter((job) => {
        const status = String(job.status || "").toLowerCase();
        return (
          status === "unscheduled" ||
          ((status === "todo" || status === "scheduled") && !job.visitDate)
        );
      })
      .sort(sortUnscheduledJobs);
  }, [jobsData]);

  const attentionJobs = useMemo(() => {
    return unscheduledJobs.filter((job) => job.needsSchedulingAttention);
  }, [unscheduledJobs]);

  const scheduledJobCount = useMemo(() => {
    return workers.reduce((total, worker) => total + worker.jobs.length, 0);
  }, [workers]);

  const totalScheduledMinutes = useMemo(() => {
    return workers.reduce(
      (total, worker) =>
        total +
        worker.jobs.reduce(
          (jobTotal, job) => jobTotal + (job.durationMinutes ?? 60),
          0
        ),
      0
    );
  }, [workers]);

  const totalAvailabilityBlocks = useMemo(() => {
    return workers.reduce(
      (total, worker) => total + (worker.availabilityBlocks?.length ?? 0),
      0
    );
  }, [workers]);

  async function loadPage(selectedDate: string, isManualRefresh = false) {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [scheduleRes, jobsRes] = await Promise.all([
        fetch(`/api/schedule/day?date=${selectedDate}`, {
          cache: "no-store",
        }),
        fetch(`/api/jobs`, {
          cache: "no-store",
        }),
      ]);

      if (!scheduleRes.ok) {
        throw new Error("Failed to load schedule");
      }

      if (!jobsRes.ok) {
        throw new Error("Failed to load jobs");
      }

      const scheduleJson: ScheduleResponse = await scheduleRes.json();
      const jobsJson: JobsApiJob[] = await jobsRes.json();

      setScheduleData(scheduleJson);
      setJobsData(Array.isArray(jobsJson) ? jobsJson : []);
    } catch (err) {
      console.error("Failed to load schedule page", err);
      setError(
        err instanceof Error ? err.message : "Failed to load schedule page."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRunScheduler() {
    if (runningScheduler) return;

    setRunningScheduler(true);
    setError("");

    try {
      const res = await fetch("/api/scheduler/run", {
        method: "POST",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Scheduler failed");
      }

      await loadPage(date, true);

      window.alert(
        data?.scheduled > 0
          ? `${data.scheduled} job${data.scheduled === 1 ? "" : "s"} placed into the diary.`
          : data?.message || "No unscheduled jobs found."
      );
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Scheduler failed to run.";
      setError(message);
      window.alert(message);
    } finally {
      setRunningScheduler(false);
    }
  }

  async function handleRefitJob(jobId: number) {
    if (refittingJobId !== null) return;

    setRefittingJobId(jobId);
    setError("");

    try {
      const res = await fetch("/api/scheduler/refit-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to re-fit job");
      }

      await loadPage(date, true);

      if (data?.repaired) {
        window.alert("Job re-fitted successfully.");
      } else {
        window.alert("The system tried again but this job still needs attention.");
      }
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to re-fit job.";
      setError(message);
      window.alert(message);
    } finally {
      setRefittingJobId(null);
    }
  }

  async function handleRefitWorkerDay(workerId: number) {
    if (refittingWorkerId !== null) return;

    setRefittingWorkerId(workerId);
    setError("");

    try {
      const res = await fetch("/api/scheduler/refit-worker-day", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workerId, date }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to re-fit worker day");
      }

      await loadPage(date, true);

      if (data?.remaining > 0) {
        window.alert(
          `${data.repaired} job${data.repaired === 1 ? "" : "s"} re-fitted. ${data.remaining} still need attention.`
        );
      } else {
        window.alert(
          `${data.repaired} job${data.repaired === 1 ? "" : "s"} re-fitted for this worker/day.`
        );
      }
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to re-fit worker day.";
      setError(message);
      window.alert(message);
    } finally {
      setRefittingWorkerId(null);
    }
  }

  async function handleApproveTimeOff(block: ScheduleAvailabilityBlock) {
    if (!block.timeOffRequestId || busyTimeOffId !== null) return;

    const reviewNotes =
      window.prompt("Approval notes for the worker / diary (optional)", "") ?? "";

    try {
      setBusyTimeOffId(block.timeOffRequestId);
      setError("");

      const res = await fetch(`/api/kelly/time-off/${block.timeOffRequestId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewedByName: "Kelly",
          reviewNotes,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to approve request.");
      }

      await loadPage(date, true);

      const moved = Array.isArray(data?.impactedJobIds) ? data.impactedJobIds.length : 0;
      const scheduled = Number(data?.schedulerResult?.scheduled || 0);

      window.alert(
        `Approved. ${moved} impacted job${moved === 1 ? "" : "s"} were cleared and ${scheduled} unscheduled job${scheduled === 1 ? "" : "s"} were re-placed automatically.`
      );
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to approve request.";
      setError(message);
      window.alert(message);
    } finally {
      setBusyTimeOffId(null);
    }
  }

  async function handleDeclineTimeOff(block: ScheduleAvailabilityBlock) {
    if (!block.timeOffRequestId || busyTimeOffId !== null) return;

    const reviewNotes =
      window.prompt("Why are you declining this request? (optional)", "") ?? "";

    try {
      setBusyTimeOffId(block.timeOffRequestId);
      setError("");

      const res = await fetch(`/api/kelly/time-off/${block.timeOffRequestId}/decline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewedByName: "Kelly",
          reviewNotes,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to decline request.");
      }

      await loadPage(date, true);
      window.alert("Request declined.");
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to decline request.";
      setError(message);
      window.alert(message);
    } finally {
      setBusyTimeOffId(null);
    }
  }

  useEffect(() => {
    loadPage(date);
  }, [date]);

  return (
    <main style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: 24,
        }}
      >
        <TimeOffAlert />

        <section
          style={{
            overflow: "hidden",
            borderRadius: 24,
            border: "1px solid #e5e7eb",
            background: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background: "#18181b",
              color: "#fff",
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                alignItems: "end",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#facc15",
                    marginBottom: 8,
                  }}
                >
                  Furlads Scheduler
                </div>

                <h1
                  style={{
                    fontSize: 34,
                    lineHeight: 1.1,
                    margin: 0,
                    marginBottom: 10,
                  }}
                >
                  Schedule Board
                </h1>

                <p
                  style={{
                    margin: 0,
                    maxWidth: 760,
                    color: "#d4d4d8",
                    fontSize: 15,
                  }}
                >
                  Office control for the day. See worker timelines, scheduled
                  work and everything still waiting to be placed into the diary.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Link href="/admin" style={headerSecondaryButton()}>
                  Back to Dashboard
                </Link>

                <Link href="/jobs" style={headerSecondaryButton()}>
                  Open Jobs
                </Link>

                <button
                  type="button"
                  onClick={handleRunScheduler}
                  disabled={runningScheduler}
                  style={{
                    ...headerPrimaryButton(),
                    opacity: runningScheduler ? 0.7 : 1,
                    cursor: runningScheduler ? "default" : "pointer",
                  }}
                >
                  {runningScheduler ? "Scheduling..." : "Auto schedule jobs"}
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              background: "#fafafa",
              padding: 16,
              display: "flex",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <label
                htmlFor="schedule-date"
                style={{ fontSize: 14, fontWeight: 700, color: "#27272a" }}
              >
                Date
              </label>

              <input
                id="schedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle()}
              />

              <button
                type="button"
                onClick={() => setDate(getTodayDateString())}
                style={toolbarButton()}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => loadPage(date, true)}
                disabled={refreshing}
                style={{
                  ...toolbarButton(),
                  opacity: refreshing ? 0.7 : 1,
                  cursor: refreshing ? "default" : "pointer",
                }}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#52525b",
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <span>
                <strong>Prep:</strong> 08:30–09:00
              </span>
              <span>
                <strong>Working day:</strong> 09:00–16:30
              </span>
              <span>
                <strong>Farm start:</strong> TF9 4BQ
              </span>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard label="Active workers" value={workers.length} />
          <StatCard label="Scheduled jobs" value={scheduledJobCount} />
          <StatCard
            label="Scheduled hours"
            value={`${(totalScheduledMinutes / 60).toFixed(1)}h`}
          />
          <StatCard
            label="Blocked periods"
            value={totalAvailabilityBlocks}
            accent="#7c3aed"
          />
          <StatCard
            label="Needs attention"
            value={attentionJobs.length}
            accent={attentionJobs.length > 0 ? "#b91c1c" : "#166534"}
          />
          <StatCard
            label="Needs scheduling"
            value={unscheduledJobs.length}
            accent="#b45309"
          />
        </section>

        {loading && (
          <div style={messageCard()}>
            <div style={{ fontWeight: 700 }}>Loading schedule...</div>
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
            <section style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>Worker timelines</h2>
                  <div style={{ marginTop: 4, color: "#71717a", fontSize: 14 }}>
                    Scheduled work for {formatDate(scheduleData?.date ?? date)}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                {workers.length === 0 && (
                  <div style={messageCard()}>
                    No active workers found.
                  </div>
                )}

                {workers.map((worker) => {
                  const scheduledMinutes = worker.jobs.reduce(
                    (total, job) => total + (job.durationMinutes ?? 60),
                    0
                  );

                  const remainingMinutes =
                    DAY_END_MINUTES - WORK_START_MINUTES - scheduledMinutes;

                  const workerAttentionJobs = worker.jobs.filter(
                    (job) => job.needsSchedulingAttention
                  );

                  return (
                    <div key={worker.id} style={workerCard()}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 14,
                        }}
                      >
                        <div>
                          <h3 style={{ margin: 0, fontSize: 18 }}>
                            {worker.name}
                          </h3>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 13,
                              color: "#71717a",
                              display: "flex",
                              gap: 12,
                              flexWrap: "wrap",
                            }}
                          >
                            <span>
                              {worker.jobs.length} job
                              {worker.jobs.length === 1 ? "" : "s"} scheduled
                            </span>

                            {(worker.availabilityBlocks?.length ?? 0) > 0 && (
                              <span style={{ color: "#7c3aed", fontWeight: 700 }}>
                                {worker.availabilityBlocks.length} blocked period
                                {worker.availabilityBlocks.length === 1 ? "" : "s"}
                              </span>
                            )}

                            {workerAttentionJobs.length > 0 && (
                              <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                                {workerAttentionJobs.length} need attention
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#3f3f46",
                            }}
                          >
                            {formatRemaining(remainingMinutes)}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRefitWorkerDay(worker.id)}
                            disabled={refittingWorkerId === worker.id}
                            style={{
                              ...smallPrimaryButton(),
                              cursor: refittingWorkerId === worker.id ? "default" : "pointer",
                              opacity: refittingWorkerId === worker.id ? 0.7 : 1,
                            }}
                          >
                            {refittingWorkerId === worker.id ? "Re-fitting day..." : "Re-fit this day"}
                          </button>
                        </div>
                      </div>

                      <WorkerTimeline
                        worker={worker}
                        busyTimeOffId={busyTimeOffId}
                        onApproveTimeOff={handleApproveTimeOff}
                        onDeclineTimeOff={handleDeclineTimeOff}
                      />

                      {(worker.availabilityBlocks?.length ?? 0) > 0 && (
                        <div
                          style={{
                            marginTop: 12,
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {worker.availabilityBlocks.map((block) => {
                            const blockColor = getAvailabilityBlockColor(block);

                            return (
                              <div
                                key={`summary-block-${worker.id}-${block.id}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 8,
                                  borderRadius: 999,
                                  padding: "6px 10px",
                                  fontSize: 12,
                                  fontWeight: 800,
                                  background: blockColor.background,
                                  color: blockColor.text,
                                  border: `1px solid ${blockColor.border}`,
                                }}
                                title={block.notes || undefined}
                              >
                                <span>{block.title}</span>
                                <span style={{ opacity: 0.8 }}>
                                  {formatBlockTimeRange(block)}
                                </span>
                                <span
                                  style={{
                                    ...pillBase(),
                                    ...getBlockStatusBadgeStyle(block.status),
                                    fontSize: 10,
                                    padding: "2px 7px",
                                  }}
                                >
                                  {block.status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {workerAttentionJobs.length > 0 && (
                        <div
                          style={{
                            marginTop: 12,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          {workerAttentionJobs.map((job) => (
                            <div
                              key={`attention-${worker.id}-${job.id}`}
                              style={{
                                borderRadius: 12,
                                border: "1px solid #fecaca",
                                background: "#fff1f2",
                                padding: 10,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: "#9f1239",
                                  marginBottom: 4,
                                }}
                              >
                                ⚠️ {titleCase(job.customerName) || "No customer"} — {titleCase(job.title) || "General"}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#7f1d1d",
                                }}
                              >
                                {job.schedulingAttentionReason || "Needs scheduling attention"}
                                {job.schedulingLastAttemptAt
                                  ? ` • Last tried ${formatDateTime(job.schedulingLastAttemptAt)}`
                                  : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {worker.jobs.length > 0 && (
                        <div
                          style={{
                            marginTop: 14,
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          {worker.jobs.map((job) => {
                            const displayAddress = getDisplayAddress(job);
                            const cleanCustomer = titleCase(job.customerName) || "No customer";
                            const cleanTitle = titleCase(job.title) || "General";
                            const postcode = normaliseDisplayText(job.postcode);

                            return (
                              <Link
                                key={`list-${worker.id}-${job.id}`}
                                href={`/jobs/${job.id}`}
                                style={{
                                  textDecoration: "none",
                                  color: "inherit",
                                }}
                              >
                                <div style={jobRowCard()}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: 10,
                                      flexWrap: "wrap",
                                      marginBottom: 8,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                      }}
                                    >
                                      <span
                                        style={{
                                          ...pillBase(),
                                          ...getJobTypeBadgeStyle(job.jobType),
                                        }}
                                      >
                                        {formatJobType(job.jobType)}
                                      </span>

                                      <span
                                        style={{
                                          ...pillBase(),
                                          ...getStatusBadgeStyle(job.status),
                                        }}
                                      >
                                        {formatStatus(job.status)}
                                      </span>

                                      {job.needsSchedulingAttention && (
                                        <span
                                          style={{
                                            ...pillBase(),
                                            background: "#fff1f2",
                                            color: "#9f1239",
                                            border: "1px solid #fecaca",
                                          }}
                                        >
                                          Needs attention
                                        </span>
                                      )}

                                      {isOffHours(job) && (
                                        <span
                                          style={{
                                            ...pillBase(),
                                            background: "#fee2e2",
                                            color: "#991b1b",
                                            border: "1px solid #fecaca",
                                          }}
                                        >
                                          Off-hours
                                        </span>
                                      )}
                                    </div>

                                    <div
                                      style={{
                                        fontWeight: 800,
                                        color: "#18181b",
                                      }}
                                    >
                                      {formatTimeRange(job.startTime, job.durationMinutes)}
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      fontWeight: 800,
                                      marginBottom: 4,
                                    }}
                                  >
                                    {cleanCustomer} — {cleanTitle}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: 13,
                                      color: "#52525b",
                                    }}
                                  >
                                    {displayAddress || "No address"}
                                    {postcode ? ` • ${postcode}` : ""}
                                    {` • ${job.durationMinutes ?? 60} mins`}
                                  </div>

                                  {job.needsSchedulingAttention && (
                                    <div
                                      style={{
                                        marginTop: 8,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "#9f1239",
                                      }}
                                    >
                                      ⚠️ {job.schedulingAttentionReason || "Needs scheduling attention"}
                                    </div>
                                  )}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#fff",
                padding: 18,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>
                    Needs scheduling {attentionJobs.length > 0 && `⚠️ (${attentionJobs.length})`}
                  </h2>
                  <div
                    style={{
                      marginTop: 4,
                      color: "#71717a",
                      fontSize: 14,
                    }}
                  >
                    Jobs waiting to be fitted into the diary
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: attentionJobs.length > 0 ? "#b91c1c" : "#92400e",
                  }}
                >
                  {unscheduledJobs.length} waiting
                </div>
              </div>

              {unscheduledJobs.length === 0 ? (
                <div
                  style={{
                    border: "1px dashed #d4d4d8",
                    borderRadius: 12,
                    padding: 18,
                    color: "#71717a",
                    background: "#fafafa",
                  }}
                >
                  Nothing waiting to be scheduled 🎉
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {unscheduledJobs.map((job) => (
                    <div
                      key={job.id}
                      style={{
                        ...unscheduledCard(),
                        border: job.needsSchedulingAttention
                          ? "1px solid #fecaca"
                          : "1px solid #e5e7eb",
                        background: job.needsSchedulingAttention ? "#fff7f7" : "#fafafa",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          alignItems: "start",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              alignItems: "center",
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                ...pillBase(),
                                ...getJobTypeBadgeStyle(job.jobType),
                              }}
                            >
                              {formatJobType(job.jobType)}
                            </span>

                            <span
                              style={{
                                ...pillBase(),
                                ...getStatusBadgeStyle(job.status),
                              }}
                            >
                              {formatStatus(job.status)}
                            </span>

                            {job.needsSchedulingAttention && (
                              <span
                                style={{
                                  ...pillBase(),
                                  background: "#fff1f2",
                                  color: "#9f1239",
                                  border: "1px solid #fecaca",
                                }}
                              >
                                Needs attention
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              fontWeight: 800,
                              marginBottom: 4,
                              fontSize: 16,
                            }}
                          >
                            {titleCase(job.customer?.name) || "No customer"} —{" "}
                            {titleCase(job.title) || "General"}
                          </div>

                          <div
                            style={{
                              color: "#52525b",
                              fontSize: 14,
                              marginBottom: 6,
                            }}
                          >
                            {titleCase(job.address) || "No address"}
                            {job.customer?.postcode ? ` • ${job.customer.postcode}` : ""}
                          </div>

                          <div
                            style={{
                              color: "#71717a",
                              fontSize: 13,
                            }}
                          >
                            Expected: {job.durationMinutes ?? 60} mins • Assigned:{" "}
                            {formatWorkers(job.assignments)}
                          </div>

                          {job.needsSchedulingAttention && (
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#9f1239",
                              }}
                            >
                              ⚠️ {job.schedulingAttentionReason || "Needs scheduling attention"}
                              {job.schedulingLastAttemptAt
                                ? ` • Last tried ${formatDateTime(job.schedulingLastAttemptAt)}`
                                : ""}
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {job.needsSchedulingAttention && (
                            <button
                              type="button"
                              onClick={() => handleRefitJob(job.id)}
                              disabled={refittingJobId === job.id}
                              style={{
                                ...smallPrimaryButton(),
                                cursor: refittingJobId === job.id ? "default" : "pointer",
                                opacity: refittingJobId === job.id ? 0.7 : 1,
                              }}
                            >
                              {refittingJobId === job.id ? "Re-fitting..." : "Re-fit now"}
                            </button>
                          )}

                          <Link href={`/jobs/${job.id}`} style={smallButton()}>
                            Open job
                          </Link>

                          <Link
                            href={`/jobs/edit/${job.id}`}
                            style={smallButton()}
                          >
                            Edit / place
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#fff",
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#71717a",
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: accent || "#18181b",
        }}
      >
        {value}
      </div>
    </div>
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
  };
}

function toolbarButton(): React.CSSProperties {
  return {
    padding: "9px 12px",
    fontSize: 14,
    border: "1px solid #d4d4d8",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  };
}

function inputStyle(): React.CSSProperties {
  return {
    padding: "9px 12px",
    fontSize: 14,
    border: "1px solid #d4d4d8",
    borderRadius: 10,
    background: "#fff",
    color: "#18181b",
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

function workerCard(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    padding: 18,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  };
}

function jobRowCard(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fafafa",
    padding: 12,
  };
}

function unscheduledCard(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#fafafa",
    padding: 14,
  };
}

function pillBase(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 800,
  };
}

function smallButton(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: "1px solid #d4d4d8",
    background: "#fff",
    color: "#18181b",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 700,
    padding: "10px 12px",
  };
}

function smallPrimaryButton(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: "1px solid #18181b",
    background: "#18181b",
    color: "#fff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 700,
    padding: "10px 12px",
  };
}