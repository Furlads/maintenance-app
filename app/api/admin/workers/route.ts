import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { titleCasePersonName } from "@/lib/nameCase";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildFullName(firstName: string, lastName: string) {
  return `${titleCasePersonName(firstName)} ${titleCasePersonName(lastName)}`.trim();
}

export async function GET() {
  try {
    const workers = await prisma.worker.findMany({
      orderBy: [
        { active: "desc" },
        { firstName: "asc" },
        { lastName: "asc" },
      ],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        jobTitle: true,
        accessLevel: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return NextResponse.json({
      workers: workers.map((worker) => ({
        ...worker,
        firstName: titleCasePersonName(worker.firstName),
        lastName: titleCasePersonName(worker.lastName),
        fullName: buildFullName(worker.firstName, worker.lastName),
        phone: worker.phone ?? "",
        email: worker.email ?? "",
        jobTitle: worker.jobTitle ?? "",
        accessLevel: worker.accessLevel ?? "worker",
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/workers failed:", error);
    return NextResponse.json(
      { error: "Failed to load workers" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const firstName = titleCasePersonName(clean(body.firstName));
    const lastName = titleCasePersonName(clean(body.lastName));
    const phone = clean(body.phone);
    const email = clean(body.email);
    const jobTitle = clean(body.jobTitle);
    const accessLevel = clean(body.accessLevel).toLowerCase() || "worker";
    const active = body.active !== false;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }

    const worker = await prisma.worker.create({
      data: {
        firstName,
        lastName,
        phone: phone || null,
        email: email || null,
        jobTitle: jobTitle || "Worker",
        accessLevel,
        active,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        jobTitle: true,
        accessLevel: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      worker: {
        ...worker,
        firstName: titleCasePersonName(worker.firstName),
        lastName: titleCasePersonName(worker.lastName),
        fullName: buildFullName(worker.firstName, worker.lastName),
        phone: worker.phone ?? "",
        email: worker.email ?? "",
        jobTitle: worker.jobTitle ?? "",
        accessLevel: worker.accessLevel ?? "worker",
      },
    });
  } catch (error) {
    console.error("POST /api/admin/workers failed:", error);
    return NextResponse.json(
      { error: "Failed to create worker" },
      { status: 500 }
    );
  }
}
