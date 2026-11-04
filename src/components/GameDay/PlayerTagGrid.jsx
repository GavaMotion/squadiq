import { useMemo } from 'react'
import theme from '../../theme'
import { playtimeLevel, targetQuarters, PLAYTIME_COLORS } from '../../lib/playtime'
import PlayTimeBar from './PlayTimeBar'
import { fmtMs, isOnField, playedMsFor } from '../../lib/freeSubs'

// ── Quarter box ───────────────────────────────────────────────────
// One numbered box per quarter: filled = playing that quarter, red and
// struck through = out, empty outline = on the bench. Reviewers read the old
// unlabelled dots as decoration; a number says "quarter" without a key.
function QBox({ q, state }) {
  const playing = state === 'assigned'
  const out     = state === 'out'
  return (
    <div style={{
      width:          16,
      height:         16,
      borderRadius:   3,
      flexShrink:     0,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontSize:       11,
      fontWeight:     700,
      lineHeight:     1,
      fontVariantNumeric: 'tabular-nums',
      background:     playing ? '#00c853' : 'transparent',
      color:          playing ? '#04210f' : out ? 'rgba(255,110,110,0.95)' : 'rgba(255,255,255,0.55)',
      textDecoration: out ? 'line-through' : 'none',
      border:         `1px solid ${
        playing ? '#00c853' :
        out     ? 'rgba(255,90,90,0.8)' :
                  'rgba(255,255,255,0.3)'
      }`,
    }}>
      {q}
    </div>
  )
}

const Q_STATE_WORD = { assigned: 'playing', out: 'out', none: 'bench' }

// ── Single draggable player tag ───────────────────────────────────
function PlayerTag({ player, quarterStates, isOnFieldNow, totalPlanned, target, isMobile, dimmed, onDragStart, isDragging, isShaking, freeSubs }) {
  // Free subs has no three-quarter rule to warn about, so the outline just
  // says whether this player is on the field right now.
  const borderColor = freeSubs
    ? (isOnFieldNow ? theme.freeAccent : 'rgba(255,255,255,0.14)')
    : PLAYTIME_COLORS[playtimeLevel(totalPlanned, target)]

  const w = isMobile ? 75 : 84
  const h = freeSubs ? (isMobile ? 74 : 82) : (isMobile ? 62 : 70)

  return (
    <div
      onPointerDown={e => onDragStart(e, player.id, 'bench', null)}
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
        // A kid playing the whole game gets a lighter green card, so they
        // stand apart from three-quarter kids without another outline colour.
        background:     !freeSubs && totalPlanned >= 4
          ? 'rgba(0,200,83,0.32)'
          : isOnFieldNow
          ? (freeSubs ? theme.freeAccentDim : 'rgba(0,200,83,0.15)')
          : 'rgba(255,255,255,0.07)',
        border:         `2px solid ${borderColor}`,
        borderRadius:   8,
        opacity:        isDragging ? 0.3 : dimmed ? 0.85 : 1,
        cursor:         'grab',
        // The tag owns the gesture the moment it is touched; the bench is
        // scrolled with the rail beside it, not by dragging the tags.
        touchAction:    'none',
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
        <div style={{ display: 'flex', gap: 2 }}
          aria-label={quarterStates.map((st, i) => `Q${i + 1} ${Q_STATE_WORD[st] || 'bench'}`).join(', ')}>
          {quarterStates.map((st, i) => <QBox key={i} q={i + 1} state={st} />)}
        </div>
      )}
    </div>
  )
}

// ── Tag wrap row ──────────────────────────────────────────────────
function TagRow({ players, getQStates, getTotalPlanned, getTarget, onFieldSet, isMobile, dimmed, onDragStart, draggingPlayerId, shakingPlayerId, freeSubs }) {
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
          target={getTarget(player.id)}
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
  targetFor,
}) {
  function getQuarterStates(pid) {
    return [1, 2, 3, 4].map(q => {
      if (outAllIds.has(pid)) return 'out'
      if ((outQIds[q] || new Set()).has(pid)) return 'out'
      return Object.values(quarterPlans[q] || {}).some(id => id === pid) ? 'assigned' : 'none'
    })
  }

  function getTarget(pid) {
    if (targetFor) return targetFor(pid)
    return targetQuarters([1, 2, 3, 4].filter(q => (outQIds?.[q] || new Set()).has(pid)).length)
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

  // On a phone the field list repeats the pitch just above it and pushed the
  // bench below the fold — and the bench is what a coach reaches for during
  // a sub. So phones list the bench first.
  const benchFirst = !!isMobile

  const fieldSection = activePlayers.length > 0 && (
          <>
            <div style={{
              padding:       '5px 8px 2px',
              fontSize:      11,
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
            getTarget={getTarget}
              onFieldSet={onFieldInViewed}
              isMobile={isMobile}
              dimmed={false}
              onDragStart={onDragStart}
              draggingPlayerId={draggingPlayerId}
              shakingPlayerId={shakingPlayerId}
              freeSubs={freeSubs}
            />
          </>
  )

  const benchSection = (
        <div style={{
          margin:     !benchFirst && activePlayers.length > 0 ? '6px 0 0' : 0,
          borderTop:  !benchFirst && activePlayers.length > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
          borderBottom: benchFirst ? '1px solid rgba(255,255,255,0.08)' : 'none',
          background: 'rgba(255,255,255,0.04)',
          minHeight:  40,
          ...(fillHeight && !benchFirst ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : { flexShrink: 0 }),
        }}>
          <div style={{
            padding:       '5px 8px 2px',
            fontSize:      11,
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
          {fillHeight && !benchFirst && <div style={{ flex: 1, minHeight: 0 }} />}
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
            getTarget={getTarget}
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
  )

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

        {benchFirst ? <>{benchSection}{fieldSection}</> : <>{fieldSection}{benchSection}</>}
      </div>
    </div>
  )
}
