#!/usr/bin/env node
// Read-only admin tool: list SquadIQ users with filters.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env (never commit). Use:
//   node --env-file=.env scripts/admin-users.mjs --help

import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)

function flagValue(name) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return null
  const next = args[i + 1]
  return next && !next.startsWith('--') ? next : true
}
function hasFlag(name) { return args.includes(`--${name}`) }

if (hasFlag('help') || hasFlag('h')) {
  console.log(`Usage: node --env-file=.env scripts/admin-users.mjs [filters] [options]

Filters:
  --plan <list>       Comma list of: trial,solo,premium,expired
  --paying            On a paid plan and actually billed (excludes gifts)
  --gifted            Paid plan given by hand — access, but not revenue
  --trial             Shortcut for --plan trial
  --expired           Shortcut for --plan expired
  --new [days]        Signed up within N days (default 7)
  --old [days]        Signed up more than N days ago (default 30)
  --inactive [days]   No sign-in within N days (default 30)
  --has-team          Has at least one team
  --no-team           Has no teams
  --search <text>     Email contains text (case-insensitive)

Options:
  --sort <field>      signup | last_seen | email | plan | teams (default: signup)
  --desc              Reverse sort order
  --limit <n>         Max rows (default 50)
  --format <type>     table | json | csv (default: table)

Examples:
  node --env-file=.env scripts/admin-users.mjs --paying
  node --env-file=.env scripts/admin-users.mjs --new 7 --sort signup
  node --env-file=.env scripts/admin-users.mjs --trial --format json
`)
  process.exit(0)
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run as: node --env-file=.env scripts/admin-users.mjs ...')
  console.error('Add SUPABASE_SERVICE_ROLE_KEY=... to .env (Supabase → Settings → API).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const usersRes = await supabase.auth.admin.listUsers({ perPage: 1000 })
if (usersRes.error) {
  console.error('Failed to list users:', usersRes.error.message)
  process.exit(1)
}
const users = usersRes.data.users

const { data: subs, error: subErr } = await supabase.from('subscriptions').select('*')
if (subErr) console.error('subscriptions fetch warning:', subErr.message)

const { data: teams, error: teamErr } = await supabase
  .from('teams').select('id, user_id, name')
if (teamErr) console.error('teams fetch warning:', teamErr.message)

const subByUser = new Map((subs || []).map(s => [s.user_id, s]))
const teamsByUser = new Map()
for (const t of teams || []) {
  if (!teamsByUser.has(t.user_id)) teamsByUser.set(t.user_id, [])
  teamsByUser.get(t.user_id).push(t)
}

let rows = users.map(u => {
  const s = subByUser.get(u.id)
  const userTeams = teamsByUser.get(u.id) || []
  return {
    id:                     u.id,
    email:                  u.email || '(no email)',
    provider:               u.app_metadata?.provider || '?',
    confirmed:              !!u.email_confirmed_at,
    signup:                 u.created_at,
    last_seen:              u.last_sign_in_at,
    plan:                   s?.plan || 'none',
    plan_override:          s?.plan_override || null,
    gifted:                 !!s?.gifted,
    apple_environment:      s?.apple_environment || null,
    trial_end:              s?.trial_end || null,
    stripe_customer_id:     s?.stripe_customer_id || null,
    stripe_subscription_id: s?.stripe_subscription_id || null,
    teams:                  userTeams.length,
    team_names:             userTeams.map(t => t.name),
  }
})

const planArg = flagValue('plan')
let planSet = null
if (planArg && planArg !== true) planSet = new Set(planArg.split(',').map(p => p.trim()))
if (hasFlag('paying'))  planSet = new Set(['solo', 'premium'])
if (hasFlag('trial'))   planSet = new Set(['trial'])
if (hasFlag('expired')) planSet = new Set(['expired'])
if (planSet) rows = rows.filter(r => planSet.has(r.plan))
// Gifted accounts (testers, friends, AYSO contacts) have full access and no
// revenue, and an Apple sandbox receipt is a test purchase. --paying means
// billed, so both are excluded from it.
if (hasFlag('paying')) rows = rows.filter(r => !r.gifted && r.apple_environment !== 'Sandbox')
if (hasFlag('gifted')) rows = rows.filter(r => r.gifted)

function daysFlag(name, def) {
  const v = flagValue(name)
  if (v === null) return null
  return v === true ? def : Number(v)
}
const newDays = daysFlag('new', 7)
if (newDays !== null) {
  const cutoff = Date.now() - newDays * 86400000
  rows = rows.filter(r => new Date(r.signup).getTime() >= cutoff)
}
const oldDays = daysFlag('old', 30)
if (oldDays !== null) {
  const cutoff = Date.now() - oldDays * 86400000
  rows = rows.filter(r => new Date(r.signup).getTime() < cutoff)
}
const inactiveDays = daysFlag('inactive', 30)
if (inactiveDays !== null) {
  const cutoff = Date.now() - inactiveDays * 86400000
  rows = rows.filter(r => !r.last_seen || new Date(r.last_seen).getTime() < cutoff)
}

if (hasFlag('has-team')) rows = rows.filter(r => r.teams > 0)
if (hasFlag('no-team'))  rows = rows.filter(r => r.teams === 0)

const search = flagValue('search')
if (search && typeof search === 'string') {
  const q = search.toLowerCase()
  rows = rows.filter(r => r.email.toLowerCase().includes(q))
}

const sortField = flagValue('sort') || 'signup'
const reverse = hasFlag('desc') ? -1 : 1
rows.sort((a, b) => {
  switch (sortField) {
    case 'email':     return a.email.localeCompare(b.email) * reverse
    case 'plan':      return a.plan.localeCompare(b.plan) * reverse
    case 'last_seen': return (new Date(b.last_seen || 0) - new Date(a.last_seen || 0)) * reverse
    case 'teams':     return (b.teams - a.teams) * reverse
    case 'signup':
    default:          return (new Date(b.signup) - new Date(a.signup)) * reverse
  }
})

const limit = Number(flagValue('limit')) || 50
const shown = rows.slice(0, limit)
const hidden = rows.length - shown.length

const format = flagValue('format') || 'table'

function relTime(iso) {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'in future'
  const h = Math.floor(ms / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}
function trialLeft(r) {
  if (r.plan !== 'trial' || !r.trial_end) return ''
  const d = Math.ceil((new Date(r.trial_end) - Date.now()) / 86400000)
  return d > 0 ? `${d}d left` : 'expired'
}

// plan + everything that qualifies it, so an override never hides a gift:
// "premium (unlimited, gift)".
function planLabel(r) {
  const notes = []
  if (r.plan_override) notes.push(r.plan_override)
  if (r.apple_environment === 'Sandbox') notes.push('sandbox')
  if (r.gifted) notes.push('gift')
  return notes.length ? `${r.plan} (${notes.join(', ')})` : r.plan
}

if (format === 'json') {
  console.log(JSON.stringify(shown, null, 2))
} else if (format === 'csv') {
  const cols = ['email','plan','plan_override','gifted','signup','last_seen','teams','trial_end','stripe_customer_id']
  console.log(cols.join(','))
  for (const r of shown) console.log(cols.map(c => JSON.stringify(r[c] ?? '')).join(','))
} else {
  const headers = ['Email', 'Plan', 'Signed up', 'Last seen', 'Teams', 'Trial']
  const data = shown.map(r => [
    r.email,
    planLabel(r),
    relTime(r.signup),
    relTime(r.last_seen),
    String(r.teams),
    trialLeft(r),
  ])
  const widths = headers.map((h, i) => Math.max(h.length, ...data.map(row => row[i].length)))
  const fmt = (row) => row.map((c, i) => c.padEnd(widths[i])).join('  ')
  console.log(fmt(headers))
  console.log(widths.map(w => '-'.repeat(w)).join('  '))
  for (const row of data) console.log(fmt(row))

  console.log(
    `\n${rows.length} matching user${rows.length === 1 ? '' : 's'}` +
    (hidden > 0 ? ` (${shown.length} shown, ${hidden} hidden — raise --limit)` : '')
  )
  const planCounts = {}
  for (const r of rows) planCounts[r.plan] = (planCounts[r.plan] || 0) + 1
  const summary = Object.entries(planCounts).map(([p, n]) => `${p}: ${n}`).join(', ')
  if (summary) console.log(`Plans: ${summary}`)
  // Say it out loud: a gifted row looks exactly like a sale in the plan counts.
  const gifted = rows.filter(r => r.gifted).length
  if (gifted) console.log(`Gifted: ${gifted} (full access, not revenue)`)
}
