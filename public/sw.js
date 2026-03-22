self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = {
      title: 'Furlads',
      body: event.data.text(),
    }
  }

  const title = payload.title || 'Furlads'
  const body = payload.body || ''
  const url = payload.url || '/today'
  const notificationId = payload.notificationId
  const actions = Array.isArray(payload.actions) ? payload.actions : []

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: {
        url,
        notificationId,
      },
      actions,
      badge: '/icon-192.png',
      icon: '/icon-192.png',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  const action = event.action
  const data = event.notification.data || {}
  const url = data.url || '/today'
  const notificationId = data.notificationId

  event.notification.close()

  const work = (async () => {
    if (notificationId && action) {
      try {
        await fetch('/api/notifications/respond', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notificationId,
            response: action,
          }),
        })
      } catch (error) {
        console.error('Failed to send notification response', error)
      }
    }

    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of windowClients) {
      if ('focus' in client) {
        client.navigate(url)
        return client.focus()
      }
    }

    return clients.openWindow(url)
  })()

  event.waitUntil(work)
})