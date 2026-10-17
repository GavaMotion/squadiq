// Web Push for game-day reminders. Works in browsers, home-screen PWAs and the
// Android app (Chrome delegates the site's notifications to it). The iOS
// wrapper is a WKWebView with no Push API, so iOS coaches get email instead.
import { supabase } from './supabase'

// Public half of the VAPID pair; the private half is a Supabase secret.
const VAPID_PUBLIC_KEY = 'BFjuIq2Ur66PscnZkerRjCIkMOfZ2RrRFoA8qh2ktfFrsI0zzqFdn2kK6XcSvh55ptzT9Yrp6e9tZY_hpKk0zMM'

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function pushPermission() {
  return pushSupported() ? Notification.permission : 'unsupported'
}

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function swReady() {
  // .ready never settles without a service worker (dev, or a blocked one).
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('No service worker')), 5000)),
  ])
}

// Asks the OS for permission, subscribes this device and stores it.
// Resolves true when the device will receive pushes.
export async function enablePush(userId) {
  if (!pushSupported()) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  const reg = await swReady()
  // Always start from a fresh subscription: an old one may be stored under
  // another account that signed in on this phone, and RLS won't let us take
  // its row over.
  const old = await reg.pushManager.getSubscription()
  if (old) await old.unsubscribe().catch(() => {})
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: json.endpoint, user_id: userId, p256dh: json.keys.p256dh, auth: json.keys.auth,
  })
  if (error) throw error
  return true
}

// On sign-out: this phone stops getting the previous coach's game reminders.
// Must run while the session is still valid (RLS deletes only your own row).
export async function disablePushOnThisDevice() {
  if (!pushSupported()) return
  try {
    const reg = await swReady()
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch { /* offline or no worker: the server drops dead endpoints on 410 */ }
}
