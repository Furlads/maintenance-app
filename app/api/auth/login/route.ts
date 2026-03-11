import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    ok: false,
    message: 'Server login is not enabled yet. Use worker selection for now.'
  })
}