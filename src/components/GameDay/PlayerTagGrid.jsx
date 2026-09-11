import { useMemo, useRef } from 'react'
import theme from '../../theme'
import { playtimeLevel } from '../../lib/playtime'
import PlayTimeBar from './PlayTimeBar'
import { fmtMs, isOnField, playedMsFor } from '../../lib/freeSubs'

// ── Quarter dot ───────────────────────────────────────────────────
function QDot({ state }) {
  return (
    <div style={{
      width:        5,
      height:       5,
      borderRadius: '50%',
      flexShrink:   0,
      background:   state === 'assigned' ? '#00c853' : 'transparent',
      border:       `1.5px solid ${
        state === 'assigned' ? '#00c853' :
        state === 'out'      ? 'rgba(255,80,80,0.7)' :
                               'rgba(255,255,255,0.25)'
      }`,
    }} />
  )
}

// How long a finger must rest on a tag before it becomes a drag rather than
// a scroll, and how far it may stray in that window before the drag is off.
const HOLD_MS   = 170
const SLOP_PX   = 8

// ── Single draggable player tag ───────────────────────────────────
function PlayerTag({ player, quarterStates, isOnFieldNow, totalPlanned, isMobile, dimmed, onDragStart, isDragging, isShaking, freeSubs }) {
  const holdRef = useRef(null)

  function cancelHold() {
    if (holdRef.current?.timer) clearTimeout(holdRef.current.timer)
    holdRef.current = null
  }

  function handlePointerDown(e) {
    // A mouse has no scrolling to compete with, so it drags on contact.
    if (e.pointerType !== 'touch') {
      onDragStart(e, player.id, 'bench', null)
      return
    }
    // Touch has to share: grabbing on contact would make the bench
    // impossible to scroll, because every tag would swallow the gesture.
    const el = e.currentTarget
    const { clientX, clientY } = e
    const timer = setTimeout(() => {
      if (holdRef.current) holdRef.current.timer = null
      onDragStart(
        { preventDefault() {}, currentTarget: el, clientX, clientY },
        player.id, 'bench', null,
      )
    }, HOLD_MS)
    holdRef.current = { timer, x: clientX, y: clientY }
  }

  function handlePointerMove(e) {
    const h = holdRef.current
    if (!h?.timer) return
    // Moved before the hold elapsed — they are scrolling, not dragging.
    if (Math.abs(e.clientX - h.x) > SLOP_PX || Math.abs(e.clientY - h.y) > SLOP_PX) cancelHold()
  }
  // Free subs has no three-quarter rule to warn about, so the outline just
  // says whether this player is on the field right now.
  const borderColor = freeSubs
    ? (isOnFieldNow ? theme.freeAccent : 'rgba(255,255,255,0.14)')
    : { ok: '#00c853', near: '#EF9F27', short: '#ef4444' }[playtimeLevel(totalPlanned)]

  const w = isMobile ? 75 : 84
  const h = freeSubs ? (isMobile ? 74 : 82) : (isMobile ? 62 : 70)

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      className={isShaking ? 'shake' : undefined}
      style={{
        width:          w,
        height:         h,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            3,
        padding:        '3px 4px',
        background:     isOnFieldNow
          ? (freeSubs ? theme.freeAccentDim : 'rgba(0,200,83,0.15)')
          : 'rgba(255,255,255,0.07)',
        border:         `2px solid ${borderColor}`,
        borderRadius:   8,
        opacity:        isDragging ? 0.3 : dimmed ? 0.85 : 1,
        cursor:         'grab',
        // pan-y, not none: the bench scrolls, and the hold above is what
        // separates a drag from a scroll.
        touchAction:    'pan-y',
        userSelect:     'none',
        flexShrink:     0,
        boxShadow:      isOnFieldNow
          ? (freeSubs ? `0 0 10px ${theme.freeAccentGlow}` : '0 0 8px rgba(0,200,83,0.25)')
          : 'none',
        transition:     'border-color 0.15s, background 0.15s, box-shadow 0.15s, opacity 0.1s',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: isMobile ? 16 : 17, color: '#fff', lineHeight: 1 }}>
        {player.jersey_number}
      </span>
      <span style={{
        fontSize:     freeSubs ? 11 : 12,
        color:        '#d1d5db',
        lineHeight:   1.2,
        maxWidth:     '90%',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
        textAlign:    'center',
      }}>
        {player.name.split(' ')[0]}
      </span>
      {freeSubs ? (
        <div style={{ width: '86%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <PlayTimeBar
            stints={freeSubs.stints}
            playerId={player.id}
            nowMs={freeSubs.nowMs}
            totalMs={freeSubs.totalMs}
            height={5}
            live={isOnFieldNow}
          />
          <span style={{
            fontSize: isMobile ? 15 : 16, fontWeight: 700, lineHeight: 1.05,
            fontVariantNumeric: 'tabular-nums',
            color: isOnFieldNow ? theme.freeAccentBright : 'rgba(255,255,255,0.72)',
          }}>
            {fmtMs(playedMsFor(freeSubs.stints, player.id, freeSubs.nowMs))}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 2 }}>
          {quarterStates.map((st, i) => <QDot key={i} state={st} />)}
        </div>
      )}
    </div>
  )
}

// ── Tag wrap row ──────────────────────────────────────────────────
function TagRow({ players, getQStates, getTotalPlanned, onFieldSet, isMobile, dimmed, onDragStart, draggingPlayerId, shakingPlayerId, freeSubs }) {
  return (
    <div style={{
      display:      'flex',
      flexWrap:     'wrap',
      gap:          5,
      alignContent: 'flex-start',
      padding:      '4px 6px',
      flexShrink:   0,
    }}>
      {players.map(player => (
        <PlayerTag
          key={player.id}
          player={player}
          quarterStates={getQStates(player.id)}
          isOnFieldNow={onFieldSet.has(player.id)}
          totalPlanned={getTotalPlanned(player.id)}
          isMobile={isMobile}
          dimmed={dimmed}
          onDragStart={onDragStart}
          isDragging={draggingPlayerId === player.id}
          isShaking={shakingPlayerId === player.id}
          freeSubs={freeSubs}
        />
      ))}
    </div>
  )
}

// ── Main grid (bench drop zone) ───────────────────────────────────
export default function PlayerTagGrid({
  players,
  quarterPlans,
  viewedQuarter,
  outAllIds,
  outQIds,
  isMobile,
  fillHeight,
  onDragStart,
  draggingPlayerId,
  shakingPlayerId,
  benchIsOver,
  freeSubs,
}) {
  function getQuarterStates(pid) {
    return [1, 2, 3, 4].map(q => {
      if (outAllIds.has(pid)) return 'out'
      if ((outQIds[q] || new Set()).has(pid)) return 'out'
      return Object.values(quarterPlans[q] || {}).some(id => id === pid) ? 'assigned' : 'none'
    })
  }

  function getTotalPlanned(pid) {
    return [1, 2, 3, 4].filter(q =>
      Object.values(quarterPlans[q] || {}).some(id => id === pid)
    ).length
  }

  const onFieldInViewed = useMemo(
    () => new Set(Object.values((quarterPlans?.[viewedQuarter]) || {}).filter(Boolean)),
    [quarterPlans, viewedQuarter]
  )

  const curOutQ = outQIds?.[viewedQuarter] || new Set()

  const availablePlayers = useMemo(() =>
    (players || []).filter(p => !outAllIds.has(p.id) && !curOutQ.has(p.id)),
    [players, outAllIds, outQIds, viewedQuarter] // eslint-disable-line
  )

  function sortPlayers(list) {
    return [...list].sort((a, b) => {
      // Both modes put whoever is furthest behind first, so the next player to
      // send on is always the leftmost tag: fewest quarters, or fewest minutes.
      const diff = freeSubs
        ? playedMsFor(freeSubs.stints, a.id, freeSubs.nowMs) - playedMsFor(freeSubs.stints, b.id, freeSubs.nowMs)
        : getTotalPlanned(a.id) - getTotalPlanned(b.id)
      return diff !== 0 ? diff : (a.jersey_number ?? 0) - (b.jersey_number ?? 0)
    })
  }

  const activePlayers = sortPlayers(availablePlayers.filter(p => onFieldInViewed.has(p.id)))
  const benchPlayers  = sortPlayers(availablePlayers.filter(p => !onFieldInViewed.has(p.id)))

  return (
    <div
      data-drop="bench"
      style={{
        minWidth:      0,
        display:       'flex',
        flexDirection: 'column',
        background:    benchIsOver
          ? (freeSubs ? 'rgba(0,184,212,0.05)' : 'rgba(0,200,83,0.04)')
          : (freeSubs ? theme.freePanelBg : '#0d1117'),
        borderTop:     '1px solid rgba(255,255,255,0.06)',
        transition:    'background 0.15s',
        ...(fillHeight ? { flex: 1, minHeight: 0 } : {}),
      }}
    >
      <div style={{
        paddingBottom: 8,
        ...(fillHeight ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : {}),
      }}>

        {/* ── Active quarter players ── */}
        {activePlayers.length > 0 && (
          <>
            <div style={{
              padding:       '5px 8px 2px',
              fontSize:      9,
              fontWeight:    700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color:         freeSubs ? theme.freeAccentBright : 'rgba(0,200,83,0.5)',
              flexShrink:    0,
            }}>
              {freeSubs ? 'ON FIELD' : `Q${viewedQuarter} FIELD`} · {activePlayers.length}
            </div>
            <TagRow
              players={activePlayers}
              getQStates={getQuarterStates}
              getTotalPlanned={getTotalPlanned}
              onFieldSet={onFieldInViewed}
              isMobile={isMobile}
              dimmed={false}
              onDragStart={onDragStart}
              draggingPlayerId={draggingPlayerId}
              shakingPlayerId={shakingPlayerId}
              freeSubs={freeSubs}
            />
          </>
        )}

        {/* ── Bench Q[N] section ── */}
        <div style={{
          margin:     activePlayers.length > 0 ? '6px 0 0' : 0,
          borderTop:  activePlayers.length > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
          background: 'rgba(255,255,255,0.04)',
          minHeight:  40,
          ...(fillHeight ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : {}),
        }}>
          <div style={{
            padding:       '5px 8px 2px',
            fontSize:      9,
            fontWeight:    700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color:         benchIsOver ? 'rgba(0,200,83,0.6)' : 'rgba(255,255,255,0.55)',
            transition:    'color 0.15s',
            flexShrink:    0,
          }}>
            {freeSubs ? 'BENCH' : `BENCH Q${viewedQuarter}`} · {benchPlayers.length}
          </div>
          {/* Spacer pushes bench tags to the bottom edge of the pane */}
          {fillHeight && <div style={{ flex: 1, minHeight: 0 }} />}
          {benchPlayers.length === 0 ? (
            <p style={{
              fontSize:  11,
              color:     'rgba(255,255,255,0.5)',
              fontStyle: 'italic',
              padding:   '4px 10px 8px',
              margin:    0,
              flexShrink: 0,
            }}>
              All players on field
            </p>
          ) : (
            <TagRow
              players={benchPlayers}
              getQStates={getQuarterStates}
              getTotalPlanned={getTotalPlanned}
              onFieldSet={onFieldInViewed}
              isMobile={isMobile}
              dimmed={true}
              onDragStart={onDragStart}
              draggingPlayerId={draggingPlayerId}
              shakingPlayerId={shakingPlayerId}
              freeSubs={freeSubs}
            />
          )}
        </div>

      </div>
    </div>
  )
}
