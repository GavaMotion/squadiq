// Push handlers, pulled into the generated service worker via
// workbox.importScripts (vite.config.js). Sent by supabase/functions/game-reminders.
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'SquadIQ', body: event.data?.text() } }
  event.waitUntil(self.registration.showNotification(data.title || 'SquadIQ', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'squadiq-game',
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = wins.find(w => new URL(w.url).origin === self.location.origin)
    if (open) { await open.focus(); return }
    await self.clients.openWindow(url)
  })())
})
