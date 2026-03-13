type JobType = "maintenance" | "landscaping" | "quote" | "other"

export default function JobTypeBadge({ type }: { type: JobType }) {
  const styles: Record<JobType, string> = {
    maintenance: "bg-green-100 text-green-800",
    landscaping: "bg-blue-100 text-blue-800",
    quote: "bg-yellow-100 text-yellow-800",
    other: "bg-gray-100 text-gray-800",
  }

  const labels: Record<JobType, string> = {
    maintenance: "Maintenance",
    landscaping: "Landscaping",
    quote: "Quote",
    other: "Other",
  }

  return (
    <span
      className={`text-xs font-semibold px-2 py-1 rounded ${styles[type]}`}
    >
      {labels[type]}
    </span>
  )
}