import { useEffect, useRef, useState } from 'react'
import { shouldAskForRating, recordAsked, openStoreReview, requestNativeReview, ratingPlatform } from '../../lib/review'

// Android: a small card, not a modal. A good moment (AI lineup built, game
// ended, sheet shared) is remembered, and the card appears only once the coach
// is off the Lineup screen, so it can never cover the bench. No "do you like
// it?" gate first: both stores forbid filtering who gets asked.
// iOS: no card at all; Apple's own sheet is requested directly.
export default function RatingPrompt({ tab }) {
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(false)
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
      setOpen(true)
    }, 1500)
    return () => clearTimeout(t)
  }, [pending, open, tab])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!open || tab === 'lineup') return null

  return (
    <div role="dialog" aria-label="Rate SquadIQ" style={{
      position: 'fixed', left: 12, right: 12, zIndex: 9000,
      bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
      maxWidth: 420, margin: '0 auto',
      background: '#1a1a2e', border: '1px solid rgba(0,200,83,0.3)', borderRadius: 14,
      padding: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>⭐ Help other coaches find SquadIQ</div>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.5 }}>
        It's built by one coach dad. A quick rating on Google Play is the biggest thing that helps new coaches find it.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setOpen(false)} style={{
          flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10, padding: 10, color: '#fff', fontSize: 13,
        }}>Not now</button>
        <button onClick={() => { setOpen(false); openStoreReview() }} style={{
          flex: 1, background: '#00c853', border: 'none', borderRadius: 10, padding: 10,
          color: '#052711', fontSize: 13, fontWeight: 700,
        }}>Rate SquadIQ</button>
      </div>
    </div>
  )
}
