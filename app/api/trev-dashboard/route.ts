import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import * as prismaModule from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any;

type SessionData = {
  workerId?: number;
  workerName?: string;
  workerAccessLevel?: string;
};

type JobCard = {
  id: number;
  title: string;
  jobType: string;
  status: string;
  visitDate: Date | null;
  startTime: string | null;
  durationMinutes: number | null;
  address: string;
  notes: string | null;
  createdAt: Date;
  arrivedAt: Date | null;
  pausedAt: Date | null;
  finishedAt: Date | null;
  customer: {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    postcode: string | null;
  } | null;
  assignments?: Array<{
    id: number;
    workerId: number;
    worker: {
      id: number;
      firstName: string;
      lastName: string;
    };
  }>;
};

type InboxMessageRow = {
  id: number;
  conversationId: string | null;
  source: string;
  senderName: string | null;
  senderEmail: string | null;
  senderPhone: string | null;
  subject: string | null;
  preview: string | null;
  body: string | null;
  status: string;
  customerId: number | null;
  jobId: number | null;
  createdAt: Date;
  conversation: {
    id: string;
    source: string;
    contactName: string | null;
    contactRef: string | null;
    archived: boolean;
    createdAt: Date;
  } | null;
};

type ThreadCard = {
  threadKey: string;
  conversationId: string;
  displayName: string;
  displayContact: string;
  latestPreview: string;
  latestStatus: string;
  latestTime: Date;
  source: string;
  businessLabel: string;
  messageCount: number;
  hasConversation: boolean;
};

type TeamLiveCard = {
  workerId: number;
  workerName: string;
  job: JobCard | null;
  statusLabel: string;
  statusTone: "green" | "yellow" | "blue" | "zinc";
  withWorkers: string[];
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function londonNow() {
  return new Date();
}

function getLondonDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const weekday = parts.find((part) => part.type === "weekday")?.value;

  if (!year || !month || !day || !weekday) {
    throw new Error("Failed to build London date parts");
  }

  return { year, month, day, weekday };
}

function startOfLondonDayUtc(date: Date) {
  const { year, month, day } = getLondonDateParts(date);
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

function nextLondonDayUtc(date: Date) {
  const start = startOfLondonDayUtc(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function startOfLondonWeekUtc(date: Date) {
  const weekday = getLondonDateParts(date).weekday;
  const start = startOfLondonDayUtc(date);

  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  const offset = map[weekday] ?? 0;
  return new Date(start.getTime() - offset * 24 * 60 * 60 * 1000);
}

function isQuoteJob(job: { jobType?: string | null; title?: string | null }) {
  const type = cleanString(job.jobType).toLowerCase();
  const title = cleanString(job.title).toLowerCase();
  return type === "quote" || title === "quote";
}

function normaliseSource(value: string) {
  const source = String(value || "").toLowerCase();

  if (source.includes("threecounties")) return "threecounties-email";
  if (source.includes("furlads")) return "furlads-email";
  if (source.includes("whatsapp")) return "whatsapp";
  if (source.includes("facebook")) return "facebook";
  if (source.includes("wix")) return "wix";
  return "worker-quote";
}

function buildPreview(message: InboxMessageRow) {
  if (message.preview && message.preview.trim()) {
    return message.preview.trim().replace(/\s+/g, " ");
  }

  if (message.subject && message.subject.trim()) {
    return message.subject.trim().replace(/\s+/g, " ");
  }

  if (message.body && message.body.trim()) {
    return message.body.trim().replace(/\s+/g, " ");
  }

  return "No message preview yet.";
}

function buildDisplayName(message: InboxMessageRow) {
  if (message.conversation?.contactName?.trim()) return message.conversation.contactName.trim();
  if (message.senderName?.trim()) return message.senderName.trim();
  if (message.senderEmail?.trim()) return message.senderEmail.trim();
  if (message.senderPhone?.trim()) return message.senderPhone.trim();
  if (message.conversation?.contactRef?.trim()) return message.conversation.contactRef.trim();
  return "Unknown sender";
}

function buildDisplayContact(message: InboxMessageRow) {
  if (message.senderPhone?.trim()) return message.senderPhone.trim();
  if (message.senderEmail?.trim()) return message.senderEmail.trim();
  if (message.conversation?.contactRef?.trim()) return message.conversation.contactRef.trim();
  return "No contact details yet";
}

function buildThreadKey(message: InboxMessageRow) {
  const senderPhone = cleanString(message.senderPhone);
  const senderEmail = cleanString(message.senderEmail);
  const contactRef = cleanString(message.conversation?.contactRef);

  if (senderPhone) return `phone:${senderPhone.replace(/\s+/g, "")}`;
  if (senderEmail) return `email:${senderEmail.toLowerCase()}`;
  if (contactRef) return `ref:${contactRef.toLowerCase()}`;
  if (message.conversationId) return message.conversationId;

  return `message-${message.id}`;
}

function detectBusinessLabel(message: InboxMessageRow) {
  const source = normaliseSource(message.source);
  const contactName = String(message.conversation?.contactName || "").toLowerCase();
  const senderName = String(message.senderName || "").toLowerCase();
  const contactRef = String(message.conversation?.contactRef || "").toLowerCase();
  const joined = `${contactName} ${senderName} ${contactRef}`;

  if (source === "threecounties-email") return "Three Counties";
  if (source === "worker-quote") return "Internal";

  if (joined.includes("three counties") || joined.includes("threecounties")) {
    return "Three Counties";
  }

  return "Furlads";
}

function buildThreads(messages: InboxMessageRow[]): ThreadCard[] {
  const grouped = new Map<string, InboxMessageRow[]>();

  for (const message of messages) {
    const key = buildThreadKey(message);

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)!.push(message);
  }

  const threads: ThreadCard[] = [];

  for (const [threadKey, items] of grouped.entries()) {
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const latest = sorted[0];

    threads.push({
      threadKey,
      conversationId: latest.conversationId || threadKey,
      displayName: buildDisplayName(latest),
      displayContact: buildDisplayContact(latest),
      latestPreview: buildPreview(latest),
      latestStatus: latest.status,
      latestTime: latest.createdAt,
      source: latest.source,
      businessLabel: detectBusinessLabel(latest),
      messageCount: sorted.length,
      hasConversation: Boolean(latest.conversationId),
    });
  }

  return threads.sort(
    (a, b) => new Date(b.latestTime).getTime() - new Date(a.latestTime).getTime()
  );
}

function statusIsUnread(status: string) {
  return String(status || "").toLowerCase() === "unread";
}

function buildTeamLiveCards(workers: any[]): TeamLiveCard[] {
  const cards: TeamLiveCard[] = [];

  for (const worker of workers) {
    const jobs: JobCard[] = Array.isArray(worker.assignedJobs)
      ? worker.assignedJobs
          .map((assignment: any) => assignment.job)
          .filter(Boolean)
          .sort((a: JobCard, b: JobCard) => {
            const aStarted = a.arrivedAt && !a.finishedAt ? 0 : 1;
            const bStarted = b.arrivedAt && !b.finishedAt ? 0 : 1;

            if (aStarted !== bStarted) return aStarted - bStarted;

            const aFinished = a.finishedAt ? 1 : 0;
            const bFinished = b.finishedAt ? 1 : 0;

            if (aFinished !== bFinished) return aFinished - bFinished;

            const aTime = cleanString(a.startTime);
            const bTime = cleanString(b.startTime);

            return aTime.localeCompare(bTime);
          })
      : [];

    const currentJob = jobs[0] || null;

    if (!currentJob) {
      cards.push({
        workerId: worker.id,
        workerName:
          `${worker.firstName || ""} ${worker.lastName || ""}`.trim() || `Worker #${worker.id}`,
        job: null,
        statusLabel: "Free / no job showing",
        statusTone: "zinc",
        withWorkers: [],
      });
      continue;
    }

    let statusLabel: TeamLiveCard["statusLabel"] = "Travelling";
    let statusTone: TeamLiveCard["statusTone"] = "blue";

    if (currentJob.finishedAt) {
      statusLabel = "Finished";
      statusTone = "zinc";
    } else if (currentJob.arrivedAt && currentJob.pausedAt && !currentJob.finishedAt) {
      statusLabel = "Paused";
      statusTone = "yellow";
    } else if (currentJob.arrivedAt && !currentJob.finishedAt) {
      statusLabel = "On site";
      statusTone = "green";
    } else {
      statusLabel = "Travelling";
      statusTone = "blue";
    }

    const withWorkers =
      currentJob.assignments
        ?.map((assignment) => assignment.worker)
        .filter((assignedWorker) => assignedWorker.id !== worker.id)
        .map((assignedWorker) => `${assignedWorker.firstName} ${assignedWorker.lastName}`.trim())
        .filter(Boolean) || [];

    cards.push({
      workerId: worker.id,
      workerName:
        `${worker.firstName || ""} ${worker.lastName || ""}`.trim() || `Worker #${worker.id}`,
      job: currentJob,
      statusLabel,
      statusTone,
      withWorkers,
    });
  }

  return cards.sort((a, b) => a.workerName.localeCompare(b.workerName));
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const rawSession = cookieStore.get("furlads_session")?.value;

    if (!rawSession) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    let session: SessionData | null = null;

    try {
      session = JSON.parse(rawSession);
    } catch {
      session = null;
    }

    if (!session?.workerId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const now = londonNow();
    const dayStart = startOfLondonDayUtc(now);
    const dayEnd = nextLondonDayUtc(now);
    const weekStart = startOfLondonWeekUtc(now);

    const myJobsRaw = await prisma.job.findMany({
      where: {
        visitDate: {
          gte: dayStart,
          lt: dayEnd,
        },
        status: {
          notIn: ["archived", "cancelled"],
        },
        assignments: {
          some: {
            workerId: session.workerId,
          },
        },
      },
      select: {
        id: true,
        title: true,
        jobType: true,
        status: true,
        visitDate: true,
        startTime: true,
        durationMinutes: true,
        address: true,
        notes: true,
        createdAt: true,
        arrivedAt: true,
        pausedAt: true,
        finishedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
            postcode: true,
          },
        },
        assignments: {
          select: {
            id: true,
            workerId: true,
            worker: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
    });

    const myJobs: JobCard[] = myJobsRaw;
    const myQuoteVisits = myJobs.filter((job) => isQuoteJob(job));
    const myAssignedJobs = myJobs.filter((job) => !isQuoteJob(job));

    const teamWorkersRaw = await prisma.worker.findMany({
      where: {
        active: true,
      },
      include: {
        assignedJobs: {
          where: {
            job: {
              visitDate: {
                gte: dayStart,
                lt: dayEnd,
              },
              status: {
                notIn: ["archived", "cancelled"],
              },
            },
          },
          include: {
            job: {
              select: {
                id: true,
                title: true,
                jobType: true,
                status: true,
                visitDate: true,
                startTime: true,
                durationMinutes: true,
                address: true,
                notes: true,
                createdAt: true,
                arrivedAt: true,
                pausedAt: true,
                finishedAt: true,
                customer: {
                  select: {
                    id: true,
                    name: true,
                    phone: true,
                    email: true,
                    address: true,
                    postcode: true,
                  },
                },
                assignments: {
                  select: {
                    id: true,
                    workerId: true,
                    worker: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    const teamLive = buildTeamLiveCards(teamWorkersRaw);
    const activeTeamCount = teamLive.filter(
      (card) => card.job && card.statusLabel !== "Finished"
    ).length;
    const needsAttention = teamLive.filter((card) => card.statusLabel === "Paused").length;

    const inboxMessages = (await prisma.inboxMessage.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 250,
      include: {
        conversation: true,
      },
      where: {
        OR: [{ conversation: { archived: false } }, { conversation: null }],
      },
    })) as InboxMessageRow[];

    const allThreads = buildThreads(inboxMessages);
    const unreadThreads = allThreads.filter((thread) => statusIsUnread(thread.latestStatus));
    const workerQuoteThreads = allThreads.filter(
      (thread) => normaliseSource(thread.source) === "worker-quote"
    );
    const trevInboxThreads = allThreads
      .filter(
        (thread) =>
          statusIsUnread(thread.latestStatus) ||
          normaliseSource(thread.source) === "worker-quote"
      )
      .slice(0, 8);

    const jobsCompletedToday = await prisma.job.count({
      where: {
        finishedAt: {
          gte: dayStart,
          lt: dayEnd,
        },
        status: {
          notIn: ["archived", "cancelled"],
        },
      },
    });

    const jobsCompletedThisWeek = await prisma.job.count({
      where: {
        finishedAt: {
          gte: weekStart,
          lt: dayEnd,
        },
        status: {
          notIn: ["archived", "cancelled"],
        },
      },
    });

    const quotesThisWeek = await prisma.job.count({
      where: {
        visitDate: {
          gte: weekStart,
          lt: dayEnd,
        },
        status: {
          notIn: ["archived", "cancelled"],
        },
        OR: [{ jobType: "Quote" }, { title: "Quote" }],
      },
    });

    const enquiriesThisWeek = await prisma.inboxMessage.count({
      where: {
        createdAt: {
          gte: weekStart,
          lt: dayEnd,
        },
      },
    });

    return NextResponse.json({
      session: {
        workerId: session.workerId,
        workerName: session.workerName || `Worker #${session.workerId}`,
        workerAccessLevel: session.workerAccessLevel || "worker",
      },
      generatedAt: now.toISOString(),
      summary: {
        activeTeamCount,
        myAssignedJobsCount: myAssignedJobs.length,
        myQuoteVisitsCount: myQuoteVisits.length,
        unreadThreadsCount: unreadThreads.length,
        needsAttention,
        jobsCompletedToday,
        jobsCompletedThisWeek,
        quotesThisWeek,
        enquiriesThisWeek,
        workerQuoteThreadsCount: workerQuoteThreads.length,
      },
      myAssignedJobs,
      myQuoteVisits,
      teamLive,
      trevInboxThreads,
    });
  } catch (error) {
    console.error("GET /api/trev-dashboard failed:", error);

    return NextResponse.json(
      { error: "Failed to load Trev dashboard" },
      { status: 500 }
    );
  }
}