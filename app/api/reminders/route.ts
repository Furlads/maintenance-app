import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json([])
}

export async function POST() {
  return NextResponse.json({
    ok: false,
    message: 'Reminders are not enabled yet.'
  })
}