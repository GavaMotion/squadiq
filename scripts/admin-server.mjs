#!/usr/bin/env node
// Localhost-only admin dashboard server.
// Run: npm run admin   (or: node --env-file=.env scripts/admin-server.mjs)

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  console.error('Run with: npm run admin')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Fail fast with a clear message if the service-role key is wrong/revoked,
// instead of surfacing a generic 500 ("Invalid API key") in the dashboard.
// Returns true if the service-role key is accepted. Prints a clear reason and
// returns false otherwise, so the caller can exit cleanly (no generic 500 in
// the dashboard, no abrupt process.exit mid-fetch).
async function checkKey() {
  let res
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    })
  } catch (err) {
    console.error(`\n  Could not reach Supabase at ${SUPABASE_URL}`)
    console.error(`  ${err?.message || err}\n`)
    return false
  }
  if (res.status === 401 || res.status === 403) {
    let hint = ''
    try { hint = (await res.json())?.message || '' } catch {}
    console.error('\n  ✗ SUPABASE_SERVICE_ROLE_KEY is invalid or revoked' + (hint ? ` (${hint})` : ''))
    console.error('  Get a fresh secret key: Supabase dashboard → Project Settings → API Keys → Secret keys,')
    console.error('  then update SUPABASE_SERVICE_ROLE_KEY in .env and restart.\n')
    return false
  }
  if (!res.ok) {
    console.error(`\n  ✗ Supabase returned HTTP ${res.status} while validating the service key.\n`)
    return false
  }
  return true
}

// Classify a session user-agent into a coarse platform label for the dashboard.
function platformOf(ua) {
  if (!ua) return ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua))          return 'Android'
  if (/Windows/i.test(ua))          return 'Windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS'
  if (/Linux|X11/i.test(ua))        return 'Linux'
  return 'Other'
}

// Approximate IP → location for the dashboard. Uses ip-api.com (free, HTTP only,
// non-commercial) and caches per IP for the server's lifetime so refreshes don't
// re-query. To swap providers later, only this function needs changing.
const geoCache = new Map() // ip -> location string

function isPrivateIp(ip) {
  return /^(10\.|127\.|192\.168\.|169\.254\.|::1$|fc|fd|fe80)/i.test(ip) ||
         /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
}

async function geolocate(ips) {
  const todo = [...new Set(ips.filter(ip => ip && !geoCache.has(ip)))]
  for (const ip of todo) if (isPrivateIp(ip)) geoCache.set(ip, 'local network')
  const lookups = todo.filter(ip => !geoCache.has(ip))
  for (let i = 0; i < lookups.length; i += 100) {
    const batch = lookups.slice(i, i + 100)
    try {
      const r = await fetch('http://ip-api.com/batch?fields=status,country,regionName,city,mobile,query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      })
      const rows = await r.json()
      for (const row of rows) {
        let loc = 'unknown'
        if (row.status === 'success') {
          loc = [row.city, row.regionName, row.country].filter(Boolean).join(', ')
          if (row.mobile) loc += ' · mobile'
        }
        geoCache.set(row.query, loc)
      }
    } catch (e) {
      console.warn('geolocation failed:', e.message)
      for (const ip of batch) if (!geoCache.has(ip)) geoCache.set(ip, '')
    }
  }
}

async function loadUsers() {
  const usersRes = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (usersRes.error) throw new Error(usersRes.error.message)
  const users = usersRes.data.users

  const { data: subs }  = await supabase.from('subscriptions').select('*')
  const { data: teams } = await supabase.from('teams').select('id, user_id, name')

  // Latest session user-agent per user, via a SECURITY DEFINER function that
  // reads auth.sessions (the auth schema isn't exposed to PostgREST directly).
  // Missing function / old GoTrue without user_agent → platform stays blank.
  const uaByUser = new Map()
  const ipByUser = new Map()
  const { data: uas, error: uaErr } = await supabase.rpc('admin_latest_user_agents')
  if (uaErr) console.warn('platform/location lookup skipped:', uaErr.message)
  else for (const r of uas || []) {
    uaByUser.set(r.user_id, r.user_agent)
    if (r.ip) ipByUser.set(r.user_id, r.ip)
  }

  // Resolve all session IPs to locations (cached); skip if none.
  await geolocate([...ipByUser.values()])

  const subByUser = new Map((subs || []).map(s => [s.user_id, s]))
  const teamsByUser = new Map()
  for (const t of teams || []) {
    if (!teamsByUser.has(t.user_id)) teamsByUser.set(t.user_id, [])
    teamsByUser.get(t.user_id).push(t)
  }

  return users.map(u => {
    const s = subByUser.get(u.id)
    const userTeams = teamsByUser.get(u.id) || []
    const ua = uaByUser.get(u.id) || ''
    const ip = ipByUser.get(u.id) || ''
    return {
      id:                     u.id,
      email:                  u.email || '(no email)',
      provider:               u.app_metadata?.provider || '?',
      confirmed:              !!u.email_confirmed_at,
      signup:                 u.created_at,
      last_seen:              u.last_sign_in_at,
      plan:                   s?.plan || 'none',
      plan_override:          s?.plan_override || null,
      trial_end:              s?.trial_end || null,
      stripe_customer_id:     s?.stripe_customer_id || null,
      stripe_subscription_id: s?.stripe_subscription_id || null,
      teams:                  userTeams.length,
      team_names:             userTeams.map(t => t.name),
      platform:               platformOf(ua),
      user_agent:             ua,
      location:               ip ? (geoCache.get(ip) || '') : '',
      ip:                     ip,
    }
  })
}

// ── Mutations ───────────────────────────────────────────────────
const ALLOWED_PLANS = new Set(['trial', 'solo', 'premium', 'expired'])
const TRIAL_DAYS = 30

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy() })
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

// Reject browser requests coming from another origin (leave non-browser and
// same-page requests, which either omit Origin or send a localhost one).
function sameOriginOk(req) {
  const origin = req.headers.origin
  if (!origin) return true
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

// Update the user's subscription row, inserting one if they don't have it yet.
async function applySubscriptionChange(userId, patch) {
  const { data: existing, error: selErr } = await supabase
    .from('subscriptions').select('user_id').eq('user_id', userId).maybeSingle()
  if (selErr) throw new Error(selErr.message)
  const { error } = existing
    ? await supabase.from('subscriptions').update(patch).eq('user_id', userId)
    : await supabase.from('subscriptions').insert({ user_id: userId, ...patch })
  if (error) throw new Error(error.message)
}

const PORT = Number(process.env.ADMIN_PORT) || 8787

// Allow loopback and Tailscale CGNAT (100.64.0.0/10).  No other interfaces.
function isAllowedPeer(ra) {
  if (ra.startsWith('127.') || ra === '::1' || ra === '::ffff:127.0.0.1') return true
  const m = ra.match(/^(?:::ffff:)?100\.(\d{1,3})\./)
  if (m) {
    const o2 = Number(m[1])
    if (o2 >= 64 && o2 <= 127) return true
  }
  return false
}

const server = createServer(async (req, res) => {
  const ra = req.socket.remoteAddress || ''
  if (!isAllowedPeer(ra)) {
    res.writeHead(403); res.end('forbidden'); return
  }

  try {
    if (req.url === '/' || req.url === '/index.html' || req.url === '/admin.html') {
      const html = await readFile(join(__dirname, 'admin.html'), 'utf8')
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }
    if (req.url === '/api/users' || req.url.startsWith('/api/users?')) {
      const users = await loadUsers()
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(users))
      return
    }
    if (req.method === 'POST' && (req.url === '/api/set-plan' || req.url === '/api/reset-trial')) {
      // Mutating endpoints. Access is already restricted to loopback/Tailscale;
      // additionally reject cross-origin browser requests (CSRF-lite): a custom
      // header forces a CORS preflight this server never approves, and any
      // Origin header present must be localhost.
      if (!sameOriginOk(req) || req.headers['x-squadiq-admin'] !== '1') {
        res.writeHead(403); res.end('forbidden'); return
      }
      const body = await readJson(req)
      const userId = String(body.userId || '')
      if (!/^[0-9a-f-]{36}$/i.test(userId)) { res.writeHead(400); res.end('bad userId'); return }

      const now = new Date()
      const nowIso = now.toISOString()
      const trialEndIso = new Date(now.getTime() + TRIAL_DAYS * 86400000).toISOString()
      let patch
      if (req.url === '/api/reset-trial') {
        patch = { plan: 'trial', trial_start: nowIso, trial_end: trialEndIso, updated_at: nowIso }
      } else {
        const plan = String(body.plan || '')
        if (!ALLOWED_PLANS.has(plan)) { res.writeHead(400); res.end('bad plan'); return }
        patch = { plan, updated_at: nowIso }
        // Moving someone (back) to trial only makes sense with a live window.
        if (plan === 'trial') { patch.trial_start = nowIso; patch.trial_end = trialEndIso }
      }

      await applySubscriptionChange(userId, patch)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, ...patch }))
      return
    }
    res.writeHead(404); res.end('not found')
  } catch (err) {
    console.error('admin-server error:', err)
    res.writeHead(500, { 'content-type': 'text/plain' })
    res.end(String(err?.message || err))
  }
})

if (!(await checkKey())) {
  process.exitCode = 1
} else server.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log(`  SquadIQ Admin → http://localhost:${PORT}`)
  console.log(`  Reachable from loopback + Tailscale (100.64.0.0/10) only.`)
  console.log(`  Press Ctrl+C to stop.`)
  console.log('')
})
