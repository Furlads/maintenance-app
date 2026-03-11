import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    ok: false,
    message: 'Schedule rebuild is not enabled yet.'
  })
}