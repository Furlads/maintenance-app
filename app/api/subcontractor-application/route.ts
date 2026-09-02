import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

function clean(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function bool(value: FormDataEntryValue | null) {
  return clean(value) === 'true' || clean(value) === 'on' || clean(value) === '1'
}

function intOrNull(value: FormDataEntryValue | null) {
  const raw = clean(value)
  if (!raw) return null
  const n = Number(raw)
  return Number.isInteger(n) ? n : null
}

function floatOrNull(value: FormDataEntryValue | null) {
  const raw = clean(value).replace(/[^0-9.-]/g, '')
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function dateOrNull(value: FormDataEntryValue | null) {
  const raw = clean(value)
  if (!raw) return null
  const d = new Date(`${raw}T12:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const firstName = clean(form.get('firstName'))
    const lastName = clean(form.get('lastName'))
    const email = clean(form.get('email')).toLowerCase()
    const phone = clean(form.get('phone'))
    const trades = form.getAll('trades').map((value) => clean(value)).filter(Boolean)
    const privacyConsent = bool(form.get('privacyConsent'))
    const declarationAccepted = bool(form.get('declarationAccepted'))
    const workSetup = ['just_me', 'team', 'business'].includes(clean(form.get('workSetup'))) ? clean(form.get('workSetup')) : 'just_me'
    const teamSize = intOrNull(form.get('teamSize'))
    const teamDayRate = floatOrNull(form.get('teamDayRate'))
    const teamDescription = clean(form.get('teamDescription')) || null
    const minimumCharge = floatOrNull(form.get('minimumCharge'))
    const halfDayRate = floatOrNull(form.get('halfDayRate'))
    const pricingPreference = ['labour_only', 'labour_materials', 'either'].includes(clean(form.get('pricingPreference'))) ? clean(form.get('pricingPreference')) : 'either'
    const vatRegistered = bool(form.get('vatRegistered'))

    if (!firstName || !lastName || !email || !phone) {
      return NextResponse.json({ error: 'Name, email and mobile number are required.' }, { status: 400 })
    }
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }
    if (!trades.length && !clean(form.get('otherTrade'))) {
      return NextResponse.json({ error: 'Select at least one trade or tell us your trade.' }, { status: 400 })
    }
    if (!privacyConsent || !declarationAccepted) {
      return NextResponse.json({ error: 'Privacy consent and the subcontractor declaration are required.' }, { status: 400 })
    }

    const rows = await prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "SubcontractorApplication" (
        "firstName", "lastName", "tradingName", "email", "phone", "address", "postcode",
        "companyNumber", "vatNumber", "utrNumber", "cisRegistered", "trades", "otherTrade",
        "yearsExperience", "coverageArea", "maxTravelMiles", "canDrive", "hasOwnVehicle",
        "suppliesTools", "suppliesMaterials", "worksForOthers", "fixesOwnDefects", "comfortableFixedPrice",
        "hasEmployees", "publicLiabilityInsurer", "publicLiabilityPolicyNumber", "publicLiabilityExpiresAt",
        "publicLiabilityCover", "qualifications", "availability", "preferredWork", "dayRate",
        "referenceOne", "referenceTwo", "additionalNotes", "privacyConsent", "declarationAccepted",
        "workSetup", "teamSize", "teamDayRate", "teamDescription", "minimumCharge", "halfDayRate",
        "pricingPreference", "vatRegistered"
      ) VALUES (
        ${firstName}, ${lastName}, ${clean(form.get('tradingName')) || null}, ${email}, ${phone},
        ${clean(form.get('address')) || null}, ${clean(form.get('postcode')) || null},
        ${clean(form.get('companyNumber')) || null}, ${clean(form.get('vatNumber')) || null}, ${clean(form.get('utrNumber')) || null},
        ${bool(form.get('cisRegistered'))}, ${trades}, ${clean(form.get('otherTrade')) || null},
        ${intOrNull(form.get('yearsExperience'))}, ${clean(form.get('coverageArea')) || null}, ${intOrNull(form.get('maxTravelMiles'))},
        ${bool(form.get('canDrive'))}, ${bool(form.get('hasOwnVehicle'))}, ${bool(form.get('suppliesTools'))}, ${bool(form.get('suppliesMaterials'))},
        ${bool(form.get('worksForOthers'))}, ${bool(form.get('fixesOwnDefects'))}, ${bool(form.get('comfortableFixedPrice'))}, ${workSetup !== 'just_me'},
        ${clean(form.get('publicLiabilityInsurer')) || null}, ${clean(form.get('publicLiabilityPolicyNumber')) || null}, ${dateOrNull(form.get('publicLiabilityExpiresAt'))},
        ${clean(form.get('publicLiabilityCover')) || null}, ${clean(form.get('qualifications')) || null}, ${clean(form.get('availability')) || null},
        ${clean(form.get('preferredWork')) || null}, ${floatOrNull(form.get('dayRate'))}, ${clean(form.get('referenceOne')) || null},
        ${clean(form.get('referenceTwo')) || null}, ${clean(form.get('additionalNotes')) || null}, ${privacyConsent}, ${declarationAccepted},
        ${workSetup}, ${teamSize}, ${teamDayRate}, ${teamDescription}, ${minimumCharge}, ${halfDayRate}, ${pricingPreference}, ${vatRegistered}
      ) RETURNING "id"
    `

    const applicationId = rows[0]?.id
    if (!applicationId) throw new Error('Application was not created.')

    const uploads: Array<{ field: string; type: string }> = [
      { field: 'insuranceDocument', type: 'public_liability' },
      { field: 'utrDocument', type: 'utr_cis' },
      { field: 'qualificationDocuments', type: 'qualification' },
      { field: 'workPhotos', type: 'work_example' },
    ]

    for (const upload of uploads) {
      for (const entry of form.getAll(upload.field)) {
        if (!(entry instanceof File) || !entry.size) continue
        if (entry.size > MAX_FILE_BYTES) {
          return NextResponse.json({ error: `${entry.name} is too large. Maximum file size is 10MB.` }, { status: 400 })
        }
        if (!ALLOWED_TYPES.has(entry.type)) {
          return NextResponse.json({ error: `${entry.name} must be a PDF, JPG, PNG or WebP file.` }, { status: 400 })
        }

        const pathname = `subcontractor-applications/${applicationId}/${upload.type}/${Date.now()}-${safeName(entry.name || 'document')}`
        const blob = await put(pathname, entry, { access: 'private' })
        await prisma.$executeRaw`
          INSERT INTO "SubcontractorApplicationDocument"
            ("applicationId", "documentType", "documentName", "documentUrl", "pathname", "contentType")
          VALUES
            (${applicationId}, ${upload.type}, ${entry.name || 'document'}, ${blob.url}, ${blob.pathname}, ${entry.type || null})
        `
      }
    }

    return NextResponse.json({ ok: true, applicationId }, { status: 201 })
  } catch (error) {
    console.error('SUBCONTRACTOR_APPLICATION_ERROR', error)
    return NextResponse.json({ error: 'We could not submit the application. Please try again.' }, { status: 500 })
  }
}
