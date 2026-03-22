'use client'

import { useState } from 'react'

type Props = {
  workerId: number
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export default function EnablePushNotifications({ workerId }: Props) {
  const [status, setStatus] = useState('')

  async function enablePush() {
    try {
      if (!('serviceWorker' in navigator)) {
        setStatus('This phone/browser does not support service workers.')
        return
      }

      if (!('PushManager' in window)) {
        setStatus('This phone/browser does not support push notifications.')
        return
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidPublicKey) {
        setStatus('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('Notification permission was not granted.')
        return
      }

      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }

      const json = subscription.toJSON()

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId,
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          userAgent: navigator.userAgent,
        }),
      })

      setStatus('Push notifications enabled.')
    } catch (error) {
      console.error(error)
      setStatus('Failed to enable push notifications.')
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-black">
        Enable job notifications
      </div>
      <button
        type="button"
        onClick={enablePush}
        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
      >
        Enable push notifications
      </button>
      {status ? <div className="mt-3 text-sm text-black/70">{status}</div> : null}
    </div>
  )
}