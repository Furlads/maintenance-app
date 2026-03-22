import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    ok: false,
    message: 'Push subscriptions are not enabled yet.'
  })
}