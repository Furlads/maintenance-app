import twilio from 'twilio'

let cachedClient: ReturnType<typeof twilio> | null = null

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()

  if (!sid || !token) {
    throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN')
  }

  if (!cachedClient) {
    cachedClient = twilio(sid, token)
  }

  return cachedClient
}

export async function sendSms(args: { to: string; body: string }) {
  const from = process.env.TWILIO_FROM_NUMBER?.trim()

  if (!from) {
    throw new Error('Missing TWILIO_FROM_NUMBER')
  }

  const client = getClient()

  const result = await client.messages.create({
    from,
    to: args.to,
    body: args.body,
  })

  return result
}