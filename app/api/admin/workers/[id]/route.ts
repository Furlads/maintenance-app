import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { titleCasePersonName } from "@/lib/nameCase";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

type Ctx = { params: Promise<{ id: string }> };
function isAdminLikeRole(role: string | null | undefined) { return ["admin", "office", "manager", "owner"].includes(clean(role).toLowerCase()); }
function stringList(value: unknown) { const items = Array.isArray(value) ? value : clean(value).split(","); return [...new Set(items.map((item) => clean(item)).filter(Boolean))].slice(0, 20); }
function optionalNumber(value: unknown, max?: number) { if (value === "" || value == null) return null; const number = Number(value); if (!Number.isFinite(number) || number < 0 || (max != null && number > max)) return null; return number; }
function optionalDate(value: unknown) { const raw = clean(value); if (!raw) return null; const date = new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw); return Number.isNaN(date.getTime()) ? null : date; }

const workerProfileSelect = {
  id: true, firstName: true, lastName: true, phone: true, email: true, jobTitle: true, accessLevel: true, active: true,
  createdAt: true, lastLoginAt: true, employmentType: true, dayRate: true, skills: true, transportNotes: true, canDrive: true,
  transportRequired: true, canUseCompanyTools: true, canUseCompanyVehicle: true, cisRegistered: true, cisVerified: true,
  cisVerificationNumber: true, cisDeductionRate: true, workAcceptanceRequired: true, tradingName: true, utrNumber: true,
  publicLiabilityInsurer: true, publicLiabilityPolicyNumber: true, publicLiabilityExpiresAt: true, coverageArea: true,
  suppliesTools: true, suppliesMaterials: true,
} as const;

async function extendedFields(workerId: number) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT "workSetup", "teamSize", "teamDayRate", "teamDescription", "availabilityStatus", "unavailableUntil",
      "minimumCharge", "halfDayRate", "pricingPreference", "vatRegistered", "vatNumber", "doNotUse", "doNotUseReason"
    FROM "Worker" WHERE "id"=${workerId} LIMIT 1
  `;
  return rows[0] || {};
}

export async function GET(_: Request, ctx: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    if (!isAdminLikeRole(session.role)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await ctx.params;
    const workerId = Number(id);
    if (!Number.isInteger(workerId) || workerId <= 0) return NextResponse.json({ error: "Invalid worker id" }, { status: 400 });
    const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: workerProfileSelect });
    if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    const extra = await extendedFields(workerId);
    return NextResponse.json({ worker: { ...worker, ...extra, firstName: titleCasePersonName(worker.firstName), lastName: titleCasePersonName(worker.lastName), phone: worker.phone ?? "", email: worker.email ?? "", jobTitle: worker.jobTitle ?? "", accessLevel: worker.accessLevel ?? "worker" } });
  } catch (error) {
    console.error("GET /api/admin/workers/[id] failed:", error);
    return NextResponse.json({ error: "Failed to load worker" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    if (!isAdminLikeRole(session.role)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await ctx.params;
    const workerId = Number(id);
    if (!Number.isInteger(workerId) || workerId <= 0) return NextResponse.json({ error: "Invalid worker id" }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if ("firstName" in body) { const value = titleCasePersonName(clean(body.firstName)); if (!value) return NextResponse.json({ error: "First name cannot be blank" }, { status: 400 }); updates.firstName = value; }
    if ("lastName" in body) { const value = titleCasePersonName(clean(body.lastName)); if (!value) return NextResponse.json({ error: "Last name cannot be blank" }, { status: 400 }); updates.lastName = value; }
    if ("phone" in body) updates.phone = clean(body.phone) || null;
    if ("email" in body) updates.email = clean(body.email) || null;
    if ("jobTitle" in body) updates.jobTitle = clean(body.jobTitle) || "Worker";
    if ("accessLevel" in body) updates.accessLevel = clean(body.accessLevel).toLowerCase() || "worker";
    if ("active" in body) updates.active = !!body.active;
    if ("employmentType" in body) updates.employmentType = clean(body.employmentType).toLowerCase() === "subcontractor" ? "subcontractor" : "employee";
    if ("dayRate" in body) updates.dayRate = optionalNumber(body.dayRate);
    if ("skills" in body) updates.skills = stringList(body.skills);
    if ("transportNotes" in body) updates.transportNotes = clean(body.transportNotes) || null;
    if ("canDrive" in body) updates.canDrive = !!body.canDrive;
    if ("transportRequired" in body) updates.transportRequired = !!body.transportRequired;
    if ("canUseCompanyTools" in body) updates.canUseCompanyTools = !!body.canUseCompanyTools;
    if ("canUseCompanyVehicle" in body) updates.canUseCompanyVehicle = !!body.canUseCompanyVehicle;
    if ("cisRegistered" in body) updates.cisRegistered = !!body.cisRegistered;
    if ("cisVerified" in body) updates.cisVerified = !!body.cisVerified;
    if ("cisVerificationNumber" in body) updates.cisVerificationNumber = clean(body.cisVerificationNumber) || null;
    if ("cisDeductionRate" in body) updates.cisDeductionRate = optionalNumber(body.cisDeductionRate, 100);
    if ("workAcceptanceRequired" in body) updates.workAcceptanceRequired = !!body.workAcceptanceRequired;
    if ("tradingName" in body) updates.tradingName = clean(body.tradingName) || null;
    if ("utrNumber" in body) updates.utrNumber = clean(body.utrNumber) || null;
    if ("publicLiabilityInsurer" in body) updates.publicLiabilityInsurer = clean(body.publicLiabilityInsurer) || null;
    if ("publicLiabilityPolicyNumber" in body) updates.publicLiabilityPolicyNumber = clean(body.publicLiabilityPolicyNumber) || null;
    if ("publicLiabilityExpiresAt" in body) updates.publicLiabilityExpiresAt = optionalDate(body.publicLiabilityExpiresAt);
    if ("coverageArea" in body) updates.coverageArea = clean(body.coverageArea) || null;
    if ("suppliesTools" in body) updates.suppliesTools = !!body.suppliesTools;
    if ("suppliesMaterials" in body) updates.suppliesMaterials = !!body.suppliesMaterials;

    await prisma.worker.update({ where: { id: workerId }, data: updates });

    await prisma.$executeRaw`
      UPDATE "Worker" SET
        "workSetup"=${["just_me","team","business"].includes(clean(body.workSetup)) ? clean(body.workSetup) : 'just_me'},
        "teamSize"=${optionalNumber(body.teamSize)},
        "teamDayRate"=${optionalNumber(body.teamDayRate)},
        "teamDescription"=${clean(body.teamDescription) || null},
        "availabilityStatus"=${["available","limited","unavailable"].includes(clean(body.availabilityStatus)) ? clean(body.availabilityStatus) : 'available'},
        "unavailableUntil"=${optionalDate(body.unavailableUntil)},
        "minimumCharge"=${optionalNumber(body.minimumCharge)},
        "halfDayRate"=${optionalNumber(body.halfDayRate)},
        "pricingPreference"=${["labour_only","labour_materials","either"].includes(clean(body.pricingPreference)) ? clean(body.pricingPreference) : 'either'},
        "vatRegistered"=${!!body.vatRegistered},
        "vatNumber"=${clean(body.vatNumber) || null},
        "doNotUse"=${!!body.doNotUse},
        "doNotUseReason"=${clean(body.doNotUseReason) || null}
      WHERE "id"=${workerId}
    `;

    const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: workerProfileSelect });
    if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    const extra = await extendedFields(workerId);
    return NextResponse.json({ success: true, worker: { ...worker, ...extra, firstName: titleCasePersonName(worker.firstName), lastName: titleCasePersonName(worker.lastName), phone: worker.phone ?? "", email: worker.email ?? "", jobTitle: worker.jobTitle ?? "", accessLevel: worker.accessLevel ?? "worker" } });
  } catch (error) {
    console.error("PATCH /api/admin/workers/[id] failed:", error);
    return NextResponse.json({ error: "Failed to update worker" }, { status: 500 });
  }
}
