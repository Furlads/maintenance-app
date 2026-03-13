import Link from "next/link"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function formatDate(date: Date | null) {
  if (!date) return "Not scheduled"

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

function formatWorkers(
  assignments: Array<{
    worker: {
      firstName: string
      lastName: string
    }
  }>
) {
  if (!assignments || assignments.length === 0) return "Unassigned"

  return assignments
    .map((assignment) => `${assignment.worker.firstName} ${assignment.worker.lastName}`)
    .join(", ")
}

function formatStatus(status: string) {
  const value = String(status || "").replaceAll("_", " ").trim()

  if (!value) return "Unknown"

  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatJobType(jobType: string) {
  const value = String(jobType || "").trim()
  return value || "General"
}

function formatStartTime(startTime: string | null) {
  if (!startTime) return "No time set"
  return startTime
}

function statusBadgeClass(status: string) {
  const value = String(status || "").toLowerCase()

  if (value === "done" || value === "completed") {
    return "bg-green-100 text-green-800 ring-green-200"
  }

  if (value === "inprogress" || value === "in_progress") {
    return "bg-blue-100 text-blue-800 ring-blue-200"
  }

  if (value === "scheduled" || value === "todo") {
    return "bg-amber-100 text-amber-800 ring-amber-200"
  }

  if (value === "paused") {
    return "bg-orange-100 text-orange-800 ring-orange-200"
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200"
}

function typeBadgeClass(jobType: string) {
  const value = String(jobType || "").toLowerCase()

  if (value.includes("maint")) {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200"
  }

  if (value.includes("land")) {
    return "bg-sky-100 text-sky-800 ring-sky-200"
  }

  if (value.includes("quote")) {
    return "bg-amber-100 text-amber-800 ring-amber-200"
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200"
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode
  className: string
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div
        className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
          accent || "text-zinc-500"
        }`}
      >
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-zinc-900">{value}</div>
    </div>
  )
}

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({
    include: {
      customer: true,
      assignments: {
        include: {
          worker: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  const maintenanceCount = jobs.filter((job) =>
    String(job.jobType || "").toLowerCase().includes("maint")
  ).length

  const landscapingCount = jobs.filter((job) =>
    String(job.jobType || "").toLowerCase().includes("land")
  ).length

  const quoteCount = jobs.filter((job) =>
    String(job.jobType || "").toLowerCase().includes("quote")
  ).length

  const doneCount = jobs.filter((job) => {
    const value = String(job.status || "").toLowerCase()
    return value === "done" || value === "completed"
  }).length

  const todoCount = jobs.filter((job) => {
    const value = String(job.status || "").toLowerCase()
    return value === "scheduled" || value === "todo"
  }).length

  const inProgressCount = jobs.filter((job) => {
    const value = String(job.status || "").toLowerCase()
    return value === "inprogress" || value === "in_progress"
  }).length

  const unassignedCount = jobs.filter((job) => job.assignments.length === 0).length

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 lg:px-8">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="bg-zinc-900 px-5 py-5 text-white md:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
                    Furlads Jobs
                  </div>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
                    Jobs
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-zinc-300 md:text-base">
                    Manage landscaping jobs, maintenance visits, worker assignments,
                    schedules and progress in one place.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/admin"
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                  >
                    Back to Dashboard
                  </Link>

                  <Link
                    href="/jobs/add"
                    className="inline-flex items-center justify-center rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-900 transition hover:bg-yellow-300"
                  >
                    + Add Job
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4 xl:grid-cols-8 md:p-5">
              <StatCard label="Total jobs" value={jobs.length} />
              <StatCard label="Maintenance" value={maintenanceCount} />
              <StatCard label="Landscaping" value={landscapingCount} />
              <StatCard label="Quotes" value={quoteCount} />
              <StatCard label="To do" value={todoCount} accent="text-amber-600" />
              <StatCard label="In progress" value={inProgressCount} accent="text-blue-600" />
              <StatCard label="Completed" value={doneCount} accent="text-green-600" />
              <StatCard label="Unassigned" value={unassignedCount} accent="text-red-600" />
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 md:px-5">
              Landscaping jobs, maintenance visits and quotes all stay in one list.
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">All jobs</h2>
                <p className="text-sm text-zinc-500">
                  Open or edit any job to manage timings, notes, workers and details.
                </p>
              </div>

              <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-600">
                {jobs.length} total
              </div>
            </div>

            {jobs.length === 0 ? (
              <div className="p-5">
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
                  No jobs yet.
                </div>
              </div>
            ) : (
              <>
                <div className="hidden xl:block">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50">
                        <tr className="text-left">
                          <th className="px-5 py-4 font-bold text-zinc-700">Customer / Job</th>
                          <th className="px-5 py-4 font-bold text-zinc-700">Address</th>
                          <th className="px-5 py-4 font-bold text-zinc-700">Type</th>
                          <th className="px-5 py-4 font-bold text-zinc-700">Visit Date</th>
                          <th className="px-5 py-4 font-bold text-zinc-700">Start</th>
                          <th className="px-5 py-4 font-bold text-zinc-700">Workers</th>
                          <th className="px-5 py-4 font-bold text-zinc-700">Status</th>
                          <th className="px-5 py-4 font-bold text-zinc-700">Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {jobs.map((job) => (
                          <tr
                            key={job.id}
                            className="border-t border-zinc-100 align-top transition hover:bg-zinc-50"
                          >
                            <td className="px-5 py-4">
                              <div className="font-semibold text-zinc-900">
                                {job.customer?.name ?? "Unknown"}
                              </div>
                              <div className="mt-1 text-sm text-zinc-600">
                                {job.title || "Untitled job"}
                              </div>
                              <div className="mt-2 text-xs text-zinc-400">Job #{job.id}</div>
                            </td>

                            <td className="px-5 py-4 text-zinc-600">
                              <div className="max-w-[280px] whitespace-pre-line">
                                {job.address || "No address"}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <Pill className={typeBadgeClass(job.jobType || "")}>
                                {formatJobType(job.jobType || "")}
                              </Pill>
                            </td>

                            <td className="px-5 py-4 text-zinc-600">
                              {formatDate(job.visitDate)}
                            </td>

                            <td className="px-5 py-4 text-zinc-600">
                              {formatStartTime(job.startTime)}
                            </td>

                            <td className="px-5 py-4 text-zinc-600">
                              <div className="max-w-[220px]">
                                {formatWorkers(job.assignments)}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <Pill className={statusBadgeClass(job.status || "")}>
                                {formatStatus(job.status || "")}
                              </Pill>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/jobs/${job.id}`}
                                  className="inline-flex min-w-[82px] items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                                >
                                  Open
                                </Link>

                                <Link
                                  href={`/jobs/edit/${job.id}`}
                                  className="inline-flex min-w-[82px] items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-black"
                                >
                                  Edit
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-4 p-4 xl:hidden">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill className={typeBadgeClass(job.jobType || "")}>
                          {formatJobType(job.jobType || "")}
                        </Pill>
                        <Pill className={statusBadgeClass(job.status || "")}>
                          {formatStatus(job.status || "")}
                        </Pill>
                      </div>

                      <div className="mt-4">
                        <div className="text-lg font-bold text-zinc-900">
                          {job.customer?.name ?? "Unknown"}
                        </div>
                        <div className="mt-1 text-sm font-medium text-zinc-600">
                          {job.title || "Untitled job"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">Job #{job.id}</div>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-zinc-700">
                        <div className="rounded-xl bg-zinc-50 px-3 py-2">
                          <span className="font-semibold text-zinc-900">Address:</span>{" "}
                          {job.address || "No address"}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-zinc-50 px-3 py-2">
                            <span className="font-semibold text-zinc-900">Visit Date:</span>{" "}
                            {formatDate(job.visitDate)}
                          </div>

                          <div className="rounded-xl bg-zinc-50 px-3 py-2">
                            <span className="font-semibold text-zinc-900">Start:</span>{" "}
                            {formatStartTime(job.startTime)}
                          </div>
                        </div>

                        <div className="rounded-xl bg-zinc-50 px-3 py-2">
                          <span className="font-semibold text-zinc-900">Workers:</span>{" "}
                          {formatWorkers(job.assignments)}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                        >
                          Open
                        </Link>

                        <Link
                          href={`/jobs/edit/${job.id}`}
                          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-black"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}