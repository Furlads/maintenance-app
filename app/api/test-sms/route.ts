export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import twilio from 'twilio'

export async function GET() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_FROM_NUMBER
    const to = process.env.TREV_ALERT_PHONE

    if (!accountSid || !authToken || !from || !to) {
      return NextResponse.json(
        {
          error:
            'Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER or TREV_ALERT_PHONE',
        },
        { status: 500 }
      )
    }

    const client = twilio(accountSid, authToken)

    const message = await client.messages.create({
      from,
      to,
      body: 'Furlads test SMS working',
    })

    return NextResponse.json({
      ok: true,
      sid: message.sid,
      status: message.status,
    })
  } catch (error) {
    console.error('GET /api/test-sms failed:', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}