import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    items: [],
    message: 'CHAS thread is not enabled yet.'
  })
}