import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function isAdmin(role?: string | null) { return ['admin', 'office', 'manager', 'owner'].includes(clean(role).toLowerCase()) }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  if (!isAdmin(session.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const applications = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT a.*,
      COALESCE(json_agg(json_build_object(
        'id', d."id", 'documentType', d."documentType", 'documentName', d."documentName", 'createdAt', d."createdAt"
      ) ORDER BY d."createdAt") FILTER (WHERE d."id" IS NOT NULL), '[]'::json) AS "documents"
    FROM "SubcontractorApplication" a
    LEFT JOIN "SubcontractorApplicationDocument" d ON d."applicationId" = a."id"
    GROUP BY a."id"
    ORDER BY CASE a."status" WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, a."submittedAt" DESC
    LIMIT 200
  `

  return NextResponse.json({ applications })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session?.workerId) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  if (!isAdmin(session.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const applicationId = Number(body.applicationId)
  const action = clean(body.action).toLowerCase()
  const reviewNotes = clean(body.reviewNotes) || null
  if (!Number.isInteger(applicationId) || applicationId <= 0) return NextResponse.json({ error: 'Invalid application.' }, { status: 400 })

  const rows = await prisma.$queryRaw<Array<Record<string, any>>>`
    SELECT * FROM "SubcontractorApplication" WHERE "id" = ${applicationId} LIMIT 1
  `
  const application = rows[0]
  if (!application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 })

  if (action === 'reject') {
    await prisma.$executeRaw`
      UPDATE "SubcontractorApplication"
      SET "status"='rejected', "reviewedAt"=CURRENT_TIMESTAMP, "reviewedByWorkerId"=${Number(session.workerId)}, "reviewNotes"=${reviewNotes}
      WHERE "id"=${applicationId}
    `
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  if (action === 'approve') {
    if (application.status === 'approved' && application.approvedWorkerId) {
      return NextResponse.json({ ok: true, status: 'approved', workerId: application.approvedWorkerId })
    }

    const duplicate = await prisma.worker.findFirst({
      where: {
        OR: [
          ...(application.phone ? [{ phone: application.phone }] : []),
          ...(application.email ? [{ email: { equals: application.email, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: { id: true },
    })
    if (duplicate) return NextResponse.json({ error: 'A worker/subcontractor already exists with this phone or email. Review the existing profile instead of creating a duplicate.' }, { status: 409 })

    const worker = await prisma.worker.create({
      data: {
        firstName: application.firstName,
        lastName: application.lastName,
        phone: application.phone,
        email: application.email,
        active: true,
        accessLevel: 'worker',
        jobTitle: 'Subcontractor',
        employmentType: 'subcontractor',
        workAcceptanceRequired: true,
        tradingName: application.tradingName,
        utrNumber: application.utrNumber,
        cisRegistered: Boolean(application.cisRegistered),
        skills: [...(application.trades || []), ...(application.otherTrade ? [application.otherTrade] : [])],
        coverageArea: application.coverageArea,
        canDrive: Boolean(application.canDrive),
        transportRequired: !Boolean(application.canDrive),
        suppliesTools: Boolean(application.suppliesTools),
        suppliesMaterials: Boolean(application.suppliesMaterials),
        publicLiabilityInsurer: application.publicLiabilityInsurer,
        publicLiabilityPolicyNumber: application.publicLiabilityPolicyNumber,
        publicLiabilityExpiresAt: application.publicLiabilityExpiresAt,
        dayRate: application.dayRate,
      },
      select: { id: true },
    })

    const docs = await prisma.$queryRaw<Array<Record<string, any>>>`
      SELECT * FROM "SubcontractorApplicationDocument" WHERE "applicationId"=${applicationId}
    `
    for (const doc of docs) {
      await prisma.$executeRaw`
        INSERT INTO "SubcontractorDocument" ("workerId", "documentType", "documentName", "documentUrl", "reference", "createdAt")
        VALUES (${worker.id}, ${doc.documentType}, ${doc.documentName}, ${doc.documentUrl}, ${doc.pathname || null}, CURRENT_TIMESTAMP)
      `
    }

    await prisma.$executeRaw`
      UPDATE "SubcontractorApplication"
      SET "status"='approved', "reviewedAt"=CURRENT_TIMESTAMP, "reviewedByWorkerId"=${Number(session.workerId)},
          "reviewNotes"=${reviewNotes}, "approvedWorkerId"=${worker.id}
      WHERE "id"=${applicationId}
    `

    return NextResponse.json({ ok: true, status: 'approved', workerId: worker.id })
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}
