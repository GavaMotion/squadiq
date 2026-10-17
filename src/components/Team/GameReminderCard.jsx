import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { readCached, isOffline } from '../../lib/offline'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../UI/Toast'
import { pushSupported, pushPermission, enablePush } from '../../lib/push'

// "When do you play?" — the one fact the reminders need. Nothing brought a
// coach back for a second visit before this: the evening-before email/push
// (supabase/functions/game-reminders) is that trigger. Push is offered only
// right after the coach saves a game slot, never on first launch, because a
// refusal is hard to undo and the ask has to be tied to something they want.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']

function fmtTime(t) {
  const [h, m] = (t || '09:00').split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const panel = {
  background: 'var(--bg-panel)', border: '1px solid var(--border-purple)', borderRadius: 16, padding: 16,
}
const chip = active => ({
  flex: 1, minWidth: 0, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
  border: `1px solid ${active ? '#00c853' : 'rgba(255,255,255,0.12)'}`,
  background: active ? 'rgba(0,200,83,0.15)' : 'rgba(255,255,255,0.04)',
  color: active ? '#00c853' : 'rgba(255,255,255,0.6)',
})
const btn = primary => ({
  flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: primary ? 700 : 500,
  border: primary ? 'none' : '1px solid rgba(255,255,255,0.15)',
  background: primary ? '#00c853' : 'rgba(255,255,255,0.08)',
  color: primary ? '#052711' : '#fff',
})

export default function GameReminderCard() {
  const { team, userId, isAssistant } = useApp()
  const { addToast } = useToast()
  const [row,     setRow]     = useState(undefined)   // undefined = loading, null = none
  const [editing, setEditing] = useState(false)
  const [weekday, setWeekday] = useState(6)
  const [kickoff, setKickoff] = useState('09:00')
  const [emailOn, setEmailOn] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [offerPush, setOfferPush] = useState(false)

  const teamId = team?.id

  useEffect(() => {
    if (!teamId || isAssistant) return
    let gone = false
    setRow(undefined); setEditing(false); setOfferPush(false)
    readCached(`game_reminder_${teamId}`, () =>
      supabase.from('game_reminders').select('*').eq('team_id', teamId).maybeSingle()
    ).then(({ data }) => { if (!gone) setRow(data ?? null) })
    return () => { gone = true }
  }, [teamId, isAssistant])

  if (!teamId || isAssistant || row === undefined) return null

  function startEdit() {
    setWeekday(row?.weekday ?? 6)
    setKickoff((row?.kickoff || '09:00').slice(0, 5))
    setEmailOn(row?.email_on ?? true)
    setEditing(true)
  }

  async function save(patch) {
    if (isOffline()) { addToast('Reminders need a connection to save', 'info', 3000); return false }
    setSaving(true)
    const next = {
      team_id: teamId, user_id: userId,
      weekday:  patch.weekday  ?? row?.weekday  ?? weekday,
      kickoff:  patch.kickoff  ?? row?.kickoff  ?? kickoff,
      email_on: patch.email_on ?? row?.email_on ?? emailOn,
      push_on:  patch.push_on  ?? row?.push_on  ?? false,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('game_reminders').upsert(next).select().single()
    setSaving(false)
    if (error) { addToast('Could not save your game time. Try again.', 'error', 4000); return false }
    setRow(data)
    return data
  }

  async function handleSave() {
    const first = !row
    const saved = await save({ weekday, kickoff, email_on: emailOn })
    if (!saved) return
    setEditing(false)
    addToast(`Got it: ${DAY_NAMES[saved.weekday]} at ${fmtTime(saved.kickoff)}`, 'success', 3000)
    if (pushSupported() && pushPermission() !== 'denied' && !saved.push_on) setOfferPush(true)
    else if (first && !saved.email_on) addToast('Turn on email or notifications to get the reminder', 'info', 3500)
  }

  async function handlePush(on) {
    setOfferPush(false)
    if (!on) { await save({ push_on: false }); return }
    try {
      const ok = await enablePush(userId)
      if (!ok) { addToast('Notifications are blocked. You can still get the email.', 'info', 4000); return }
      await save({ push_on: true })
      addToast("You'll get a notification the evening before and 2 hours before kickoff", 'success', 4000)
    } catch {
      addToast('Could not turn on notifications on this device', 'error', 4000)
    }
  }

  // ── Set / edit ──
  if (!row || editing) {
    return (
      <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>📅 When do you usually play?</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
            I'll remind you the evening before, so tomorrow's lineup takes 30 seconds.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {DAYS.map((d, i) => (
            <button key={d} type="button" onClick={() => setWeekday(i)} style={chip(weekday === i)}>{d}</button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          Kickoff
          <input type="time" value={kickoff} onChange={e => setKickoff(e.target.value || '09:00')}
            style={{ background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: 8, padding: '6px 10px', fontSize: 14, colorScheme: 'dark' }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          <input type="checkbox" checked={emailOn} onChange={e => setEmailOn(e.target.checked)} />
          Email me the evening before
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {row && <button type="button" onClick={() => setEditing(false)} style={btn(false)}>Cancel</button>}
          <button type="button" onClick={handleSave} disabled={saving} style={{ ...btn(true), opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save game time'}
          </button>
        </div>
      </div>
    )
  }

  // ── Saved ──
  const pushOn = row.push_on && pushPermission() === 'granted'
  const channels = [row.email_on && 'email', pushOn && 'notification'].filter(Boolean)
  return (
    <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
            📅 Games: {DAY_NAMES[row.weekday]} · {fmtTime(row.kickoff)}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
            {channels.length ? `Reminder by ${channels.join(' and ')}, the evening before` : 'Reminders are off'}
          </div>
        </div>
        <button type="button" onClick={startEdit} style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
          color: 'rgba(255,255,255,0.75)', fontSize: 12, padding: '6px 12px', flexShrink: 0,
        }}>Edit</button>
      </div>

      {offerPush && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
            Want a notification on this phone too? Evening before, and 2 hours before kickoff. Nothing else.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => handlePush(false)} style={btn(false)}>
              {row.email_on ? 'Email is fine' : 'No thanks'}
            </button>
            <button type="button" onClick={() => handlePush(true)} style={btn(true)}>Yes, notify me</button>
          </div>
        </div>
      )}

      {!offerPush && pushSupported() && pushPermission() !== 'denied' && (
        <button type="button" onClick={() => (pushOn ? handlePush(false) : handlePush(true))} style={{
          alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0,
          color: '#00c853', fontSize: 12, textDecoration: 'underline',
        }}>
          {pushOn ? 'Turn off notifications' : 'Also notify me on this phone'}
        </button>
      )}
    </div>
  )
}
