import webpush from 'web-push'

type StoredPushSubscription = {
  endpoint: string
  p256dh: string
  auth: string
}

type PushPayload = {
  title: string
  body: string
  url?: string
  notificationId?: number
  actions?: Array<{ action: string; title: string }>
}

let configured = false

function ensureVapidConfigured() {
  if (configured) return

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject =
    process.env.VAPID_SUBJECT?.trim() || 'mailto:trevor.fudger@googlemail.com'

  if (!publicKey || !privateKey) {
    throw new Error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY')
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export async function sendPushNotification(
  subscription: StoredPushSubscription,
  payload: PushPayload
) {
  ensureVapidConfigured()

  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify(payload)
  )
}