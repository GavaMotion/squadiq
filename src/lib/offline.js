// ── Offline support ───────────────────────────────────────────────
// A coach on a field usually has no signal. Two things make that work:
//
//   1. Reads never wait on a network that isn't there. supabase-js resolves
//      fetch failures as { data: null, error } (it does not throw) and retries
//      GETs three times with 1s/2s/4s backoff — so an un-guarded offline boot
//      spends ~7s per query and then quietly looks like an empty account.
//      readCached() answers straight from localStorage when offline, and falls
//      back to it when a request fails.
//   2. Writes are queued (see the pending-changes queue in AppContext) and
//      replayed on top of cached reads, so a reload in the field still shows
//      the subs the coach just made.

export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

// A dead network surfaces as a PostgrestError with an empty `code` (the raw
// message is "TypeError: Failed to fetch"); anything the server itself
// rejected — RLS, a constraint, a bad column — carries a real code. Only the
// former is worth queueing for a retry.
export function isNetworkError(err) {
  if (!err) return false
  if (isOffline()) return true
  return !err.code
}

export function cacheData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* storage full or unavailable */ }
}

export function getCachedData(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.data ?? null
  } catch { return null }
}

export function getCachedAge(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const mins = Math.round((Date.now() - JSON.parse(raw).ts) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
    const days = Math.round(hrs / 24)
    return `${days} day${days === 1 ? '' : 's'} ago`
  } catch { return null }
}

// Run a Supabase read with a localStorage cache behind it.
//
//   key      cache key, unique per user/team
//   run      () => supabase query promise resolving { data, error }
//   fallback value to use when there is neither a response nor a cache entry
//
// Returns { data, error, fromCache }. `error` is only set when the request
// failed AND nothing was cached — callers that just want data can ignore it.
export async function readCached(key, run, fallback = null) {
  if (isOffline()) {
    const cached = getCachedData(key)
    return { data: cached ?? fallback, error: null, fromCache: true }
  }

  let data = null, error = null
  try {
    ;({ data, error } = await run())
  } catch (err) {
    error = err
  }

  if (error) {
    const cached = getCachedData(key)
    if (cached !== null) return { data: cached, error: null, fromCache: true }
    return { data: fallback, error, fromCache: false }
  }

  cacheData(key, data ?? fallback)
  return { data: data ?? fallback, error: null, fromCache: false }
}

// ── Pending write queue ───────────────────────────────────────────
export const PENDING_KEY = 'pending_changes'

export function readPendingChanges() {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function writePendingChanges(changes) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(changes)) } catch { /* full */ }
}

// Fold queued writes into rows that came back from cache, so a reload with no
// signal shows what the coach last did rather than what last reached Supabase.
// Only id-matched writes can be replayed; anything else is left to sync.
export function applyPendingChanges(table, rows) {
  const pending = readPendingChanges().filter(c => c.table === table)
  if (pending.length === 0) return rows || []

  let out = [...(rows || [])]
  for (const c of pending) {
    const id = c.matchField === 'id' ? c.matchValue : c.data?.id
    if (id === undefined || id === null) continue

    if (c.operation === 'delete') {
      out = out.filter(r => r.id !== id)
      continue
    }
    const i = out.findIndex(r => r.id === id)
    if (i >= 0) out[i] = { ...out[i], ...c.data }
    else if (c.operation !== 'update') out.push({ id, ...c.data })
  }
  return out
}
