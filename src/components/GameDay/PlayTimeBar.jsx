import theme from '../../theme'
import { segmentsFor } from '../../lib/freeSubs'

/**
 * One player's game as a bar: the full width is the whole game, the cyan
 * blocks are the spells they were actually on the field. Replaces the four
 * quarter dots while a plan is in free-subs mode.
 *
 * Props:
 *   stints    all stints (filtered by playerId internally)
 *   playerId  string
 *   nowMs     current game ms — open stints are drawn up to here
 *   totalMs   full game length in ms
 *   height    px (default 6)
 *   live      bool — this player is on the field right now
 */
export default function PlayTimeBar({ stints, playerId, nowMs, totalMs, height = 6, live = false }) {
  const segs = segmentsFor(stints, playerId, nowMs, totalMs)

  return (
    <div
      style={{
        position:     'relative',
        width:        '100%',
        height,
        borderRadius: 999,
        background:   theme.freeBarTrack,
        overflow:     'hidden',
        flexShrink:   0,
        boxShadow:    live ? `0 0 0 1px ${theme.freeAccentDim}` : 'none',
      }}
    >
      {segs.map((s, i) => (
        <div
          key={i}
          style={{
            position:   'absolute',
            top:        0,
            bottom:     0,
            left:       `${s.leftPct}%`,
            width:      `${s.widthPct}%`,
            minWidth:   2,
            background: theme.freeBarFill,
            borderRadius: 999,
            // The open stint is the one still growing — mark it so a glance
            // separates "on now" from "was on earlier".
            boxShadow:  s.open ? `0 0 8px ${theme.freeAccentGlow}` : 'none',
          }}
        />
      ))}
    </div>
  )
}
