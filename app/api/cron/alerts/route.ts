export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { processDueAlerts } from '@/lib/notifications'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null

    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || bearerToken !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await processDueAlerts(100)

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/cron/alerts failed:', error)

    return NextResponse.json(
      { error: 'Failed to process alerts' },
      { status: 500 }
    )
  }
}