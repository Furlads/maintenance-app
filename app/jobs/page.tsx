import Link from "next/link"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function formatDate(date: Date | null) {
  if (!date) return "Not scheduled"

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date))
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    unscheduled: "bg-zinc-100 text-zinc-700",
    scheduled: "bg-blue-100 text-blue-700",
    inprogress: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700"
  }

  return (
    <span
      className={`text-xs px-2 py-1 rounded-lg font-medium ${
        styles[status] ?? "bg-zinc-100 text-zinc-700"
      }`}
    >
      {status}
    </span>
  )
}

export default async function JobsPage() {

  const jobs = await prisma.job.findMany({
    include: {
      customer: true,
      assignments: {
        include: {
          worker: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  })

  return (
    <div className="space-y-6">

      {/* Page Header */}

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-2xl font-bold">
            Jobs
          </h1>

          <p className="text-sm text-zinc-500">
            Manage landscaping and maintenance work
          </p>
        </div>

        <Link
          href="/jobs/add"
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Add Job
        </Link>

      </div>

      {/* Jobs List */}

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">

        <table className="w-full text-sm">

          <thead className="bg-zinc-50 border-b border-zinc-200">

            <tr className="text-left">

              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Visit Date</th>
              <th className="px-4 py-3 font-medium">Workers</th>
              <th className="px-4 py-3 font-medium">Status</th>

            </tr>

          </thead>

          <tbody>

            {jobs.length === 0 && (

              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  No jobs yet
                </td>
              </tr>

            )}

            {jobs.map((job) => (

              <tr
                key={job.id}
                className="border-b border-zinc-100 hover:bg-zinc-50"
              >

                {/* Customer */}

                <td className="px-4 py-3">

                  <Link
                    href={`/jobs/${job.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {job.customer?.name ?? "Unknown"}
                  </Link>

                </td>

                {/* Address */}

                <td className="px-4 py-3 text-zinc-600">
                  {job.address}
                </td>

                {/* Job Type */}

                <td className="px-4 py-3 text-zinc-600">
                  {job.jobType}
                </td>

                {/* Visit Date */}

                <td className="px-4 py-3 text-zinc-600">
                  {formatDate(job.visitDate)}
                </td>

                {/* Workers */}

                <td className="px-4 py-3 text-zinc-600">

                  {job.assignments.length === 0 && "Unassigned"}

                  {job.assignments.map(a => a.worker.firstName).join(", ")}

                </td>

                {/* Status */}

                <td className="px-4 py-3">
                  <StatusBadge status={job.status} />
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  )
}