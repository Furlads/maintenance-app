type LogActivityInput = {
  workerId?: number | null;
  workerName?: string | null;
  jobId?: number | null;
  eventType: string;
  page?: string | null;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logActivity(input: LogActivityInput) {
  try {
    await fetch("/api/activity-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        workerId: input.workerId ?? null,
        workerName: input.workerName ?? null,
        jobId: input.jobId ?? null,
        eventType: input.eventType,
        page: input.page ?? null,
        details: input.details ?? null,
        metadata: input.metadata ?? null,
      }),
    });
  } catch (error) {
    console.warn("Activity log failed:", error);
  }
}