// Hourly game-day reminders and lifecycle emails — the trigger for a coach's
// second visit. Called by pg_cron (migration 20261016000000_game_reminders).
//
// Takes no input: every send is checked against a "last sent" record first,
// so an extra call does nothing. That is why it runs with --no-verify-jwt.
//
//   evening before the game, 6–10pm local  → email + push  (last_eve_sent)
//   game day, 2½h–1h before kickoff        → push only     (last_pre_sent)
//   trial ends in 2–3 days                 → email         (email_log 'trial_3d')
//
// POST ?unsub=<user>.<sig> turns a coach's email off: game reminders (they can
// switch them back on in the app) and lifecycle mail (for good). The link in
// each email opens squadiq.online/unsubscribe, which confirms with a POST; the
// List-Unsubscribe header POSTs here directly. A GET changes nothing, so mail
// scanners that prefetch links can't unsubscribe anyone.
//
// Email needs RESEND_API_KEY (skipped when unset). Push needs VAPID_PUBLIC_KEY
// and VAPID_PRIVATE_KEY.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY') ?? ''
const EMAIL_FROM   = Deno.env.get('EMAIL_FROM') ?? 'Rodrigo at SquadIQ <coach@squadiq.online>'
const REPLY_TO     = Deno.env.get('EMAIL_REPLY_TO') ?? ''
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const APP_URL = 'https://squadiq-coach.vercel.app'
const FN_URL  = `${SUPABASE_URL}/functions/v1/game-reminders`

const pushReady = !!(VAPID_PUBLIC && VAPID_PRIVATE)
if (pushReady) webpush.setVapidDetails('https://squadiq.online', VAPID_PUBLIC, VAPID_PRIVATE)

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>

// ─── Time ────────────────────────────────────────────────────────
function localNow(tz: string, d = new Date()) {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d)
  } catch {
    return null   // unknown timezone string
  }
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const hour = Number(get('hour')) % 24
  return {
    weekday: WD[get('weekday')],
    date:    `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + Number(get('minute')),
  }
}

function kickoffMinutes(kickoff: string) {
  const [h, m] = kickoff.split(':').map(Number)
  return h * 60 + m
}

function fmtKickoff(kickoff: string) {
  const [h, m] = kickoff.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

// ─── Unsubscribe tokens ─────────────────────────────────────────
async function sign(userId: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SERVICE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`unsub:${userId}`))
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]!)).slice(0, 32)
}

async function unsubToken(userId: string) {
  return `${userId}.${await sign(userId)}`
}

// ─── Senders ─────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
type Db = any

// kind 'reminder' is gated by game_reminders.email_on (the coach's own toggle);
// 'lifecycle' by email_optouts.
async function sendEmail(db: Db, userId: string, kind: 'reminder' | 'lifecycle', subject: string, lines: string[], cta: { label: string, url: string }) {
  if (!RESEND_KEY) return false
  if (kind === 'lifecycle') {
    const { data: optout } = await db.from('email_optouts').select('user_id').eq('user_id', userId).maybeSingle()
    if (optout) return false
  }
  const { data: { user } } = await db.auth.admin.getUserById(userId)
  if (!user?.email || user.is_anonymous) return false

  const token = await unsubToken(userId)
  const unsub = `https://squadiq.online/unsubscribe?t=${token}`
  const oneClick = `${FN_URL}?unsub=${token}`
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1a1a2e;max-width:520px">
${lines.map(l => `<p>${esc(l)}</p>`).join('\n')}
<p><a href="${cta.url}" style="display:inline-block;background:#00c853;color:#052711;font-weight:700;text-decoration:none;padding:11px 18px;border-radius:8px">${esc(cta.label)}</a></p>
<p>Rodrigo<br><span style="color:#666">SquadIQ: I coach AYSO too. Just reply if anything is in your way.</span></p>
<p style="color:#999;font-size:12px">You get this because you use SquadIQ. <a href="${unsub}" style="color:#999">Unsubscribe</a></p>
</div>`
  const text = `${lines.join('\n\n')}\n\n${cta.label}: ${cta.url}\n\nRodrigo, SquadIQ\n\nUnsubscribe: ${unsub}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM, to: [user.email], subject, html, text,
      ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
      headers: { 'List-Unsubscribe': `<${oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  })
  if (!res.ok) console.error('resend', res.status, await res.text())
  return res.ok
}

async function sendPush(db: Db, userId: string, title: string, body: string, url: string) {
  if (!pushReady) return 0
  const { data: subs } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId)
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, url }),
        { TTL: 3 * 3600 },
      )
      sent++
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode
      // 404/410: the device unsubscribed or the app was uninstalled.
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      else console.error('push', code, (err as Error).message)
    }
  }
  return sent
}

// ─── Jobs ────────────────────────────────────────────────────────
type Sub = { plan?: string, plan_override?: string | null, trial_end?: string | null }
type Row = {
  team_id: string, user_id: string, weekday: number, kickoff: string, tz: string,
  email_on: boolean, push_on: boolean, last_eve_sent: string | null, last_pre_sent: string | null,
  teams: { name?: string } | null,
}

function entitled(sub: Sub | undefined) {
  if (!sub) return false
  if (sub.plan === 'solo' || sub.plan === 'premium' || sub.plan === 'multi' || sub.plan_override) return true
  return sub.plan === 'trial' && !!sub.trial_end && new Date(sub.trial_end) > new Date()
}

async function claim(db: Db, teamId: string, col: 'last_eve_sent' | 'last_pre_sent', date: string) {
  const { data } = await db.from('game_reminders').update({ [col]: date })
    .eq('team_id', teamId).or(`${col}.is.null,${col}.neq.${date}`).select('team_id')
  return !!data?.length
}

async function gameReminders(db: Db) {
  const { data: rows, error } = await db.from('game_reminders')
    .select('team_id, user_id, weekday, kickoff, tz, email_on, push_on, last_eve_sent, last_pre_sent, teams(name)')
  if (error) throw error
  if (!rows?.length) return { eve: 0, pre: 0 }

  const userIds = [...new Set(rows.map((r: Row) => r.user_id))]
  const { data: subs } = await db.from('subscriptions')
    .select('user_id, plan, plan_override, trial_end').in('user_id', userIds)
  const subBy = new Map<string, Sub>((subs ?? []).map((s: Sub & { user_id: string }) => [s.user_id, s]))

  let eve = 0, pre = 0
  for (const r of rows as Row[]) {
    // A lapsed trial would open straight onto the paywall: don't remind.
    if (!entitled(subBy.get(r.user_id))) continue
    const now = localNow(r.tz)
    if (!now) continue
    const team = (r.teams as { name?: string } | null)?.name || 'Your team'
    const time = fmtKickoff(r.kickoff)
    const day  = DAYS[r.weekday]

    // Evening before.
    if ((now.weekday + 1) % 7 === r.weekday && now.minutes >= 18 * 60 && now.minutes < 22 * 60
        && r.last_eve_sent !== now.date) {
      // Claim first: only the call whose update matched sends, so overlapping
      // calls (or a crash mid-send) can't turn into a second email.
      if (!await claim(db, r.team_id, 'last_eve_sent', now.date)) continue
      const url = `${APP_URL}/?utm_source=reminder&utm_medium=email&utm_campaign=eve`
      if (r.email_on) {
        await sendEmail(db, r.user_id, 'reminder', `${team} plays tomorrow at ${time}`, [
          `Hi coach,`,
          `${team} plays tomorrow (${day}) at ${time}.`,
          `Open SquadIQ, mark who can't make it, and tap AI Lineup. Everyone gets fair minutes, and you get the sub plan for the sideline. It takes about 30 seconds.`,
        ], { label: "Build tomorrow's lineup", url })
      }
      if (r.push_on) {
        await sendPush(db, r.user_id, `${team} plays tomorrow at ${time}`,
          "Mark who's out and build a fair lineup in 30 seconds.", url.replace('medium=email', 'medium=push'))
      }
      eve++
    }

    // Two hours before kickoff (push only — an email at 7am on game day is noise).
    const until = kickoffMinutes(r.kickoff) - now.minutes
    if (r.push_on && now.weekday === r.weekday && until <= 150 && until > 60 && r.last_pre_sent !== now.date) {
      if (!await claim(db, r.team_id, 'last_pre_sent', now.date)) continue
      await sendPush(db, r.user_id, `Kickoff at ${time}`, 'Your lineup and sub clock are ready.',
        `${APP_URL}/?utm_source=reminder&utm_medium=push&utm_campaign=pregame`)
      pre++
    }
  }
  return { eve, pre }
}

async function trialEnding(db: Db) {
  if (!RESEND_KEY) return 0
  const from = new Date(Date.now() + 2 * 864e5).toISOString()
  const to   = new Date(Date.now() + 3 * 864e5).toISOString()
  const { data: subs, error } = await db.from('subscriptions')
    .select('user_id').eq('plan', 'trial').is('plan_override', null).is('archived_at', null)
    .gte('trial_end', from).lt('trial_end', to)
  if (error) throw error
  let sent = 0
  for (const { user_id } of subs ?? []) {
    // Insert-first claims the send; a duplicate key means it already went.
    const { error: dup } = await db.from('email_log').insert({ user_id, kind: 'trial_3d' })
    if (dup) continue
    const ok = await sendEmail(db, user_id, 'lifecycle', 'Your SquadIQ trial ends in 3 days', [
      `Hi coach,`,
      `Your free month of SquadIQ ends in 3 days. Your teams, lineups and playing-time history all stay saved.`,
      `To keep coaching with them, open SquadIQ and go to My Team, then Upgrade.`,
      `If it hasn't been useful, I'd really like to know why. Just reply to this email.`,
    ], { label: 'Open SquadIQ', url: `${APP_URL}/?utm_source=lifecycle&utm_medium=email&utm_campaign=trial_3d` })
    if (ok) sent++
  }
  return sent
}

// ─── Entry ───────────────────────────────────────────────────────
const cors = {
  'Access-Control-Allow-Origin':  'https://squadiq.online',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = createClient(SUPABASE_URL, SERVICE_KEY)
  const unsub = new URL(req.url).searchParams.get('unsub')

  if (unsub) {
    if (req.method !== 'POST') return Response.json({ error: 'POST to unsubscribe' }, { status: 405, headers: cors })
    const [userId, sig] = unsub.split('.')
    const valid = /^[0-9a-f-]{36}$/.test(userId ?? '') && sig === await sign(userId)
    if (!valid) return Response.json({ ok: false }, { status: 400, headers: cors })
    await db.from('email_optouts').upsert({ user_id: userId })
    await db.from('game_reminders').update({ email_on: false }).eq('user_id', userId)
    return Response.json({ ok: true }, { headers: cors })
  }

  try {
    const games = await gameReminders(db)
    const trial = await trialEnding(db)
    return Response.json({ ...games, trial, email: !!RESEND_KEY, push: pushReady })
  } catch (err) {
    console.error('game-reminders', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
})
