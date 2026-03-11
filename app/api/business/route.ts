import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    business: null,
    message: 'Business settings are not enabled yet.'
  })
}