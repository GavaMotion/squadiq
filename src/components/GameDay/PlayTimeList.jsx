import { useMemo, useState } from 'react'
import theme from '../../theme'
import PlayTimeBar from './PlayTimeBar'
import { fmtMs, isOnField, pctOf, playedMsFor } from '../../lib/freeSubs'

/**
 * Playing-time ranking — least-played first, because that is the question a
 * coach actually asks during a free-subs game ("who goes on next?").
 *
 * Desktop renders it as a pane under the player tags, where there is room for
 * both. The phone renders it as a drawer off the right edge: on a small screen
 * anything anchored to the bottom covers the bench, and the bench is what a
 * coach is reaching for mid-game.
 *
 * Props:
 *   players     Player[]  (already filtered to available players)
 *   freeSubs    free-subs state
 *   nowMs       current game ms
 *   totalMs     full game length in ms
 *   isMobile    bool
 *   drawer      bool — right-edge drawer instead of a pane
 *   outIds      Set<playerId> marked OUT for the game
 */
export default function PlayTimeList({ players, freeSubs, nowMs, totalMs, isMobile, drawer = false, outIds }) {
  const [open, setOpen] = useState(!drawer)

  const rows = useMemo(() => {
    const stints = freeSubs?.stints || []
    return (players || [])
      .map(p => ({
        player: p,
        ms:     playedMsFor(stints, p.id, nowMs),
        live:   isOnField(stints, p.id),
        out:    !!outIds?.has(p.id),
      }))
      .sort((a, b) => (a.ms - b.ms) || (a.player.jersey_number ?? 0) - (b.player.jersey_number ?? 0))
  }, [players, freeSubs, nowMs, outIds])

  const spread = rows.length ? fmtMs(rows[rows.length - 1].ms - rows[0].ms) : '0:00'

  const rowList = (
    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
      {rows.length === 0 && (
        <div style={{ padding: '14px 12px', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
          No players available.
        </div>
      )}
      {rows.map(({ player, ms, live, out }) => (
        <div
          key={player.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '24px minmax(60px, 100px) 1fr 76px',
            alignItems: 'center',
            gap: 8,
            padding: isMobile ? '9px 10px' : '6px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            background: live ? theme.freeAccentDim : 'transparent',
            opacity: out ? 0.55 : 1,
          }}
        >
          <span style={{
            fontSize: 11, fontWeight: 700, textAlign: 'center',
            color: live ? theme.freeAccentBright : 'rgba(255,255,255,0.55)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {player.jersey_number}
          </span>

          <span style={{
            fontSize: 12, color: '#e5e7eb', lineHeight: 1.1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {player.name}
            {out && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}> · out</span>}
          </span>

          <PlayTimeBar
            stints={freeSubs?.stints || []}
            playerId={player.id}
            nowMs={nowMs}
            totalMs={totalMs}
            height={7}
            live={live}
          />

          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: live ? theme.freeAccentBright : '#ffffff' }}>
              {fmtMs(ms)}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 5 }}>
              {pctOf(ms, totalMs)}%
            </span>
          </span>
        </div>
      ))}
    </div>
  )

  // ── Phone: right-edge drawer ────────────────────────────────────
  if (drawer) {
    return (
      <>
        {/* Handle — a tab on the right edge, clear of the bench tags */}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            aria-label="Show playing time"
            style={{
              position: 'absolute', right: 0, bottom: 14, zIndex: 30,
              width: 28, padding: '14px 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: theme.freePanelBg,
              border: `1px solid ${theme.freeAccentDim}`,
              borderRight: 'none',
              borderRadius: '10px 0 0 10px',
              boxShadow: '-3px 0 12px rgba(0,0,0,0.45)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{
              writingMode: 'vertical-rl', transform: 'rotate(180deg)',
              fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: theme.freeAccentBright,
            }}>
              Playing time
            </span>
          </button>
        )}

        {open && (
          <>
            {/* Scrim — tap anywhere off the drawer to close it */}
            <div
              onClick={() => setOpen(false)}
              style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.55)' }}
            />
            <div style={{
              position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 31,
              width: 'min(340px, 88%)',
              display: 'flex', flexDirection: 'column',
              background: theme.freePanelBg,
              borderLeft: `1px solid ${theme.freeAccent}`,
              boxShadow: '-12px 0 34px rgba(0,0,0,0.7)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                padding: '10px 8px 10px 12px', background: 'rgba(0,0,0,0.25)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.09em',
                  textTransform: 'uppercase', color: theme.freeAccentBright,
                }}>
                  Playing time
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                  spread {spread}
                </span>
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close playing time"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.5)', fontSize: 18, lineHeight: 1,
                    padding: '2px 6px', fontFamily: 'inherit',
                  }}
                >
                  ✕
                </button>
              </div>
              {rowList}
            </div>
          </>
        )}
      </>
    )
  }

  // ── Desktop: pane under the tags ────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: 0, flexShrink: 0,
      background: theme.freePanelBg,
      borderTop: `1px solid ${theme.freeAccentDim}`,
      ...(open ? { flex: '1 1 45%' } : {}),
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 10px', background: 'rgba(0,0,0,0.25)', border: 'none',
          borderBottom: open ? '1px solid rgba(255,255,255,0.05)' : 'none',
          cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
        }}
      >
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.09em',
          textTransform: 'uppercase', color: theme.freeAccentBright,
        }}>
          Playing time
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
          least first · spread {spread}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: theme.freeAccentBright }}>{open ? '▼' : '▲'}</span>
      </button>
      {open && rowList}
    </div>
  )
}
