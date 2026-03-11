import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Use /api/blob/upload for blob uploads.'
  })
}