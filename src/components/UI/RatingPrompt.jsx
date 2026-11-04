import { useEffect, useRef, useState } from 'react'
import { shouldAskForRating, recordAsked, openStoreReview, requestNativeReview, ratingPlatform, markFeedbackSent } from '../../lib/review'
import { supabase } from '../../lib/supabase'
import { APP_VERSION } from '../../version'

// Android: a small card, not a modal. A good moment (lineup auto-filled, game
// ended, sheet shared) is remembered, and the card appears only once the coach
// is off the Lineup screen, so it can never cover the bench.
// The card offers two equal choices: rate on Google Play, or tell us what to
// improve (saved to app_feedback, read on the admin board). There is NO
// "do you like it?" question first and nobody is routed by their answer:
// Google Play forbids gating who gets asked to rate (Apple too).
// iOS: no card at all; Apple's own sheet is requested directly.
export default function RatingPrompt({ tab }) {
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState('ask') // ask | write | thanks
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef(null)

  useEffect(() => {
    function onMoment() {
      if (!shouldAskForRating()) return
      if (ratingPlatform() === 'ios') {
        clearTimeout(timer.current)
        timer.current = setTimeout(requestNativeReview, 4000)
        return
      }
      setPending(true)
    }
    window.addEventListener('sq:good-moment', onMoment)
    return () => window.removeEventListener('sq:good-moment', onMoment)
  }, [])

  useEffect(() => {
    if (!pending || open || tab === 'lineup') return
    const t = setTimeout(() => {
      setPending(false)
      if (!shouldAskForRating()) return
      recordAsked()
      setStep('ask'); setText(''); setError('')
      setOpen(true)
    }, 1500)
    return () => clearTimeout(t)
  }, [pending, open, tab])

  useEffect(() => () => clearTimeout(timer.current), [])

  // Thank-you closes itself.
  useEffect(() => {
    if (step !== 'thanks') return
    const t = setTimeout(() => setOpen(false), 2500)
    return () => clearTimeout(t)
  }, [step])

  // Keep the half-written note visible even on Lineup; only hide the plain ask.
  if (!open || (tab === 'lineup' && step === 'ask')) return null

  async function send() {
    const message = text.trim()
    if (!message || sending) return
    setSending(true); setError('')
    // Rendered outside AppProvider, so read the user from the session and the
    // team from where AppContext remembers it.
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    let teamId = null
    try { teamId = userId ? localStorage.getItem(`active-team-${userId}`) : null } catch { /* private mode */ }
    const { error: err } = !userId ? { error: new Error('signed out') } : await supabase.from('app_feedback').insert({
      user_id: userId, team_id: teamId || null, message: message.slice(0, 2000),
      source: 'rating-card', platform: ratingPlatform() || 'web', app_version: APP_VERSION,
    })
    setSending(false)
    if (err) {
      setError(navigator.onLine === false
        ? 'No signal right now. Your note is still here; try again when you are back online.'
        : 'Could not send that. Your note is still here; please try again.')
      return
    }
    markFeedbackSent()
    setStep('thanks')
  }

  const card = {
    position: 'fixed', left: 12, right: 12, zIndex: 9000,
    bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
    maxWidth: 420, margin: '0 auto',
    background: '#1a1a2e', border: '1px solid rgba(0,200,83,0.3)', borderRadius: 14,
    padding: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column', gap: 10,
  }
  const choice = {
    width: '100%', minHeight: 44, borderRadius: 10, padding: '10px 12px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)',
    color: '#fff', fontSize: 14, fontWeight: 600, textAlign: 'left',
  }
  const quiet = {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 13,
    padding: '8px 4px', minHeight: 36,
  }
  const primary = {
    flex: 1, minHeight: 44, background: '#00c853', border: 'none', borderRadius: 10, padding: 10,
    color: '#052711', fontSize: 14, fontWeight: 700, opacity: text.trim() && !sending ? 1 : 0.5,
  }

  if (step === 'thanks') {
    return (
      <div role="status" style={{ ...card, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Thank you!</div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Your note went straight to the person who builds SquadIQ.</div>
      </div>
    )
  }

  if (step === 'write') {
    return (
      <div role="dialog" aria-label="Tell us what to improve" style={card}>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>💬 What should we improve?</div>
        <textarea
          autoFocus value={text} maxLength={2000} rows={4}
          onChange={e => setText(e.target.value)}
          placeholder="Anything that's confusing, missing or annoying."
          style={{
            width: '100%', resize: 'vertical', background: '#13131f', color: '#fff',
            border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: 10,
            fontSize: 16, fontFamily: 'inherit', lineHeight: 1.4,
          }}
        />
        {error && <div role="alert" style={{ color: '#fca5a5', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setOpen(false)} style={quiet}>Cancel</button>
          <button onClick={send} disabled={!text.trim() || sending} style={primary}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div role="dialog" aria-label="Help improve SquadIQ" style={card}>
      <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Help other coaches find SquadIQ</div>
      <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.5 }}>
        It's built by one coach dad. A rating on Google Play helps new coaches find it, and your ideas make it better.
      </div>
      <button onClick={() => { setOpen(false); openStoreReview() }} style={choice}>⭐ Rate on Google Play</button>
      <button onClick={() => setStep('write')} style={choice}>💬 Tell us what to improve</button>
      <button onClick={() => setOpen(false)} style={{ ...quiet, alignSelf: 'center' }}>Not now</button>
    </div>
  )
}
