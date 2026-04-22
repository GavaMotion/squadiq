import { useMemo } from 'react'

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

// ── Single draggable player tag ───────────────────────────────────
function PlayerTag({ player, quarterStates, isOnFieldNow, totalPlanned, isMobile, dimmed, onDragStart, isDragging, isShaking }) {
  let borderColor
  if (totalPlanned >= 3)      borderColor = '#00c853'
  else if (totalPlanned > 0)  borderColor = '#EF9F27'
  else                         borderColor = 'rgba(255,255,255,0.18)'

  const w = isMobile ? 68 : 76
  const h = isMobile ? 56 : 64

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
        background:     isOnFieldNow ? 'rgba(0,200,83,0.15)' : 'rgba(255,255,255,0.07)',
        border:         `2px solid ${borderColor}`,
        borderRadius:   8,
        opacity:        isDragging ? 0.3 : dimmed ? 0.85 : 1,
        cursor:         'grab',
        touchAction:    'none',
        userSelect:     'none',
        flexShrink:     0,
        boxShadow:      isOnFieldNow ? '0 0 8px rgba(0,200,83,0.25)' : 'none',
        transition:     'border-color 0.15s, background 0.15s, box-shadow 0.15s, opacity 0.1s',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15, color: '#fff', lineHeight: 1 }}>
        {player.jersey_number}
      </span>
      <span style={{
        fontSize:     10,
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
      <div style={{ display: 'flex', gap: 2 }}>
        {quarterStates.map((st, i) => <QDot key={i} state={st} />)}
      </div>
    </div>
  )
}

// ── Tag wrap row ──────────────────────────────────────────────────
function TagRow({ players, getQStates, getTotalPlanned, onFieldSet, isMobile, dimmed, onDragStart, draggingPlayerId, shakingPlayerId }) {
  return (
    <div style={{
      display:     'flex',
      flexWrap:    'wrap',
      gap:         5,
      alignContent:'flex-start',
      padding:     '4px 6px',
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
  onDragStart,
  draggingPlayerId,
  shakingPlayerId,
  benchIsOver,
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
      const diff = getTotalPlanned(a.id) - getTotalPlanned(b.id)
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
        background:    benchIsOver ? 'rgba(0,200,83,0.04)' : '#0d1117',
        borderTop:     '1px solid rgba(255,255,255,0.06)',
        transition:    'background 0.15s',
      }}
    >
      <div style={{ paddingBottom: 8 }}>

        {/* ── Active quarter players ── */}
        {activePlayers.length > 0 && (
          <>
            <div style={{
              padding:       '5px 8px 2px',
              fontSize:      9,
              fontWeight:    700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color:         'rgba(0,200,83,0.5)',
            }}>
              Q{viewedQuarter} FIELD · {activePlayers.length}
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
            />
          </>
        )}

        {/* ── Bench Q[N] section ── */}
        <div style={{
          margin:     activePlayers.length > 0 ? '6px 0 0' : 0,
          borderTop:  activePlayers.length > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
          background: 'rgba(255,255,255,0.04)',
          minHeight:  40,
        }}>
          <div style={{
            padding:       '5px 8px 2px',
            fontSize:      9,
            fontWeight:    700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color:         benchIsOver ? 'rgba(0,200,83,0.6)' : 'rgba(255,255,255,0.55)',
            transition:    'color 0.15s',
          }}>
            BENCH Q{viewedQuarter} · {benchPlayers.length}
          </div>
          {benchPlayers.length === 0 ? (
            <p style={{
              fontSize:  11,
              color:     'rgba(255,255,255,0.5)',
              fontStyle: 'italic',
              padding:   '4px 10px 8px',
              margin:    0,
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
            />
          )}
        </div>

      </div>
    </div>
  )
}
