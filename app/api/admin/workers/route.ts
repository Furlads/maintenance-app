import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { titleCasePersonName } from "@/lib/nameCase";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildFullName(firstName: string, lastName: string) {
  return `${titleCasePersonName(firstName)} ${titleCasePersonName(lastName)}`.trim();
}

function isAdminLikeRole(role: string | null | undefined) {
  return ["admin", "office", "manager", "owner"].includes(clean(role).toLowerCase());
}

function employmentType(value: unknown) {
  return clean(value).toLowerCase() === "subcontractor" ? "subcontractor" : "employee";
}

function stringList(value: unknown) {
  const items = Array.isArray(value) ? value : clean(value).split(",");
  return [...new Set(items.map((item) => clean(item)).filter(Boolean))].slice(0, 20);
}

function optionalNumber(value: unknown, max?: number) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (max != null && number > max)) return null;
  return number;
}

const workerProfileSelect = {
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
  employmentType: true,
  dayRate: true,
  skills: true,
  transportNotes: true,
  canDrive: true,
  transportRequired: true,
  canUseCompanyTools: true,
  canUseCompanyVehicle: true,
  cisRegistered: true,
  cisVerified: true,
  cisVerificationNumber: true,
  cisDeductionRate: true,
  workAcceptanceRequired: true,
} as const;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    if (!isAdminLikeRole(session.role)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const workers = await prisma.worker.findMany({
      orderBy: [
        { active: "desc" },
        { firstName: "asc" },
        { lastName: "asc" },
      ],
      select: workerProfileSelect,
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
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    if (!isAdminLikeRole(session.role)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    const firstName = titleCasePersonName(clean(body.firstName));
    const lastName = titleCasePersonName(clean(body.lastName));
    const phone = clean(body.phone);
    const email = clean(body.email);
    const jobTitle = clean(body.jobTitle);
    const accessLevel = clean(body.accessLevel).toLowerCase() || "worker";
    const active = body.active !== false;
    const workerType = employmentType(body.employmentType);

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
        employmentType: workerType,
        dayRate: optionalNumber(body.dayRate),
        skills: stringList(body.skills),
        transportNotes: clean(body.transportNotes) || null,
        canDrive: body.canDrive !== false,
        transportRequired: !!body.transportRequired,
        canUseCompanyTools: !!body.canUseCompanyTools,
        canUseCompanyVehicle: !!body.canUseCompanyVehicle,
        cisRegistered: !!body.cisRegistered,
        cisVerified: !!body.cisVerified,
        cisVerificationNumber: clean(body.cisVerificationNumber) || null,
        cisDeductionRate: optionalNumber(body.cisDeductionRate, 100),
        workAcceptanceRequired:
          typeof body.workAcceptanceRequired === "boolean"
            ? body.workAcceptanceRequired
            : workerType === "subcontractor",
      },
      select: workerProfileSelect,
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
