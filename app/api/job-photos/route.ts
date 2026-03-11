import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Use /api/job-photos/[id] for individual photo actions.'
  })
}