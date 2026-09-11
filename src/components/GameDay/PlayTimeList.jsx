import { useMemo, useState } from 'react'
import theme from '../../theme'
import PlayTimeBar from './PlayTimeBar'
import { fmtMs, isOnField, pctOf, playedMsFor } from '../../lib/freeSubs'

/**
 * Playing-time ranking — least-played first, because that is the question a
 * coach actually asks during a free-subs game ("who goes on next?").
 *
 * Props:
 *   players     Player[]  (already filtered to available players)
 *   freeSubs    free-subs state
 *   nowMs       current game ms
 *   totalMs     full game length in ms
 *   isMobile    bool
 */
export default function PlayTimeList({ players, freeSubs, nowMs, totalMs, isMobile, sheet = false, outIds }) {
  // Desktop: a pane under the tags, open by default. Phone: a pull-up sheet
  // pinned to the bottom, closed by default so the field keeps its room.
  const [collapsed, setCollapsed] = useState(sheet)

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
  }, [players, freeSubs, nowMs])

  const spread = rows.length
    ? fmtMs(rows[rows.length - 1].ms - rows[0].ms)
    : '0:00'

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      minHeight:     0,
      background:    theme.freePanelBg,
      borderTop:     `1px solid ${theme.freeAccentDim}`,
      flexShrink:    0,
      ...(sheet ? {
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30,
        maxHeight: collapsed ? undefined : '72%',
        boxShadow: collapsed ? '0 -4px 14px rgba(0,0,0,0.45)' : '0 -10px 34px rgba(0,0,0,0.7)',
      } : {}),
      ...(collapsed ? {} : sheet ? {} : { flex: '1 1 45%' }),
    }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: sheet ? '11px 12px' : '7px 10px', background: 'rgba(0,0,0,0.25)', border: 'none',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
          cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
        }}
      >
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase',
          color: theme.freeAccentBright,
        }}>
          Playing time
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
          least first · spread {spread}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: theme.freeAccentBright }}>
          {collapsed ? '▲' : '▼'}
        </span>
      </button>

      {/* Rows */}
      {!collapsed && (
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
                gridTemplateColumns: isMobile ? '22px 1fr 74px' : '24px minmax(70px, 110px) 1fr 84px',
                alignItems: 'center',
                gap: 8,
                padding: isMobile ? '7px 10px' : '6px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: live ? theme.freeAccentDim : 'transparent',
                opacity:    out ? 0.55 : 1,
              }}
            >
              {/* Jersey */}
              <span style={{
                fontSize: 11, fontWeight: 700, textAlign: 'center',
                color: live ? theme.freeAccentBright : 'rgba(255,255,255,0.55)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {player.jersey_number}
              </span>

              {/* Name — its own column on desktop, stacked above the bar on mobile */}
              {isMobile ? (
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{
                    fontSize: 12, color: '#e5e7eb', lineHeight: 1.1,
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
                    height={5}
                    live={live}
                  />
                </div>
              ) : (
                <>
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
                </>
              )}

              {/* Time + share of the game */}
              <span style={{
                textAlign: 'right', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15,
              }}>
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
      )}
    </div>
  )
}
