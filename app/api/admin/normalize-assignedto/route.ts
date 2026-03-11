import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    ok: false,
    message: 'Assigned-to normalization is not enabled yet.'
  })
}