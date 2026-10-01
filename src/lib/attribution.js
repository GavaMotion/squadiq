import { supabase } from './supabase'

// Where a coach came from, saved once at signup so a marketing test can be read
// as "trials by source" instead of guessed from a weekly total.
//
// Two inputs, both read on arrival:
//   - campaign tags in the URL (utm_*). The marketing site forwards its own
//     incoming tags onto every link into the app, so an ad pointing at
//     squadiq.online still arrives here tagged.
//   - the site the visitor came from: document.referrer, or sq_ref, which the
//     marketing site passes along because, once the visitor hops from the site
//     to the app, the app's own referrer is just squadiq.online.
//
// A tagged arrival replaces whatever was stored (the most recent campaign
// gets the credit). A referrer-only arrival is only kept when nothing is stored,
// so the bounce back from Google sign-in can't overwrite a real source.

const KEY = 'sq_attribution'
const MAX = 200

// Hops inside our own signup flow, never a source.
const IGNORE_REF = /(^|\.)(squadiq-coach\.vercel\.app|squadiq\.online|supabase\.co|accounts\.google\.com)$/i

function clip(v) { return v ? String(v).slice(0, MAX) : null }

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return null }
}

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}

function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* private mode: lose it */ }
}

/** Call once on app load, before anything rewrites the URL. */
export function captureAttribution() {
  let params
  try { params = new URLSearchParams(window.location.search) } catch { return }

  const tagged = {
    source:   clip(params.get('utm_source')),
    medium:   clip(params.get('utm_medium')),
    campaign: clip(params.get('utm_campaign')),
    content:  clip(params.get('utm_content')),
  }
  const forwardedRef = clip(params.get('sq_ref'))
  const ownRef = hostOf(document.referrer)
  const referrer = forwardedRef || (ownRef && !IGNORE_REF.test(ownRef) ? ownRef : null)
  const isTagged = !!(tagged.source || tagged.medium || tagged.campaign)

  if (!isTagged && !referrer) {
    // Plain visit. Remember that it happened, so a later referrer-only bounce
    // doesn't get credited as a source the coach never actually came through.
    if (!read()) write({ ...tagged, referrer: null, landing: clip(window.location.pathname), first_seen: new Date().toISOString() })
    return
  }
  if (!isTagged && read()) return

  write({ ...tagged, referrer, landing: clip(window.location.pathname), first_seen: new Date().toISOString() })
}

// Only accounts this young are new signups. An existing coach opening the app
// from some link today must not be credited to it.
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000

/**
 * Save the stored source against a newly created account, on its first signed-in
 * load. (The database opens the trial row itself, so there is no app-side
 * "account created" moment to hang this on.) Fire-and-forget: attribution must
 * never block or break signup. Users can insert their own row once and never
 * read it back; a duplicate means it's already saved.
 */
export async function recordAttribution(user) {
  if (!user?.id || user.is_anonymous) return            // assistants join by code, not by marketing
  const age = Date.now() - new Date(user.created_at).getTime()
  if (!(age >= 0 && age < NEW_ACCOUNT_MS)) return
  const doneKey = `sq_attribution_saved_${user.id}`
  try { if (localStorage.getItem(doneKey)) return } catch { /* no storage: just try */ }

  const a = read() || {}
  const markDone = () => { try { localStorage.setItem(doneKey, '1') } catch { /* fine */ } }
  try {
    const { error } = await supabase.from('signup_sources').insert({
      user_id:    user.id,
      source:     a.source || null,
      medium:     a.medium || null,
      campaign:   a.campaign || null,
      content:    a.content || null,
      referrer:   a.referrer || null,
      landing:    a.landing || null,
      first_seen: a.first_seen || null,
    })
    if (!error || error.code === '23505') markDone()
    else console.warn('signup source not saved:', error.message)
  } catch (e) {
    console.warn('signup source not saved:', e?.message)
  }
}
