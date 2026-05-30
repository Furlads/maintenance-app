export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value: Date) {
  return value.toISOString();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const takeParam = Number(searchParams.get("take") || "2000");
    const take = Number.isFinite(takeParam)
      ? Math.min(Math.max(Math.round(takeParam), 1), 10000)
      : 2000;

    const logs = await prisma.activityLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take,
      include: {
        worker: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            address: true,
            customer: {
              select: {
                name: true,
                postcode: true,
              },
            },
          },
        },
      },
    });

    const rows = [
      [
        "createdAt",
        "workerId",
        "workerName",
        "eventType",
        "page",
        "jobId",
        "jobTitle",
        "customerName",
        "postcode",
        "details",
        "metadataJson",
        "userAgent",
      ],
      ...logs.map((log) => {
        const workerName =
          log.workerName ||
          `${log.worker?.firstName || ""} ${log.worker?.lastName || ""}`.trim();

        return [
          formatDate(log.createdAt),
          log.workerId || "",
          workerName,
          log.eventType,
          log.page || "",
          log.jobId || "",
          log.job?.title || "",
          log.job?.customer?.name || "",
          log.job?.customer?.postcode || "",
          log.details || "",
          log.metadataJson || "",
          log.userAgent || "",
        ];
      }),
    ];

    const csv = rows
      .map((row) => row.map((cell) => csvEscape(cell)).join(","))
      .join("\n");

    const filename = `activity-log-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/activity-log/export failed:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to export activity log" },
      { status: 500 }
    );
  }
}