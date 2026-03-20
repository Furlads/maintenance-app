"use client";

import React from "react";

type JobStatus = "todo" | "in-progress" | "done" | "cancelled";
type JobCategory = "Maintenance" | "Landscaping" | "Quote" | "Other";

export type WorkerTimelineJob = {
  id: string;
  startTime: string; // "09:00"
  durationMinutes: number;
  customerName: string;
  addressLine1?: string;
  postcode?: string;
  category?: JobCategory;
  status?: JobStatus;
};

type WorkerTimelineDayViewProps = {
  dateLabel: string; // e.g. "23 Mar 2026"
  workerName: string;
  jobs: WorkerTimelineJob[];
  fullDay?: boolean;
};

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getEndTime(startTime: string, durationMinutes: number) {
  return minutesToTime(timeToMinutes(startTime) + durationMinutes);
}

function formatTimeRange(startTime: string, durationMinutes: number) {
  return `${startTime} → ${getEndTime(startTime, durationMinutes)}`;
}

function cleanText(value?: string) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function titleCase(value?: string) {
  const text = cleanText(value);
  if (!text) return "";
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function dedupeAddress(customerName?: string, addressLine1?: string) {
  const customer = cleanText(customerName).toLowerCase();
  const address = cleanText(addressLine1);

  if (!address) return "";

  if (address.toLowerCase() === customer) return "";

  return titleCase(address);
}

function getBadgeStyles(category?: JobCategory) {
  switch (category) {
    case "Maintenance":
      return "border border-green-200 bg-green-50 text-green-700";
    case "Landscaping":
      return "border border-sky-200 bg-sky-50 text-sky-700";
    case "Quote":
      return "border border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border border-gray-200 bg-gray-50 text-gray-700";
  }
}

function getStatusStyles(status?: JobStatus) {
  switch (status) {
    case "in-progress":
      return "border border-blue-200 bg-blue-50 text-blue-700";
    case "done":
      return "border border-emerald-200 bg-emerald-50 text-emerald-700";
    case "cancelled":
      return "border border-red-200 bg-red-50 text-red-700";
    case "todo":
    default:
      return "border border-amber-200 bg-amber-50 text-amber-700";
  }
}

function getStatusLabel(status?: JobStatus) {
  switch (status) {
    case "in-progress":
      return "In progress";
    case "done":
      return "Done";
    case "cancelled":
      return "Cancelled";
    case "todo":
    default:
      return "To do";
  }
}

function TimelineBar({ jobs }: { jobs: WorkerTimelineJob[] }) {
  const dayStart = 9 * 60;
  const dayEnd = 16 * 60 + 30;
  const totalMinutes = dayEnd - dayStart;

  const hourMarkers = [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
  ];

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 grid grid-cols-8 text-[11px] font-medium text-gray-500">
        {hourMarkers.map((marker) => (
          <div key={marker}>{marker}</div>
        ))}
      </div>

      <div className="relative h-20 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
        <div className="absolute inset-0 grid grid-cols-8">
          {hourMarkers.map((marker) => (
            <div key={marker} className="border-r border-gray-200 last:border-r-0" />
          ))}
        </div>

        {jobs.map((job) => {
          const start = timeToMinutes(job.startTime);
          const left = ((start - dayStart) / totalMinutes) * 100;
          const width = (job.durationMinutes / totalMinutes) * 100;

          return (
            <div
              key={job.id}
              className="absolute top-2 h-16 overflow-hidden rounded-2xl border border-green-300 bg-green-100 px-2 py-1 shadow-sm"
              style={{
                left: `${Math.max(left, 0)}%`,
                width: `${Math.max(width, 8)}%`,
              }}
              title={`${job.customerName} • ${job.startTime} • ${job.durationMinutes} mins`}
            >
              <div className="truncate text-[11px] font-semibold text-gray-900">
                {job.startTime}
              </div>
              <div className="truncate text-[11px] text-gray-800">
                {titleCase(job.customerName)}
              </div>
              {job.postcode ? (
                <div className="truncate text-[10px] text-gray-500">
                  {job.postcode.toUpperCase()}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobCard({ job }: { job: WorkerTimelineJob }) {
  const cleanedName = titleCase(job.customerName);
  const cleanedAddress = dedupeAddress(job.customerName, job.addressLine1);
  const cleanedPostcode = cleanText(job.postcode).toUpperCase();

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getBadgeStyles(
            job.category
          )}`}
        >
          {job.category || "Other"}
        </span>

        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyles(
            job.status
          )}`}
        >
          {getStatusLabel(job.status)}
        </span>
      </div>

      <div className="mb-3">
        <div className="text-2xl font-bold tracking-tight text-gray-950">
          {formatTimeRange(job.startTime, job.durationMinutes)}
        </div>
        <div className="mt-1 text-sm font-medium text-gray-500">
          {job.durationMinutes} mins
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-2xl font-semibold leading-tight text-gray-950">
          {cleanedName}
        </div>

        {cleanedAddress ? (
          <div className="text-base text-gray-600">{cleanedAddress}</div>
        ) : null}

        {cleanedPostcode ? (
          <div className="text-sm font-medium uppercase tracking-wide text-gray-500">
            {cleanedPostcode}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function WorkerTimelineDayView({
  dateLabel,
  workerName,
  jobs,
  fullDay = false,
}: WorkerTimelineDayViewProps) {
  const sortedJobs = [...jobs].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-md px-4 pb-8 pt-4">
        <div className="mb-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-950">
            Worker timeline
          </h1>
          <p className="mt-1 text-lg text-gray-500">
            Scheduled work for {dateLabel}
          </p>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-gray-950">
                {workerName}
              </h2>
              <p className="mt-1 text-lg text-gray-500">
                {sortedJobs.length} {sortedJobs.length === 1 ? "job" : "jobs"} scheduled
              </p>
            </div>

            <div
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                fullDay
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              {fullDay ? "FULL DAY" : "AVAILABLE"}
            </div>
          </div>

          <TimelineBar jobs={sortedJobs} />
        </div>

        <div className="mt-4 space-y-4">
          {sortedJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    </div>
  );
}