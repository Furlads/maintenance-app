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

type FeedbackMessage = {
  tone: "success" | "error" | "info";
  title: string;
  text: string;
} | null;

type GapFillSuggestion = {
  workerId: number;
  workerName: string;
  freeMinutes: number;
  gapStartMinutes: number;
  gapEndMinutes: number;
  gapStartTime: string;
  gapEndTime: string;
  suggestedJobs: JobsApiJob[];
};

type TimeOffDecisionSheetState = {
  mode: "approve" | "decline";
  block: ScheduleAvailabilityBlock;
} | null;

type MoveJobSheetState = {
  jobId: number;
  currentWorkerId: number | null;
  currentWorkerName: string;
  selectedWorkerId: string;
  jobLabel: string;
} | null;

type PlaceIntoGapSheetState = {
  jobId: number;
  jobLabel: string;
  workerId: number;
  workerName: string;
  selectedStartTime: string;
  freeMinutes: number;
} | null;

const PREP_START_MINUTES = 8 * 60 + 30;
const WORK_START_MINUTES = 9 * 60;
const DAY_END_MINUTES = 19 * 60;
const TOTAL_DAY_MINUTES = DAY_END_MINUTES - PREP_START_MINUTES;
const MOBILE_BREAKPOINT = 768;

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
  { label: "17:00", minutes: 17 * 60 },
  { label: "18:00", minutes: 18 * 60 },
  { label: "19:00", minutes: 19 * 60 },
];

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  if (minutes <= 0) return "FULL";
  if (minutes < 30) return "<30m free";

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

function normalisePostcode(value: string | null | undefined) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function getPostcodeArea(value: string | null | undefined) {
  const postcode = normalisePostcode(value);
  const match = postcode.match(/^[A-Z]{1,2}\d{1,2}[A-Z]?/);
  return match ? match[0] : "";
}

function getPostcodeDistrict(value: string | null | undefined) {
  const postcode = normalisePostcode(value);
  const match = postcode.match(/^[A-Z]{1,2}\d{1,2}[A-Z]?/);
  return match ? match[0] : "";
}

function estimateTravelScore(fromPostcode: string | null | undefined, toPostcode: string | null | undefined) {
  const fromDistrict = getPostcodeDistrict(fromPostcode);
  const toDistrict = getPostcodeDistrict(toPostcode);

  if (!fromDistrict || !toDistrict) return 0;
  if (fromDistrict === toDistrict) return 220;

  const fromArea = getPostcodeArea(fromPostcode);
  const toArea = getPostcodeArea(toPostcode);

  if (fromArea && toArea && fromArea === toArea) return 120;

  return -80;
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

  if (
    title.includes("late start") ||
    title.includes("early finish") ||
    title.includes("appointment")
  ) {
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

function getWorkerRemainingMinutes(worker: ScheduleWorker) {
  const scheduledMinutes = worker.jobs.reduce(
    (total, job) => total + (job.durationMinutes ?? 60),
    0
  );

  const breakMinutes = scheduledMinutes >= 360 ? 20 : 0;
  const bufferMinutes = Math.round(scheduledMinutes * 0.15);
  const realisticUsedMinutes = scheduledMinutes + breakMinutes + bufferMinutes;

  return DAY_END_MINUTES - WORK_START_MINUTES - realisticUsedMinutes;
}

function getAssignedWorkerNames(job: JobsApiJob) {
  return formatWorkers(job.assignments);
}

function jobLooksAssignedToWorker(job: JobsApiJob, workerName: string) {
  const assigned = getAssignedWorkerNames(job).toLowerCase();
  return assigned.includes(workerName.toLowerCase());
}

function getWorkerBusyRanges(worker: ScheduleWorker) {
  const jobRanges = worker.jobs
    .map((job) => {
      const start = parseTimeToMinutes(job.startTime);
      if (start === null) return null;

      const duration = Math.max(job.durationMinutes ?? 60, 15);
      return {
        start: Math.max(WORK_START_MINUTES, start),
        end: Math.min(DAY_END_MINUTES, start + duration),
      };
    })
    .filter((range): range is { start: number; end: number } => range !== null);

  const blockRanges = (worker.availabilityBlocks ?? [])
    .filter((block) => String(block.status || "").toLowerCase() !== "declined")
    .map((block) => {
      const start = Math.max(WORK_START_MINUTES, getBlockStartMinutes(block));
      const end = Math.min(DAY_END_MINUTES, getBlockEndMinutes(block));

      if (end <= start) return null;

      return { start, end };
    })
    .filter((range): range is { start: number; end: number } => range !== null);

  const combined = [...jobRanges, ...blockRanges].sort((a, b) => a.start - b.start);

  if (combined.length === 0) {
    return [{ start: WORK_START_MINUTES, end: DAY_END_MINUTES }];
  }

  const merged: Array<{ start: number; end: number }> = [];

  for (const range of combined) {
    const last = merged[merged.length - 1];

    if (!last || range.start > last.end) {
      merged.push({ ...range });
    } else {
      last.end = Math.max(last.end, range.end);
    }
  }

  return merged;
}

function getWorkerFreeWindows(worker: ScheduleWorker) {
  const busyRanges = getWorkerBusyRanges(worker);
  const windows: Array<{ start: number; end: number; duration: number }> = [];

  let cursor = WORK_START_MINUTES;

  for (const range of busyRanges) {
    if (range.start > cursor) {
      windows.push({
        start: cursor,
        end: range.start,
        duration: range.start - cursor,
      });
    }

    cursor = Math.max(cursor, range.end);
  }

  if (cursor < DAY_END_MINUTES) {
    windows.push({
      start: cursor,
      end: DAY_END_MINUTES,
      duration: DAY_END_MINUTES - cursor,
    });
  }

  return windows.filter((window) => window.duration >= 30);
}

function getBestGapWindow(worker: ScheduleWorker) {
  const freeWindows = getWorkerFreeWindows(worker);

  if (freeWindows.length === 0) return null;

  return [...freeWindows].sort((a, b) => {
    if (b.duration !== a.duration) return b.duration - a.duration;
    return a.start - b.start;
  })[0];
}

function getScheduledJobsForWorker(worker: ScheduleWorker) {
  return [...worker.jobs]
    .filter((job) => parseTimeToMinutes(job.startTime) !== null)
    .sort(sortWorkerJobs);
}

function getGapContextForWindow(
  worker: ScheduleWorker,
  gapStartMinutes: number,
  gapEndMinutes: number
) {
  const scheduledJobs = getScheduledJobsForWorker(worker);

  let previousJob: ScheduleJob | null = null;
  let nextJob: ScheduleJob | null = null;

  for (const job of scheduledJobs) {
    const start = parseTimeToMinutes(job.startTime);
    if (start === null) continue;

    const duration = Math.max(job.durationMinutes ?? 60, 15);
    const end = start + duration;

    if (end <= gapStartMinutes) {
      previousJob = job;
      continue;
    }

    if (start >= gapEndMinutes) {
      nextJob = job;
      break;
    }
  }

  return {
    previousJob,
    nextJob,
  };
}

function getGapFillReasons(
  job: JobsApiJob,
  worker: ScheduleWorker,
  freeMinutes: number,
  gapStartMinutes: number,
  gapEndMinutes: number
) {
  const reasons: string[] = [];
  const duration = job.durationMinutes ?? 60;
  const jobType = String(job.jobType || "").toLowerCase();
  const jobPostcode = job.customer?.postcode || null;

  const { previousJob, nextJob } = getGapContextForWindow(
    worker,
    gapStartMinutes,
    gapEndMinutes
  );

  if (duration <= freeMinutes) {
    reasons.push(`Fits ${freeMinutes}m gap`);
  }

  if (jobLooksAssignedToWorker(job, worker.name)) {
    reasons.push("Already assigned");
  }

  if (freeMinutes <= 60 && jobType.includes("maint")) {
    reasons.push("Good short maintenance fit");
  } else if (freeMinutes <= 120 && jobType.includes("maint")) {
    reasons.push("Good maintenance fit");
  }

  if (job.needsSchedulingAttention) {
    reasons.push("Needs attention");
  }

  const previousTravelScore = previousJob
    ? estimateTravelScore(previousJob.postcode, jobPostcode)
    : 0;

  const nextTravelScore = nextJob
    ? estimateTravelScore(jobPostcode, nextJob.postcode)
    : 0;

  if (previousTravelScore >= 120 || nextTravelScore >= 120) {
    reasons.push("Same area");
  } else if (previousTravelScore > 0 || nextTravelScore > 0) {
    reasons.push("Route-friendly");
  }

  return reasons.slice(0, 3);
}

function scoreGapFillJob(
  job: JobsApiJob,
  worker: ScheduleWorker,
  freeMinutes: number,
  gapStartMinutes: number,
  gapEndMinutes: number
) {
  let score = 0;

  const duration = job.durationMinutes ?? 60;
  const jobType = String(job.jobType || "").toLowerCase();
  const status = String(job.status || "").toLowerCase();
  const jobPostcode = job.customer?.postcode || null;

  const { previousJob, nextJob } = getGapContextForWindow(
    worker,
    gapStartMinutes,
    gapEndMinutes
  );

  if (status === "unscheduled") score += 200;
  if (status === "todo" || status === "scheduled") score += 100;

  if (duration <= freeMinutes) {
    score += 400;
    score += Math.max(0, 120 - Math.abs(freeMinutes - duration));
  } else {
    score -= 300;
  }

  if (jobLooksAssignedToWorker(job, worker.name)) {
    score += 250;
  }

  // Small-gap prioritisation
  if (freeMinutes <= 60) {
    if (duration <= 60) score += 220;
    if (duration > 60) score -= 220;

    if (jobType.includes("maint")) score += 260;
    if (jobType.includes("quote")) score -= 120;
    if (jobType.includes("land")) score -= 80;
  } else if (freeMinutes <= 120) {
    if (duration <= 90) score += 160;
    if (duration > 120) score -= 160;

    if (jobType.includes("maint")) score += 180;
    if (jobType.includes("quote")) score += 40;
  } else {
    if (jobType.includes("maint")) score += 80;
  }

  if (job.needsSchedulingAttention) {
    score += 120;
  }

  if (!job.visitDate) {
    score += 40;
  }

  // Travel / postcode-aware scoring
  if (previousJob) {
    score += estimateTravelScore(previousJob.postcode, jobPostcode);
  }

  if (nextJob) {
    score += estimateTravelScore(jobPostcode, nextJob.postcode);
  }

  if (!previousJob && !nextJob) {
    score += estimateTravelScore("TF9 4BQ", jobPostcode);
  }

  return score;
}

function getWorkerSuggestedGapStartTime(worker: ScheduleWorker) {
  const sortedJobs = [...worker.jobs].sort(sortWorkerJobs);

  const timedJobs = sortedJobs.filter((job) => parseTimeToMinutes(job.startTime) !== null);

  if (timedJobs.length === 0) {
    return minutesToTime(WORK_START_MINUTES);
  }

  let latestEnd = WORK_START_MINUTES;

  for (const job of timedJobs) {
    const start = parseTimeToMinutes(job.startTime);
    if (start === null) continue;

    const duration = Math.max(job.durationMinutes ?? 60, 15);
    const end = start + duration;

    if (end > latestEnd) {
      latestEnd = end;
    }
  }

  const clamped = Math.max(WORK_START_MINUTES, Math.min(latestEnd, DAY_END_MINUTES - 15));
  return minutesToTime(clamped);
}

function buildGapFillSuggestions(
  workers: ScheduleWorker[],
  unscheduledJobs: JobsApiJob[]
): GapFillSuggestion[] {
  return workers
    .map((worker) => {
      const bestGap = getBestGapWindow(worker);

      if (!bestGap) return null;

      const freeMinutes = bestGap.duration;

      const suggestedJobs = [...unscheduledJobs]
        .filter((job) => (job.durationMinutes ?? 60) <= freeMinutes)
        .sort((a, b) => {
          const scoreA = scoreGapFillJob(
            a,
            worker,
            freeMinutes,
            bestGap.start,
            bestGap.end
          );
          const scoreB = scoreGapFillJob(
            b,
            worker,
            freeMinutes,
            bestGap.start,
            bestGap.end
          );

          if (scoreA !== scoreB) return scoreB - scoreA;

          return sortUnscheduledJobs(a, b);
        })
        .slice(0, 3);

      return {
        workerId: worker.id,
        workerName: worker.name,
        freeMinutes,
        gapStartMinutes: bestGap.start,
        gapEndMinutes: bestGap.end,
        gapStartTime: minutesToTime(bestGap.start),
        gapEndTime: minutesToTime(bestGap.end),
        suggestedJobs,
      };
    })
    .filter((entry): entry is GapFillSuggestion => entry !== null)
    .sort((a, b) => {
      if (b.freeMinutes !== a.freeMinutes) return b.freeMinutes - a.freeMinutes;
      return a.gapStartMinutes - b.gapStartMinutes;
    });
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
  const aStart = a.isFullDay
    ? PREP_START_MINUTES
    : parseTimeToMinutes(a.startTime) ?? PREP_START_MINUTES;
  const bStart = b.isFullDay
    ? PREP_START_MINUTES
    : parseTimeToMinutes(b.startTime) ?? PREP_START_MINUTES;

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
        overflowX: "auto",
        overflowY: "visible",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          position: "relative",
          border: "1px solid #d4d4d8",
          borderRadius: 12,
          minHeight: timelineHeight,
          minWidth: 860,
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
                  fontSize: 12,
                  color: "#71717a",
                  whiteSpace: "nowrap",
                  fontWeight: marker.minutes === PREP_START_MINUTES ? 800 : 600,
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
              title={`${block.title} • ${formatBlockTimeRange(block)}${
                block.notes ? ` • ${block.notes}` : ""
              }`}
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
                    fontSize: 12,
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
              href={`/jobs/${job.id}?back=/admin/schedule`}
              title={`${job.startTime ?? "TBD"} • ${job.title} • ${job.customerName} • ${
                job.postcode ?? ""
              }${
                job.needsSchedulingAttention && job.schedulingAttentionReason
                  ? ` • ${job.schedulingAttentionReason}`
                  : ""
              }`}
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
            {sortedJobs.filter((job) => parseTimeToMinutes(job.startTime) === null).length} without a
            time
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
    </div>
  );
}

function MobileWorkerCard({
  worker,
  remainingMinutes,
  workerAttentionJobs,
  refittingWorkerId,
  optimisingWorkerId,
  busyTimeOffId,
  movingJobId,
  onRefitWorkerDay,
  onOptimiseWorkerDay,
  onApproveTimeOff,
  onDeclineTimeOff,
  onOpenMoveJob,
}: {
  worker: ScheduleWorker;
  remainingMinutes: number;
  workerAttentionJobs: ScheduleJob[];
  refittingWorkerId: number | null;
  optimisingWorkerId: number | null;
  busyTimeOffId: number | null;
  movingJobId: number | null;
  onRefitWorkerDay: (workerId: number) => void;
  onOptimiseWorkerDay: (workerId: number) => void;
  onApproveTimeOff: (block: ScheduleAvailabilityBlock) => void;
  onDeclineTimeOff: (block: ScheduleAvailabilityBlock) => void;
  onOpenMoveJob: (job: ScheduleJob, worker: ScheduleWorker) => void;
}) {
  const sortedJobs = [...worker.jobs].sort(sortWorkerJobs);
  const sortedBlocks = [...(worker.availabilityBlocks ?? [])].sort(sortAvailabilityBlocks);

  return (
    <div style={mobileWorkerCard()}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 20,
              lineHeight: 1.15,
              color: "#18181b",
            }}
          >
            {worker.name}
          </h3>

          <div
            style={{
              marginTop: 6,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                ...pillBase(),
                background: "#f4f4f5",
                color: "#3f3f46",
                border: "1px solid #e4e4e7",
              }}
            >
              {worker.jobs.length} job{worker.jobs.length === 1 ? "" : "s"}
            </span>

            <span
              style={{
                ...pillBase(),
                background: "#ecfeff",
                color: "#155e75",
                border: "1px solid #a5f3fc",
              }}
            >
              {formatRemaining(remainingMinutes)}
            </span>

            {workerAttentionJobs.length > 0 && (
              <span
                style={{
                  ...pillBase(),
                  background: "#fff1f2",
                  color: "#9f1239",
                  border: "1px solid #fecaca",
                }}
              >
                {workerAttentionJobs.length} attention
              </span>
            )}

            {(worker.availabilityBlocks?.length ?? 0) > 0 && (
              <span
                style={{
                  ...pillBase(),
                  background: "#f5f3ff",
                  color: "#6d28d9",
                  border: "1px solid #ddd6fe",
                }}
              >
                {worker.availabilityBlocks.length} blocked
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={() => onRefitWorkerDay(worker.id)}
          disabled={refittingWorkerId === worker.id}
          style={{
            ...smallPrimaryButton(),
            padding: "11px 12px",
            fontSize: 12,
            cursor: refittingWorkerId === worker.id ? "default" : "pointer",
            opacity: refittingWorkerId === worker.id ? 0.7 : 1,
            width: "100%",
          }}
        >
          {refittingWorkerId === worker.id ? "Re-fitting..." : "Re-fit day"}
        </button>

        <button
          type="button"
          onClick={() => onOptimiseWorkerDay(worker.id)}
          disabled={optimisingWorkerId === worker.id}
          style={{
            ...smallButton(),
            padding: "11px 12px",
            fontSize: 12,
            cursor: optimisingWorkerId === worker.id ? "default" : "pointer",
            opacity: optimisingWorkerId === worker.id ? 0.7 : 1,
            width: "100%",
            background: "#facc15",
            border: "1px solid #facc15",
            color: "#18181b",
            fontWeight: 800,
          }}
        >
          {optimisingWorkerId === worker.id ? "Optimising..." : "Optimise day"}
        </button>
      </div>

      {workerAttentionJobs.length > 0 && (
        <div style={{ marginBottom: 12, display: "grid", gap: 8 }}>
          {workerAttentionJobs.map((job) => (
            <div
              key={`mobile-attention-${worker.id}-${job.id}`}
              style={{
                borderRadius: 14,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#9f1239",
                  marginBottom: 4,
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                ⚠️ {titleCase(job.customerName) || "No customer"} — {titleCase(job.title) || "General"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#7f1d1d",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
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

      {sortedBlocks.length > 0 && (
        <div style={{ marginBottom: 12, display: "grid", gap: 8 }}>
          {sortedBlocks.map((block) => {
            const blockColor = getAvailabilityBlockColor(block);
            const isPendingRequest =
              block.source === "time_off_request" &&
              block.status === "pending" &&
              typeof block.timeOffRequestId === "number";
            const isBusy = busyTimeOffId === block.timeOffRequestId;

            return (
              <div
                key={`mobile-block-${worker.id}-${block.id}`}
                style={{
                  borderRadius: 14,
                  border: `1px solid ${blockColor.border}`,
                  background: blockColor.background,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "start",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: blockColor.text,
                        marginBottom: 4,
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                      }}
                    >
                      {block.title}
                    </div>
                    <div style={{ fontSize: 12, color: blockColor.text, opacity: 0.9 }}>
                      {formatBlockTimeRange(block)}
                    </div>
                  </div>

                  <span
                    style={{
                      ...pillBase(),
                      ...getBlockStatusBadgeStyle(block.status),
                      fontSize: 10,
                      padding: "4px 8px",
                    }}
                  >
                    {block.status}
                  </span>
                </div>

                {block.notes && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: blockColor.text,
                      opacity: 0.9,
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {block.notes}
                  </div>
                )}

                {isPendingRequest && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onApproveTimeOff(block)}
                      disabled={isBusy}
                      style={{
                        borderRadius: 10,
                        border: "1px solid #166534",
                        background: "#166534",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "10px 12px",
                        cursor: isBusy ? "default" : "pointer",
                        opacity: isBusy ? 0.7 : 1,
                        minHeight: 44,
                      }}
                    >
                      {isBusy ? "Working..." : "Approve"}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeclineTimeOff(block)}
                      disabled={isBusy}
                      style={{
                        borderRadius: 10,
                        border: "1px solid #b91c1c",
                        background: "#fff",
                        color: "#b91c1c",
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "10px 12px",
                        cursor: isBusy ? "default" : "pointer",
                        opacity: isBusy ? 0.7 : 1,
                        minHeight: 44,
                      }}
                    >
                      {isBusy ? "Working..." : "Decline"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sortedJobs.length === 0 ? (
        <div
          style={{
            borderRadius: 14,
            border: "1px dashed #d4d4d8",
            background: "#fafafa",
            padding: 14,
            color: "#71717a",
            fontSize: 13,
          }}
        >
          No jobs scheduled for this worker.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sortedJobs.map((job) => {
            const displayAddress = getDisplayAddress(job);
            const cleanCustomer = titleCase(job.customerName) || "No customer";
            const cleanTitle = titleCase(job.title) || "General";
            const postcode = normaliseDisplayText(job.postcode);
            const offHours = isOffHours(job);

            return (
              <div
                key={`mobile-job-${worker.id}-${job.id}`}
                style={{
                  ...jobRowCard(),
                  background: offHours
                    ? "#fff7f7"
                    : job.needsSchedulingAttention
                      ? "#fff7f7"
                      : "#fafafa",
                  border: offHours
                    ? "1px solid #fecaca"
                    : job.needsSchedulingAttention
                      ? "1px solid #fecaca"
                      : "1px solid #e5e7eb",
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 10,
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

                    {offHours && (
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
                      fontWeight: 900,
                      fontSize: 14,
                      color: "#18181b",
                    }}
                  >
                    {formatTimeRange(job.startTime, job.durationMinutes)}
                  </div>
                </div>

                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 16,
                    lineHeight: 1.2,
                    marginBottom: 6,
                    color: "#18181b",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {cleanCustomer}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "#3f3f46",
                    marginBottom: 4,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {cleanTitle}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "#52525b",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
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
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    ⚠️ {job.schedulingAttentionReason || "Needs scheduling attention"}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    href={`/jobs/${job.id}?back=/admin/schedule`}
                    style={smallButton()}
                  >
                    Open job
                  </Link>

                  <button
                    type="button"
                    onClick={() => onOpenMoveJob(job, worker)}
                    disabled={movingJobId === job.id}
                    style={{
                      ...smallPrimaryButton(),
                      cursor: movingJobId === job.id ? "default" : "pointer",
                      opacity: movingJobId === job.id ? 0.7 : 1,
                    }}
                  >
                    {movingJobId === job.id ? "Moving..." : "Move job"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DesktopWorkerCard({
  worker,
  remainingMinutes,
  workerAttentionJobs,
  refittingWorkerId,
  optimisingWorkerId,
  busyTimeOffId,
  movingJobId,
  jobsExpanded,
  onToggleJobsExpanded,
  onRefitWorkerDay,
  onOptimiseWorkerDay,
  onApproveTimeOff,
  onDeclineTimeOff,
  onOpenMoveJob,
}: {
  worker: ScheduleWorker;
  remainingMinutes: number;
  workerAttentionJobs: ScheduleJob[];
  refittingWorkerId: number | null;
  optimisingWorkerId: number | null;
  busyTimeOffId: number | null;
  movingJobId: number | null;
  jobsExpanded: boolean;
  onToggleJobsExpanded: () => void;
  onRefitWorkerDay: (workerId: number) => void;
  onOptimiseWorkerDay: (workerId: number) => void;
  onApproveTimeOff: (block: ScheduleAvailabilityBlock) => void;
  onDeclineTimeOff: (block: ScheduleAvailabilityBlock) => void;
  onOpenMoveJob: (job: ScheduleJob, worker: ScheduleWorker) => void;
}) {
  return (
    <div style={workerCard()}>
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
            onClick={() => onOptimiseWorkerDay(worker.id)}
            disabled={optimisingWorkerId === worker.id}
            style={{
              ...smallButton(),
              background: "#facc15",
              border: "1px solid #facc15",
              color: "#18181b",
              fontWeight: 800,
              cursor: optimisingWorkerId === worker.id ? "default" : "pointer",
              opacity: optimisingWorkerId === worker.id ? 0.7 : 1,
            }}
          >
            {optimisingWorkerId === worker.id ? "Optimising..." : "Optimise day"}
          </button>

          <button
            type="button"
            onClick={() => onRefitWorkerDay(worker.id)}
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
        onApproveTimeOff={onApproveTimeOff}
        onDeclineTimeOff={onDeclineTimeOff}
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
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={onToggleJobsExpanded}
            style={{
              ...smallButton(),
              minHeight: 44,
              marginBottom: jobsExpanded ? 12 : 0,
              cursor: "pointer",
            }}
          >
            {jobsExpanded ? "Hide job list" : `Show job list (${worker.jobs.length})`}
          </button>

          {jobsExpanded && (
            <div
              style={{
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
                  <div
                    key={`list-${worker.id}-${job.id}`}
                    style={jobRowCard()}
                  >
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

                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <Link
                        href={`/jobs/${job.id}?back=/admin/schedule`}
                        style={smallButton()}
                      >
                        Open job
                      </Link>

                      <button
                        type="button"
                        onClick={() => onOpenMoveJob(job, worker)}
                        disabled={movingJobId === job.id}
                        style={{
                          ...smallPrimaryButton(),
                          cursor: movingJobId === job.id ? "default" : "pointer",
                          opacity: movingJobId === job.id ? 0.7 : 1,
                        }}
                      >
                        {movingJobId === job.id ? "Moving..." : "Move job"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const [date, setDate] = useState(getTodayDateString());
  const [selectedWorker, setSelectedWorker] = useState("all");
  const [scheduleData, setScheduleData] = useState<ScheduleResponse | null>(null);
  const [jobsData, setJobsData] = useState<JobsApiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [refittingJobId, setRefittingJobId] = useState<number | null>(null);
  const [refittingWorkerId, setRefittingWorkerId] = useState<number | null>(null);
  const [optimisingWorkerId, setOptimisingWorkerId] = useState<number | null>(null);
  const [busyTimeOffId, setBusyTimeOffId] = useState<number | null>(null);
  const [movingJobId, setMovingJobId] = useState<number | null>(null);
  const [placingJobId, setPlacingJobId] = useState<number | null>(null);
  const [tidyingRouteAfterPlace, setTidyingRouteAfterPlace] = useState(false);
  const [moveJobSheet, setMoveJobSheet] = useState<MoveJobSheetState>(null);
  const [placeIntoGapSheet, setPlaceIntoGapSheet] = useState<PlaceIntoGapSheetState>(null);
  const [error, setError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<FeedbackMessage>(null);
  const [timeOffDecisionSheet, setTimeOffDecisionSheet] =
    useState<TimeOffDecisionSheetState>(null);
  const [timeOffReviewNotes, setTimeOffReviewNotes] = useState("");
  const [expandedWorkerJobLists, setExpandedWorkerJobLists] = useState<Record<number, boolean>>({});

  const isMobile = useIsMobile();

  const workers = useMemo(() => {
    return (scheduleData?.workers ?? []).map((worker) => ({
      ...worker,
      jobs: [...worker.jobs].sort(sortWorkerJobs),
      availabilityBlocks: [...(worker.availabilityBlocks ?? [])].sort(sortAvailabilityBlocks),
    }));
  }, [scheduleData]);

  const filteredWorkers = useMemo(() => {
    if (selectedWorker === "all") return workers;
    return workers.filter((worker) => String(worker.id) === selectedWorker);
  }, [workers, selectedWorker]);

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
    return filteredWorkers.reduce((total, worker) => total + worker.jobs.length, 0);
  }, [filteredWorkers]);

  const totalScheduledMinutes = useMemo(() => {
    return filteredWorkers.reduce(
      (total, worker) =>
        total +
        worker.jobs.reduce(
          (jobTotal, job) => jobTotal + (job.durationMinutes ?? 60),
          0
        ),
      0
    );
  }, [filteredWorkers]);

  const totalAvailabilityBlocks = useMemo(() => {
    return filteredWorkers.reduce(
      (total, worker) => total + (worker.availabilityBlocks?.length ?? 0),
      0
    );
  }, [filteredWorkers]);

  const gapFillSuggestions = useMemo(() => {
    return buildGapFillSuggestions(filteredWorkers, unscheduledJobs);
  }, [filteredWorkers, unscheduledJobs]);

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
      const jobsJson = await jobsRes.json();

      setScheduleData(scheduleJson);
      setJobsData(Array.isArray(jobsJson?.items) ? jobsJson.items : []);
    } catch (err) {
      console.error("Failed to load schedule page", err);
      const message =
        err instanceof Error ? err.message : "Failed to load schedule page.";
      setError(message);
      setFeedbackMessage({
        tone: "error",
        title: "Couldn’t load schedule",
        text: message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRunScheduler() {
    if (runningScheduler) return;

    setRunningScheduler(true);
    setError("");
    setFeedbackMessage(null);

    try {
      const res = await fetch("/api/scheduler/run", {
        method: "POST",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Scheduler failed");
      }

      await loadPage(date, true);

      const optimisedDays = Number(data?.optimisedDays || 0);
      const travelMinutesSaved = Number(data?.travelMinutesSaved || 0);

      if (travelMinutesSaved > 0 && optimisedDays > 0) {
        setFeedbackMessage({
          tone: "success",
          title: "Scheduler complete",
          text: `Saved ${travelMinutesSaved} mins travel across ${optimisedDays} day${
            optimisedDays === 1 ? "" : "s"
          }.`,
        });
      } else {
        setFeedbackMessage({
          tone: "success",
          title: "Scheduler complete",
          text:
            data?.scheduled > 0
              ? `${data.scheduled} job${data.scheduled === 1 ? "" : "s"} placed into the diary.`
              : data?.message || "No better route found.",
        });
      }
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Scheduler failed to run.";
      setError(message);
      setFeedbackMessage({
        tone: "error",
        title: "Scheduler failed",
        text: message,
      });
    } finally {
      setRunningScheduler(false);
    }
  }

  async function handleRefitJob(jobId: number) {
    if (refittingJobId !== null) return;

    setRefittingJobId(jobId);
    setError("");
    setFeedbackMessage(null);

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

      setFeedbackMessage({
        tone: data?.repaired ? "success" : "info",
        title: data?.repaired ? "Job re-fitted" : "Job still needs attention",
        text: data?.repaired
          ? "Job re-fitted successfully."
          : "The system tried again but this job still needs attention.",
      });
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to re-fit job.";
      setError(message);
      setFeedbackMessage({
        tone: "error",
        title: "Re-fit failed",
        text: message,
      });
    } finally {
      setRefittingJobId(null);
    }
  }

  async function handleRefitWorkerDay(workerId: number) {
    if (refittingWorkerId !== null) return;

    setRefittingWorkerId(workerId);
    setError("");
    setFeedbackMessage(null);

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

      setFeedbackMessage({
        tone: data?.remaining > 0 ? "info" : "success",
        title: data?.remaining > 0 ? "Day partly re-fitted" : "Day re-fitted",
        text:
          data?.remaining > 0
            ? `${data.repaired} job${data.repaired === 1 ? "" : "s"} re-fitted. ${data.remaining} still need attention.`
            : `${data.repaired} job${data.repaired === 1 ? "" : "s"} re-fitted for this worker/day.`,
      });
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to re-fit worker day.";
      setError(message);
      setFeedbackMessage({
        tone: "error",
        title: "Worker re-fit failed",
        text: message,
      });
    } finally {
      setRefittingWorkerId(null);
    }
  }

  async function handleOptimiseWorkerDay(workerId: number) {
    if (optimisingWorkerId !== null) return;

    setOptimisingWorkerId(workerId);
    setError("");
    setFeedbackMessage(null);

    try {
      const res = await fetch("/api/scheduler/optimise-day", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workerId, date }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to optimise worker day");
      }

      await loadPage(date, true);

      setFeedbackMessage({
        tone: "success",
        title: "Day optimisation complete",
        text: data?.message || "Worker day optimised successfully.",
      });
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to optimise worker day.";
      setError(message);
      setFeedbackMessage({
        tone: "error",
        title: "Optimise day failed",
        text: message,
      });
    } finally {
      setOptimisingWorkerId(null);
    }
  }

  function openPlaceIntoGap(
    job: JobsApiJob,
    worker: ScheduleWorker,
    freeMinutes: number,
    gapStartTime: string
  ) {
    setPlaceIntoGapSheet({
      jobId: job.id,
      jobLabel: `${titleCase(job.customer?.name) || "No customer"} — ${titleCase(job.title) || "General"}`,
      workerId: worker.id,
      workerName: worker.name,
      selectedStartTime: gapStartTime,
      freeMinutes,
    });
  }

  function closePlaceIntoGapSheet() {
    if (placingJobId !== null) return;
    setPlaceIntoGapSheet(null);
  }

  async function submitPlaceIntoGap(runRouteTidy = false) {
    if (!placeIntoGapSheet || placingJobId !== null) return;

    try {
      setPlacingJobId(placeIntoGapSheet.jobId);
      setTidyingRouteAfterPlace(runRouteTidy);
      setError("");
      setFeedbackMessage(null);

      const res = await fetch(`/api/jobs/${placeIntoGapSheet.jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedTo: [placeIntoGapSheet.workerId],
          visitDate: date,
          startTime: placeIntoGapSheet.selectedStartTime,
          status: "todo",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to place job into gap");
      }

      if (runRouteTidy) {
        const optimiseRes = await fetch("/api/scheduler/optimise-day", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workerId: placeIntoGapSheet.workerId,
            date,
          }),
        });

        const optimiseData = await optimiseRes.json().catch(() => null);

        if (!optimiseRes.ok) {
          throw new Error(optimiseData?.error || "Job placed, but route tidy-up failed");
        }
      }

      await loadPage(date, true);

      setFeedbackMessage({
        tone: "success",
        title: runRouteTidy ? "Job placed and route tidied" : "Job placed into gap",
        text: runRouteTidy
          ? `${placeIntoGapSheet.jobLabel} placed with ${placeIntoGapSheet.workerName} at ${placeIntoGapSheet.selectedStartTime}, then the day was re-optimised.`
          : `${placeIntoGapSheet.jobLabel} placed with ${placeIntoGapSheet.workerName} at ${placeIntoGapSheet.selectedStartTime}.`,
      });

      setPlaceIntoGapSheet(null);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to place job into gap.";
      setError(message);
      setFeedbackMessage({
        tone: "error",
        title: "Place into gap failed",
        text: message,
      });
    } finally {
      setPlacingJobId(null);
      setTidyingRouteAfterPlace(false);
    }
  }

  function openMoveJob(job: ScheduleJob, worker: ScheduleWorker) {
    setMoveJobSheet({
      jobId: job.id,
      currentWorkerId: worker.id,
      currentWorkerName: worker.name,
      selectedWorkerId: String(worker.id),
      jobLabel: `${titleCase(job.customerName) || "No customer"} — ${titleCase(job.title) || "General"}`,
    });
  }

  function closeMoveJobSheet() {
    if (movingJobId !== null) return;
    setMoveJobSheet(null);
  }

  async function submitMoveJob() {
    if (!moveJobSheet || movingJobId !== null) return;

    const nextWorkerId = Number(moveJobSheet.selectedWorkerId);

    if (!Number.isInteger(nextWorkerId) || nextWorkerId <= 0) {
      setFeedbackMessage({
        tone: "error",
        title: "Choose a worker",
        text: "Please choose a worker to move this job to.",
      });
      return;
    }

    try {
      setMovingJobId(moveJobSheet.jobId);
      setError("");
      setFeedbackMessage(null);

      const res = await fetch(`/api/jobs/${moveJobSheet.jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedTo: [nextWorkerId],
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to move job");
      }

      await loadPage(date, true);

      const targetWorker =
        workers.find((worker) => worker.id === nextWorkerId)?.name || "selected worker";

      setFeedbackMessage({
        tone: "success",
        title: "Job moved",
        text: `${moveJobSheet.jobLabel} moved to ${targetWorker}.`,
      });

      setMoveJobSheet(null);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to move job.";
      setError(message);
      setFeedbackMessage({
        tone: "error",
        title: "Move failed",
        text: message,
      });
    } finally {
      setMovingJobId(null);
    }
  }

  function openApproveTimeOff(block: ScheduleAvailabilityBlock) {
    if (!block.timeOffRequestId || busyTimeOffId !== null) return;
    setTimeOffReviewNotes("");
    setTimeOffDecisionSheet({
      mode: "approve",
      block,
    });
  }

  function openDeclineTimeOff(block: ScheduleAvailabilityBlock) {
    if (!block.timeOffRequestId || busyTimeOffId !== null) return;
    setTimeOffReviewNotes("");
    setTimeOffDecisionSheet({
      mode: "decline",
      block,
    });
  }

  function closeTimeOffDecisionSheet() {
    if (busyTimeOffId !== null) return;
    setTimeOffDecisionSheet(null);
    setTimeOffReviewNotes("");
  }

  async function submitTimeOffDecision() {
    if (!timeOffDecisionSheet?.block.timeOffRequestId || busyTimeOffId !== null) return;

    const block = timeOffDecisionSheet.block;
    const mode = timeOffDecisionSheet.mode;
    const requestId = block.timeOffRequestId;

    try {
      setBusyTimeOffId(requestId);
      setError("");
      setFeedbackMessage(null);

      const endpoint =
        mode === "approve"
          ? `/api/kelly/time-off/${requestId}/approve`
          : `/api/kelly/time-off/${requestId}/decline`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewedByName: "Kelly",
          reviewNotes: timeOffReviewNotes,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            (mode === "approve"
              ? "Failed to approve request."
              : "Failed to decline request.")
        );
      }

      await loadPage(date, true);

      if (mode === "approve") {
        const moved = Array.isArray(data?.impactedJobIds) ? data.impactedJobIds.length : 0;
        const optimisedDays = Number(data?.schedulerResult?.optimisedDays || 0);
        const travelMinutesSaved = Number(data?.schedulerResult?.travelMinutesSaved || 0);

        setFeedbackMessage({
          tone: "success",
          title: "Time off approved",
          text:
            travelMinutesSaved > 0 && optimisedDays > 0
              ? `Approved. ${moved} impacted job${moved === 1 ? "" : "s"} were cleared and the scheduler then saved ${travelMinutesSaved} mins travel across ${optimisedDays} day${optimisedDays === 1 ? "" : "s"}.`
              : `Approved. ${moved} impacted job${moved === 1 ? "" : "s"} were cleared and the scheduler was re-run automatically.`,
        });
      } else {
        setFeedbackMessage({
          tone: "success",
          title: "Time off declined",
          text: "Request declined.",
        });
      }

      setTimeOffDecisionSheet(null);
      setTimeOffReviewNotes("");
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : mode === "approve"
            ? "Failed to approve request."
            : "Failed to decline request.";
      setError(message);
      setFeedbackMessage({
        tone: "error",
        title: mode === "approve" ? "Approval failed" : "Decline failed",
        text: message,
      });
    } finally {
      setBusyTimeOffId(null);
    }
  }

  function toggleWorkerJobList(workerId: number) {
    setExpandedWorkerJobLists((current) => ({
      ...current,
      [workerId]: !current[workerId],
    }));
  }

  useEffect(() => {
    loadPage(date);
  }, [date]);

  if (isMobile === null) {
    return (
      <main style={{ minHeight: "100vh", background: "#f5f5f5" }}>
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: 16,
          }}
        >
          <div style={messageCard()}>
            <div style={{ fontWeight: 700 }}>Loading schedule...</div>
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
        <TimeOffAlert />

        {feedbackMessage && (
          <section
            style={{
              marginBottom: 12,
              borderRadius: 16,
              border:
                feedbackMessage.tone === "success"
                  ? "1px solid #86efac"
                  : feedbackMessage.tone === "error"
                    ? "1px solid #fecaca"
                    : "1px solid #bfdbfe",
              background:
                feedbackMessage.tone === "success"
                  ? "#f0fdf4"
                  : feedbackMessage.tone === "error"
                    ? "#fff1f2"
                    : "#eff6ff",
              padding: 12,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "start",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color:
                      feedbackMessage.tone === "success"
                        ? "#166534"
                        : feedbackMessage.tone === "error"
                          ? "#9f1239"
                          : "#1d4ed8",
                    marginBottom: 4,
                  }}
                >
                  {feedbackMessage.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color:
                      feedbackMessage.tone === "success"
                        ? "#166534"
                        : feedbackMessage.tone === "error"
                          ? "#9f1239"
                          : "#1e40af",
                    lineHeight: 1.45,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {feedbackMessage.text}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFeedbackMessage(null)}
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "#fff",
                  color: "#3f3f46",
                  borderRadius: 999,
                  width: 34,
                  height: 34,
                  fontSize: 18,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          </section>
        )}

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
                  Furlads Scheduler
                </div>

                <h1
                  style={{
                    fontSize: isMobile ? 24 : 34,
                    lineHeight: 1.08,
                    margin: 0,
                    marginBottom: 8,
                  }}
                >
                  {isMobile ? "Today’s schedule" : "Schedule Board"}
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
                  {isMobile
                    ? "Quick control for the day. Check workers, blocked time and jobs still waiting to be placed."
                    : "Office control for the day. See worker timelines, scheduled work and everything still waiting to be placed into the diary."}
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
                  href="/jobs"
                  style={{ ...headerSecondaryButton(), width: isMobile ? "100%" : "auto" }}
                >
                  Open Jobs
                </Link>

                <button
                  type="button"
                  onClick={handleRunScheduler}
                  disabled={runningScheduler}
                  style={{
                    ...headerPrimaryButton(),
                    width: isMobile ? "100%" : "auto",
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
              padding: isMobile ? 10 : 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : "auto auto auto auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <label
                htmlFor="schedule-date"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#27272a",
                  gridColumn: isMobile ? "1 / -1" : "auto",
                }}
              >
                Date
              </label>

              <input
                id="schedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ ...inputStyle(), width: "100%" }}
              />

              <button
                type="button"
                onClick={() => setDate(getTodayDateString())}
                style={{ ...toolbarButton(), width: "100%" }}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => loadPage(date, true)}
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

              {workers.map((worker) => {
                const active = selectedWorker === String(worker.id);

                return (
                  <button
                    key={worker.id}
                    type="button"
                    onClick={() => setSelectedWorker(String(worker.id))}
                    style={{
                      borderRadius: 999,
                      padding: "7px 11px",
                      border: active ? "2px solid #18181b" : "1px solid #dddddd",
                      background: active ? "#18181b" : "#fff",
                      color: active ? "#fff" : "#18181b",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {worker.name}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#52525b",
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span>
                <strong>Prep:</strong> 08:30–09:00
              </span>
              <span>
                <strong>Working day:</strong> 09:00–19:00
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
            gridTemplateColumns: isMobile
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(auto-fit, minmax(180px, 1fr))",
            gap: isMobile ? 8 : 12,
            marginBottom: 14,
          }}
        >
          <StatCard label="Workers" value={filteredWorkers.length} compact={isMobile} />
          <StatCard label="Jobs" value={scheduledJobCount} compact={isMobile} />
          <StatCard
            label="Hours"
            value={`${(totalScheduledMinutes / 60).toFixed(1)}h`}
            compact={isMobile}
          />
          <StatCard
            label="Blocked"
            value={totalAvailabilityBlocks}
            accent="#7c3aed"
            compact={isMobile}
          />
          <StatCard
            label="Attention"
            value={attentionJobs.length}
            accent={attentionJobs.length > 0 ? "#b91c1c" : "#166534"}
            compact={isMobile}
          />
          <StatCard
            label="Waiting"
            value={unscheduledJobs.length}
            accent="#b45309"
            compact={isMobile}
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
                      <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: isMobile ? 16 : 18,
                background: "#fff",
                padding: isMobile ? 12 : 18,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: isMobile ? "start" : "center",
                  flexDirection: isMobile ? "column" : "row",
                  marginBottom: 14,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 22 }}>
                    Gap Fill Opportunities
                  </h2>
                  <div
                    style={{
                      marginTop: 4,
                      color: "#71717a",
                      fontSize: 14,
                    }}
                  >
                    Best-fit unscheduled jobs for spare worker time today
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#155e75",
                  }}
                >
                  {gapFillSuggestions.length} worker
                  {gapFillSuggestions.length === 1 ? "" : "s"} with usable gaps
                </div>
              </div>

              {gapFillSuggestions.length === 0 ? (
                <div
                  style={{
                    border: "1px dashed #d4d4d8",
                    borderRadius: 12,
                    padding: 18,
                    color: "#71717a",
                    background: "#fafafa",
                  }}
                >
                  No obvious gap-fill opportunities right now.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {gapFillSuggestions.map((entry) => (
                    <div
                      key={entry.workerId}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        background: "#fafafa",
                        padding: isMobile ? 12 : 14,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          alignItems: "center",
                          marginBottom: 10,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 16,
                              color: "#18181b",
                            }}
                          >
                            {entry.workerName}
                          </div>
                                                    <div
                            style={{
                              marginTop: 4,
                              fontSize: 13,
                              color: "#52525b",
                            }}
                          >
                            {entry.gapStartTime} → {entry.gapEndTime} • {formatRemaining(entry.freeMinutes)}
                          </div>
                        </div>

                        <div
                          style={{
                            ...pillBase(),
                            background: "#ecfeff",
                            color: "#155e75",
                            border: "1px solid #a5f3fc",
                          }}
                        >
                          {entry.suggestedJobs.length} suggestion
                          {entry.suggestedJobs.length === 1 ? "" : "s"}
                        </div>
                      </div>

                      {entry.suggestedJobs.length === 0 ? (
                        <div
                          style={{
                            borderRadius: 12,
                            border: "1px dashed #d4d4d8",
                            background: "#fff",
                            padding: 14,
                            color: "#71717a",
                            fontSize: 13,
                          }}
                        >
                          Nothing suitable fits this worker’s spare time.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {entry.suggestedJobs.map((job) => (
                            <div
                              key={`gap-fill-${entry.workerId}-${job.id}`}
                              style={{
                                border: job.needsSchedulingAttention
                                  ? "1px solid #fecaca"
                                  : "1px solid #e5e7eb",
                                borderRadius: 12,
                                background: job.needsSchedulingAttention ? "#fff7f7" : "#fff",
                                padding: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  flexWrap: "wrap",
                                  alignItems: "start",
                                  flexDirection: isMobile ? "column" : "row",
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
                                      fontSize: 15,
                                      overflowWrap: "anywhere",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {titleCase(job.customer?.name) || "No customer"} —{" "}
                                    {titleCase(job.title) || "General"}
                                  </div>

                                  <div
                                    style={{
                                      color: "#52525b",
                                      fontSize: 13,
                                      marginBottom: 6,
                                      overflowWrap: "anywhere",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {titleCase(job.address) || "No address"}
                                    {job.customer?.postcode ? ` • ${job.customer.postcode}` : ""}
                                  </div>

                                  <div
                                    style={{
                                      color: "#71717a",
                                      fontSize: 12,
                                      overflowWrap: "anywhere",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    Expected: {job.durationMinutes ?? 60} mins • Assigned:{" "}
                                    {formatWorkers(job.assignments)}
                                  </div>

                                  <div
                                    style={{
                                      marginTop: 8,
                                      display: "flex",
                                      gap: 6,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    {getGapFillReasons(
                                      job,
                                      workers.find((w) => w.id === entry.workerId)!,
                                      entry.freeMinutes,
                                      entry.gapStartMinutes,
                                      entry.gapEndMinutes
                                    ).map((reason) => (
                                      <span
                                        key={`${job.id}-${reason}`}
                                        style={{
                                          ...pillBase(),
                                          background: "#f4f4f5",
                                          color: "#3f3f46",
                                          border: "1px solid #e4e4e7",
                                          fontSize: 11,
                                          padding: "4px 8px",
                                        }}
                                      >
                                        {reason}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, auto)",
                                    gap: 8,
                                    width: isMobile ? "100%" : "auto",
                                  }}
                                >
                                  <button
                                    type="button"
onClick={() =>
  openPlaceIntoGap(
    job,
    workers.find((w) => w.id === entry.workerId)!,
    entry.freeMinutes,
    entry.gapStartTime
  )
}
                                    disabled={placingJobId === job.id}
                                    style={{
                                      ...smallPrimaryButton(),
                                      width: isMobile ? "100%" : "auto",
                                      cursor: placingJobId === job.id ? "default" : "pointer",
                                      opacity: placingJobId === job.id ? 0.7 : 1,
                                    }}
                                  >
                                    {placingJobId === job.id ? "Placing..." : "Place into gap"}
                                  </button>

                                  <Link
                                    href={`/jobs/${job.id}?back=/admin/schedule`}
                                    style={{ ...smallButton(), width: isMobile ? "100%" : "auto" }}
                                  >
                                    Open job
                                  </Link>

                                  <Link
                                    href={`/jobs/edit/${job.id}`}
                                    style={{ ...smallButton(), width: isMobile ? "100%" : "auto" }}
                                  >
                                    Edit / place
                                  </Link>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: isMobile ? "start" : "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 10,
                  flexDirection: isMobile ? "column" : "row",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 22 }}>
                    {isMobile ? "Worker day cards" : "Worker timelines"}
                  </h2>
                  <div style={{ marginTop: 4, color: "#71717a", fontSize: 13 }}>
                    Scheduled work for {formatDate(scheduleData?.date ?? date)}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                {filteredWorkers.length === 0 && (
                  <div style={messageCard()}>
                    No workers found for this filter.
                  </div>
                )}

                {filteredWorkers.map((worker) => {
                  const scheduledMinutes = worker.jobs.reduce(
                    (total, job) => total + (job.durationMinutes ?? 60),
                    0
                  );

                  const breakMinutes = scheduledMinutes >= 360 ? 20 : 0;
                  const bufferMinutes = Math.round(scheduledMinutes * 0.15);
                  const realisticUsedMinutes =
                    scheduledMinutes + breakMinutes + bufferMinutes;

                  const remainingMinutes =
                    DAY_END_MINUTES - WORK_START_MINUTES - realisticUsedMinutes;

                  const workerAttentionJobs = worker.jobs.filter(
                    (job) => job.needsSchedulingAttention
                  );

                  if (isMobile) {
                    return (
                      <MobileWorkerCard
                        key={worker.id}
                        worker={worker}
                        remainingMinutes={remainingMinutes}
                        workerAttentionJobs={workerAttentionJobs}
                        refittingWorkerId={refittingWorkerId}
                        optimisingWorkerId={optimisingWorkerId}
                        busyTimeOffId={busyTimeOffId}
                        movingJobId={movingJobId}
                        onRefitWorkerDay={handleRefitWorkerDay}
                        onOptimiseWorkerDay={handleOptimiseWorkerDay}
                        onApproveTimeOff={openApproveTimeOff}
                        onDeclineTimeOff={openDeclineTimeOff}
                        onOpenMoveJob={openMoveJob}
                      />
                    );
                  }

                  return (
                    <DesktopWorkerCard
                      key={worker.id}
                      worker={worker}
                      remainingMinutes={remainingMinutes}
                      workerAttentionJobs={workerAttentionJobs}
                      refittingWorkerId={refittingWorkerId}
                      optimisingWorkerId={optimisingWorkerId}
                      busyTimeOffId={busyTimeOffId}
                      movingJobId={movingJobId}
                      jobsExpanded={!!expandedWorkerJobLists[worker.id]}
                      onToggleJobsExpanded={() => toggleWorkerJobList(worker.id)}
                      onRefitWorkerDay={handleRefitWorkerDay}
                      onOptimiseWorkerDay={handleOptimiseWorkerDay}
                      onApproveTimeOff={openApproveTimeOff}
                      onDeclineTimeOff={openDeclineTimeOff}
                      onOpenMoveJob={openMoveJob}
                    />
                  );
                })}
              </div>
            </section>

            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: isMobile ? 16 : 18,
                background: "#fff",
                padding: isMobile ? 12 : 18,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: isMobile ? "start" : "center",
                  flexDirection: isMobile ? "column" : "row",
                  marginBottom: 14,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 22 }}>
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
                        padding: isMobile ? 12 : 14,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          alignItems: "start",
                          flexDirection: isMobile ? "column" : "row",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1, width: "100%" }}>
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
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
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
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                            }}
                          >
                            {titleCase(job.address) || "No address"}
                            {job.customer?.postcode ? ` • ${job.customer.postcode}` : ""}
                          </div>

                          <div
                            style={{
                              color: "#71717a",
                              fontSize: 13,
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
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
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
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
                            display: "grid",
                            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, auto)",
                            gap: 8,
                            width: isMobile ? "100%" : "auto",
                          }}
                        >
                          {job.needsSchedulingAttention && (
                            <button
                              type="button"
                              onClick={() => handleRefitJob(job.id)}
                              disabled={refittingJobId === job.id}
                              style={{
                                ...smallPrimaryButton(),
                                width: isMobile ? "100%" : "auto",
                                cursor: refittingJobId === job.id ? "default" : "pointer",
                                opacity: refittingJobId === job.id ? 0.7 : 1,
                              }}
                            >
                              {refittingJobId === job.id ? "Re-fitting..." : "Re-fit now"}
                            </button>
                          )}

                          <Link
                            href={`/jobs/${job.id}?back=/admin/schedule`}
                            style={{ ...smallButton(), width: isMobile ? "100%" : "auto" }}
                          >
                            Open job
                          </Link>

                          <Link
                            href={`/jobs/edit/${job.id}`}
                            style={{ ...smallButton(), width: isMobile ? "100%" : "auto" }}
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

      {placeIntoGapSheet && (
        <div
          onClick={closePlaceIntoGapSheet}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1185,
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: isMobile ? "88vh" : "calc(100vh - 32px)",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              background: "#fff",
              borderRadius: isMobile ? "22px 22px 0 0" : 22,
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
              padding: 18,
              paddingBottom: isMobile ? "calc(env(safe-area-inset-bottom) + 18px)" : 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "start",
                marginBottom: 14,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#1d4ed8",
                    marginBottom: 6,
                  }}
                >
                  Place into gap
                </div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: 22,
                    lineHeight: 1.15,
                    color: "#18181b",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {placeIntoGapSheet.jobLabel}
                </h3>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    color: "#52525b",
                    lineHeight: 1.45,
                  }}
                >
                  Place with {placeIntoGapSheet.workerName} on {formatDate(date)} in the selected free gap.
                </div>
              </div>

              <button
                type="button"
                onClick={closePlaceIntoGapSheet}
                disabled={placingJobId !== null}
                style={{
                  border: "1px solid #e4e4e7",
                  background: "#fff",
                  color: "#3f3f46",
                  borderRadius: 999,
                  width: 38,
                  height: 38,
                  fontSize: 20,
                  cursor: placingJobId !== null ? "default" : "pointer",
                  opacity: placingJobId !== null ? 0.7 : 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="gap-start-time"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#27272a",
                  marginBottom: 6,
                }}
              >
                Suggested start time
              </label>

              <input
                id="gap-start-time"
                type="time"
                value={placeIntoGapSheet.selectedStartTime}
                onChange={(e) =>
                  setPlaceIntoGapSheet((current) =>
                    current
                      ? {
                          ...current,
                          selectedStartTime: e.target.value,
                        }
                      : current
                  )
                }
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #d4d4d8",
                  background: "#fff",
                  color: "#18181b",
                  fontSize: 14,
                  minHeight: 46,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{
                marginBottom: 14,
                fontSize: 13,
                color: "#52525b",
              }}
            >
              Free time available: {formatRemaining(placeIntoGapSheet.freeMinutes)}
            </div>

            <div
              style={{
                position: "sticky",
                bottom: -18,
                background: "#fff",
                paddingTop: 8,
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={closePlaceIntoGapSheet}
                disabled={placingJobId !== null}
                style={{
                  ...smallButton(),
                  width: "100%",
                  minHeight: 46,
                  cursor: placingJobId !== null ? "default" : "pointer",
                  opacity: placingJobId !== null ? 0.7 : 1,
                }}
              >
                Cancel
              </button>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => submitPlaceIntoGap(false)}
                  disabled={placingJobId !== null}
                  style={{
                    width: "100%",
                    minHeight: 46,
                    borderRadius: 10,
                    border: "1px solid #18181b",
                    background: "#18181b",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: placingJobId !== null ? "default" : "pointer",
                    opacity: placingJobId !== null ? 0.7 : 1,
                  }}
                >
                  {placingJobId !== null && !tidyingRouteAfterPlace
                    ? "Placing..."
                    : "Place job"}
                </button>

                <button
                  type="button"
                  onClick={() => submitPlaceIntoGap(true)}
                  disabled={placingJobId !== null}
                  style={{
                    width: "100%",
                    minHeight: 46,
                    borderRadius: 10,
                    border: "1px solid #facc15",
                    background: "#facc15",
                    color: "#18181b",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: placingJobId !== null ? "default" : "pointer",
                    opacity: placingJobId !== null ? 0.7 : 1,
                  }}
                >
                  {placingJobId !== null && tidyingRouteAfterPlace
                    ? "Placing + tidying..."
                    : "Place job + tidy route"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {moveJobSheet && (
        <div
          onClick={closeMoveJobSheet}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1190,
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: isMobile ? "88vh" : "calc(100vh - 32px)",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              background: "#fff",
              borderRadius: isMobile ? "22px 22px 0 0" : 22,
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
              padding: 18,
              paddingBottom: isMobile ? "calc(env(safe-area-inset-bottom) + 18px)" : 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "start",
                marginBottom: 14,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#1d4ed8",
                    marginBottom: 6,
                  }}
                >
                  Move job
                </div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: 22,
                    lineHeight: 1.15,
                    color: "#18181b",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {moveJobSheet.jobLabel}
                </h3>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    color: "#52525b",
                    lineHeight: 1.45,
                  }}
                >
                  Currently assigned to {moveJobSheet.currentWorkerName}.
                </div>
              </div>

              <button
                type="button"
                onClick={closeMoveJobSheet}
                disabled={movingJobId !== null}
                style={{
                  border: "1px solid #e4e4e7",
                  background: "#fff",
                  color: "#3f3f46",
                  borderRadius: 999,
                  width: 38,
                  height: 38,
                  fontSize: 20,
                  cursor: movingJobId !== null ? "default" : "pointer",
                  opacity: movingJobId !== null ? 0.7 : 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="move-job-worker"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#27272a",
                  marginBottom: 6,
                }}
              >
                Move to worker
              </label>

              <select
                id="move-job-worker"
                value={moveJobSheet.selectedWorkerId}
                onChange={(e) =>
                  setMoveJobSheet((current) =>
                    current
                      ? {
                          ...current,
                          selectedWorkerId: e.target.value,
                        }
                      : current
                  )
                }
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #d4d4d8",
                  background: "#fff",
                  color: "#18181b",
                  fontSize: 14,
                  minHeight: 46,
                }}
              >
                {workers.map((worker) => (
                  <option key={worker.id} value={String(worker.id)}>
                    {worker.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                position: "sticky",
                bottom: -18,
                background: "#fff",
                paddingTop: 8,
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={closeMoveJobSheet}
                disabled={movingJobId !== null}
                style={{
                  ...smallButton(),
                  width: "100%",
                  minHeight: 46,
                  cursor: movingJobId !== null ? "default" : "pointer",
                  opacity: movingJobId !== null ? 0.7 : 1,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitMoveJob}
                disabled={movingJobId !== null}
                style={{
                  width: "100%",
                  minHeight: 46,
                  borderRadius: 10,
                  border: "1px solid #18181b",
                  background: "#18181b",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: movingJobId !== null ? "default" : "pointer",
                  opacity: movingJobId !== null ? 0.7 : 1,
                }}
              >
                {movingJobId !== null ? "Moving..." : "Move job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {timeOffDecisionSheet && (
        <div
          onClick={closeTimeOffDecisionSheet}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1200,
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: isMobile ? "88vh" : "calc(100vh - 32px)",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              background: "#fff",
              borderRadius: isMobile ? "22px 22px 0 0" : 22,
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
              padding: 18,
              paddingBottom: isMobile ? "calc(env(safe-area-inset-bottom) + 18px)" : 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "start",
                marginBottom: 14,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color:
                      timeOffDecisionSheet.mode === "approve" ? "#166534" : "#b91c1c",
                    marginBottom: 6,
                  }}
                >
                  {timeOffDecisionSheet.mode === "approve"
                    ? "Approve time off"
                    : "Decline time off"}
                </div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: 22,
                    lineHeight: 1.15,
                    color: "#18181b",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {timeOffDecisionSheet.block.title}
                </h3>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    color: "#52525b",
                    lineHeight: 1.45,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {formatBlockTimeRange(timeOffDecisionSheet.block)}
                  {timeOffDecisionSheet.block.notes
                    ? ` • ${timeOffDecisionSheet.block.notes}`
                    : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={closeTimeOffDecisionSheet}
                disabled={busyTimeOffId !== null}
                style={{
                  border: "1px solid #e4e4e7",
                  background: "#fff",
                  color: "#3f3f46",
                  borderRadius: 999,
                  width: 38,
                  height: 38,
                  fontSize: 20,
                  cursor: busyTimeOffId !== null ? "default" : "pointer",
                  opacity: busyTimeOffId !== null ? 0.7 : 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                marginBottom: 12,
                fontSize: 14,
                color: "#3f3f46",
                lineHeight: 1.5,
              }}
            >
              {timeOffDecisionSheet.mode === "approve"
                ? "Approve this request and let the scheduler clear any impacted jobs automatically."
                : "Decline this request and optionally leave a note explaining why."}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="timeoff-review-notes"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#27272a",
                  marginBottom: 6,
                }}
              >
                {timeOffDecisionSheet.mode === "approve"
                  ? "Approval notes (optional)"
                  : "Decline notes (optional)"}
              </label>

              <textarea
                id="timeoff-review-notes"
                value={timeOffReviewNotes}
                onChange={(e) => setTimeOffReviewNotes(e.target.value)}
                placeholder={
                  timeOffDecisionSheet.mode === "approve"
                    ? "Any note for the worker or diary..."
                    : "Why are you declining this request?"
                }
                style={{
                  width: "100%",
                  minHeight: 110,
                  borderRadius: 14,
                  border: "1px solid #d4d4d8",
                  padding: 12,
                  fontSize: 14,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{
                position: "sticky",
                bottom: -18,
                background: "#fff",
                paddingTop: 8,
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={closeTimeOffDecisionSheet}
                disabled={busyTimeOffId !== null}
                style={{
                  ...smallButton(),
                  width: "100%",
                  minHeight: 46,
                  cursor: busyTimeOffId !== null ? "default" : "pointer",
                  opacity: busyTimeOffId !== null ? 0.7 : 1,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitTimeOffDecision}
                disabled={busyTimeOffId !== null}
                style={{
                  width: "100%",
                  minHeight: 46,
                  borderRadius: 10,
                  border:
                    timeOffDecisionSheet.mode === "approve"
                      ? "1px solid #166534"
                      : "1px solid #b91c1c",
                  background:
                    timeOffDecisionSheet.mode === "approve" ? "#166534" : "#b91c1c",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: busyTimeOffId !== null ? "default" : "pointer",
                  opacity: busyTimeOffId !== null ? 0.7 : 1,
                }}
              >
                {busyTimeOffId !== null
                  ? "Saving..."
                  : timeOffDecisionSheet.mode === "approve"
                    ? "Approve request"
                    : "Decline request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
  compact = false,
}: {
  label: string;
  value: string | number;
  accent?: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: compact ? 14 : 16,
        background: "#fff",
        padding: compact ? 12 : 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          fontSize: compact ? 10 : 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#71717a",
          marginBottom: compact ? 6 : 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: compact ? 22 : 28,
          fontWeight: 900,
          color: accent || "#18181b",
          lineHeight: 1.05,
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

function inputStyle(): React.CSSProperties {
  return {
    padding: "10px 12px",
    fontSize: 14,
    border: "1px solid #d4d4d8",
    borderRadius: 10,
    background: "#fff",
    color: "#18181b",
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

function workerCard(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    padding: 18,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  };
}

function mobileWorkerCard(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    padding: 14,
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
    minHeight: 42,
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
    minHeight: 42,
  };
}