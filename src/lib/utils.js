/** Formats integer seconds → "M:SS" or "MM:SS" */
export function fmtTime(totalSec) {
  const s = Math.floor(Math.max(0, totalSec))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss.toString().padStart(2, '0')}`
}

/** Picks a dark or light text color for legibility on top of `bg`.
 *  Uses YIQ perceived luminance with a strict mid-grey threshold (128) so any
 *  color brighter than mid-grey gets dark text. */
export function getContrastTextColor(bg, darkColor = '#0a0a0f', lightColor = '#ffffff') {
  if (!bg || typeof bg !== 'string') return lightColor
  let h = bg.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (h.length !== 6) return lightColor
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return lightColor
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? darkColor : lightColor
}

// ── One-a-day prompts ─────────────────────────────────────────────
// Some confirmations are worth showing the first time and merely annoying
// every time after. These remember the acknowledgement for the calendar day,
// so a coach sees the explanation once and is left alone during the game.
export function ackedToday(key) {
  try {
    return localStorage.getItem(key) === new Date().toDateString()
  } catch { return false }
}

export function ackToday(key) {
  try { localStorage.setItem(key, new Date().toDateString()) } catch { /* private mode */ }
}

export const MODE_SWITCH_ACK = 'sq_ack_mode_switch'
