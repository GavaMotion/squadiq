// Store ratings. SquadIQ has almost none, and coaches rarely return after day
// one, so the usual "wait a week" advice means nobody is ever asked. Instead we
// ask at a good moment (an AI lineup built, a game finished, a sheet shared),
// only inside the store apps, at most twice ever and never twice in 14 days.
import { isAndroidTWA } from './platform'
import { callBridge } from '../hooks/useApplePay'

const KEY = 'sq_rating_prompt'
const PLAY_ID = 'com.gavamotion.squadiq'
const GAP_MS = 14 * 24 * 3600 * 1000

export const isIOSWrapper = () => !!window.webkit?.messageHandlers?.storekit

export function ratingPlatform() {
  if (isIOSWrapper()) return 'ios'
  if (isAndroidTWA()) return 'android'
  return null
}

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}
function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* private mode */ }
}

export function shouldAskForRating() {
  if (!ratingPlatform()) return false
  const s = read()
  if (s.rated || (s.asks || 0) >= 2) return false
  return !s.last || Date.now() - s.last > GAP_MS
}

// Pages call this at a happy moment; RatingPrompt decides whether to show.
export function markGoodMoment(kind) {
  window.dispatchEvent(new CustomEvent('sq:good-moment', { detail: kind }))
}

export function recordAsked() {
  const s = read()
  write({ ...s, asks: (s.asks || 0) + 1, last: Date.now() })
}

// iOS: Apple's own sheet, asked for directly. Apple rate-limits it (3 a year)
// and its guidelines disallow custom review prompts, so no card in front.
// Older wrappers reject or ignore the action; either way nothing is shown.
export function requestNativeReview() {
  recordAsked()
  callBridge('requestReview').catch(() => {})
}

// Android: the card's "Rate SquadIQ" opens the Play listing.
export function openStoreReview() {
  const s = read()
  write({ ...s, rated: true })
  window.location.href = `market://details?id=${PLAY_ID}`
}
