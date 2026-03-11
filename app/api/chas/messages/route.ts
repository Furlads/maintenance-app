import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    items: [],
    message: 'CHAS messages are not enabled yet.'
  })
}