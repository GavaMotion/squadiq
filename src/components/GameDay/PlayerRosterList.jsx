import { useMemo, useState, useEffect, useRef } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import theme from '../../theme'
import { playtimeLevel } from '../../lib/playtime'

function useMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width:767px)')
    setM(mq.matches)
    const h = e => setM(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

// ── Quarter dot ───────────────────────────────────────────────────
function QuarterDot({ q, assigned, isViewed, isGreenRow, isMobile }) {
  const filledBg      = isGreenRow ? theme.assignedRowCircle        : theme.quarterCircleFilled
  const bw            = isMobile ? '2px' : '1.5px'
  const unfilledBorder= isGreenRow
    ? `${bw} solid ${theme.assignedRowCircle}`
    : `${bw} solid ${theme.quarterCircleEmpty}`
  const size          = isMobile ? 18 : 10

  return (
    <div
      title={`Q${q}: ${assigned ? 'Assigned' : 'Not assigned'}`}
      style={{
        width:        size,
        height:       size,
        borderRadius: '50%',
        background:   assigned ? filledBg : 'transparent',
        border:       assigned ? 'none' : unfilledBorder,
        outline:      isViewed ? `2px solid ${isGreenRow ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'}` : 'none',
        outlineOffset: 1,
        flexShrink:   0,
      }}
    />
  )
}

// ── Individual player row ─────────────────────────────────────────
function PlayerRow({ player, quarterAssigned, totalPlanned, isAbsent, isOnField, viewedQuarter, onToggleAbsent, isMobile }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:       `roster-${player.id}`,
    data:     { playerId: player.id, fromSlot: 'bench' },
    disabled: isAbsent,
  })

  const level     = playtimeLevel(totalPlanned)
  const needsMore = !isAbsent && !isOnField && level !== 'ok'
  const isShort   = needsMore && level === 'short'

  // ── Row coloring ─────────────────────────────────────────────────
  let rowBg, rowBorderLeft, isGreenRow

  if (isAbsent) {
    rowBg         = theme.playerRowBg
    rowBorderLeft = '3px solid transparent'
    isGreenRow    = false
  } else if (isOnField) {
    rowBg         = theme.assignedRowGradient
    rowBorderLeft = '3px solid rgba(255,255,255,0.5)'
    isGreenRow    = true
  } else if (needsMore) {
    rowBg         = theme.atRiskRowBg
    rowBorderLeft = `3px solid ${isShort ? '#ef4444' : '#5a3407'}`
    isGreenRow    = false
  } else {
    rowBg         = theme.playerRowBg
    rowBorderLeft = '3px solid transparent'
    isGreenRow    = false
  }

  const nameColor  = isGreenRow
    ? '#ffffff'
    : isAbsent
      ? 'rgba(255,255,255,0.6)'
      : needsMore
        ? '#ffffff'
        : '#e5e7eb'

  const countColor = isAbsent
    ? 'rgba(255,255,255,0.4)'
    : isGreenRow
      ? '#ffffff'
      : needsMore
        ? 'rgba(255,255,255,0.75)'
        : 'rgba(255,255,255,0.65)'

  const jerseyBg = isAbsent
    ? 'rgba(255,255,255,0.08)'
    : isGreenRow
      ? theme.assignedRowBadge
      : theme.playerNumberBadge

  return (
    <div
      ref={setNodeRef}
      {...(!isAbsent ? { ...listeners, ...attributes } : {})}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         isMobile ? 10 : 8,
        padding:     isMobile ? '12px 16px' : '6px 8px',
        borderBottom:`1px solid ${theme.playerRowBorder}`,
        transform:   CSS.Transform.toString(transform),
        opacity:     isDragging ? 0.15 : isAbsent ? 0.5 : 1,
        touchAction: 'pan-y',
        userSelect:  'none',
        background:  rowBg,
        borderLeft:  rowBorderLeft,
        cursor:      isAbsent ? 'default' : isDragging ? 'grabbing' : 'grab',
        transition:  'background 0.1s',
      }}
      onMouseEnter={e => {
        if (!isGreenRow && !isAbsent && !isDragging) {
          e.currentTarget.style.background = needsMore
            ? (isShort ? '#8f2222' : '#9b5e0f')
            : theme.playerRowHover
        }
      }}
      onMouseLeave={e => { e.currentTarget.style.background = rowBg }}
    >
      {/* Jersey badge */}
      <div
        style={{
          flexShrink:    0,
          width:         isMobile ? 38 : 22,
          height:        isMobile ? 38 : 22,
          borderRadius:  '50%',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
          fontWeight:    700,
          fontSize:      isMobile ? 15 : 10,
          color:         '#fff',
          background:    jerseyBg,
        }}
      >
        {player.jersey_number}
      </div>

      {/* Name + status chips */}
      <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6, overflow:'hidden' }}>
        <span
          style={{
            color:          nameColor,
            textDecoration: isAbsent ? 'line-through' : 'none',
            fontWeight:     isGreenRow ? 600 : 400,
            fontSize:       isMobile ? 16 : 13,
            overflow:       'hidden',
            textOverflow:   'ellipsis',
            whiteSpace:     'nowrap',
          }}
        >
          {player.name}
        </span>
        {isOnField && !isAbsent && (
          <span style={{ flexShrink:0, fontSize:10, fontWeight:600, color:'#ffffff' }}>
            ● field
          </span>
        )}
        {isAbsent && (
          <span style={{ flexShrink:0, fontSize:10, color:'rgba(255,255,255,0.55)' }}>absent</span>
        )}
        {needsMore && (
          <span style={{ flexShrink:0, fontWeight:600, fontSize:10, color: isShort ? '#f87171' : '#fbbf24' }}>⚠ &lt;3Q</span>
        )}
      </div>

      {/* Quarter dots */}
      <div style={{ display:'flex', gap:4, flexShrink:0 }}>
        {[1, 2, 3, 4].map(q => (
          <QuarterDot
            key={q}
            q={q}
            assigned={quarterAssigned[q]}
            isViewed={q === viewedQuarter}
            isGreenRow={isGreenRow}
            isMobile={isMobile}
          />
        ))}
      </div>

      {/* Quarter count */}
      <span
        style={{
          fontSize:   isMobile ? 14 : 11,
          fontWeight: isGreenRow ? 700 : 400,
          color:      countColor,
          flexShrink: 0,
          width:      isMobile ? 36 : 28,
          textAlign:  'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {isAbsent ? '–' : `${totalPlanned}/4`}
      </span>

      {/* Absent toggle */}
      <button
        onClick={e => { e.stopPropagation(); onToggleAbsent(player.id) }}
        onPointerDown={e => e.stopPropagation()}
        style={{
          flexShrink:    0,
          width:         isMobile ? 44 : 24,
          height:        isMobile ? 44 : 24,
          borderRadius:  isMobile ? '50%' : 4,
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
          background:    'none',
          border:        'none',
          cursor:        'pointer',
          color:         isAbsent
            ? theme.brandGreen
            : isGreenRow
              ? 'rgba(255,255,255,0.6)'
              : 'rgba(255,255,255,0.5)',
        }}
        title={isAbsent ? 'Mark present' : 'Mark absent'}
      >
        {isAbsent ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="9" cy="7" r="4" />
            <path d="M3 21v-2a4 4 0 0 1 4-4h4" />
            <line x1="17" y1="11" x2="23" y2="17" />
            <line x1="23" y1="11" x2="17" y2="17" />
          </svg>
        )}
      </button>
    </div>
  )
}

// ── Main list (droppable bench zone) ──────────────────────────────
export default function PlayerRosterList({
  players,
  quarterPlans,
  viewedQuarter,
  absentIds,
  onToggleAbsent,
}) {
  const isMobile = useMobile()
  const { isOver, setNodeRef } = useDroppable({ id: 'bench' })
  const scrollRef    = useRef(null)
  const prevAbsentSz = useRef(absentIds.size)

  useEffect(() => {
    if (absentIds.size > prevAbsentSz.current && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      }, 100)
    }
    prevAbsentSz.current = absentIds.size
  }, [absentIds.size])

  const onFieldInViewed = useMemo(
    () => new Set(Object.values((quarterPlans?.[viewedQuarter]) || {}).filter(Boolean)),
    [quarterPlans, viewedQuarter]
  )

  function getQuarterAssigned(pid) {
    const result = {}
    for (const q of [1, 2, 3, 4]) {
      result[q] = Object.values(quarterPlans[q] || {}).some(id => id === pid)
    }
    return result
  }

  function getTotalPlanned(pid) {
    return [1, 2, 3, 4].filter(q =>
      Object.values(quarterPlans[q] || {}).some(id => id === pid)
    ).length
  }

  const absentPlayers = players.filter(p => absentIds.has(p.id))
  const activePlayers = useMemo(() =>
    (players || [])
      .filter(p => !absentIds.has(p.id))
      .sort((a, b) => {
        const aQ = getTotalPlanned(a.id)
        const bQ = getTotalPlanned(b.id)
        if (aQ !== bQ) return aQ - bQ
        return (a.jersey_number ?? 0) - (b.jersey_number ?? 0)
      }),
    [players, absentIds, quarterPlans] // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div
      ref={setNodeRef}
      style={{
        flex:          1,
        minHeight:     0,
        display:       'flex',
        flexDirection: 'column',
        overflow:      'clip',
        background:    isOver
          ? 'linear-gradient(180deg, #8f4fc0 0%, #6a3aa0 30%, #4a2580 60%, #321860 100%)'
          : theme.playerPanelGradient,
        borderTop:     `2px solid ${isOver ? theme.brandGreen : 'rgba(120,80,255,0.3)'}`,
        transition:    'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink:   0,
          display:      'flex',
          alignItems:   'center',
          gap:          12,
          padding:      '6px 10px',
          background:   theme.panelHeaderBg,
          borderBottom: `1px solid ${theme.playerRowBorder}`,
        }}
      >
        <span style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'#ffffff' }}>
          Players
        </span>
        <span style={{ fontSize:10, color:theme.panelHeaderText }}>{activePlayers.length} active</span>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginLeft:'auto', fontSize:10, color:theme.panelHeaderText }}>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:theme.brandGreen }} />
            on field
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:'#a0620d' }} />
            2 qtrs
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:'#ef4444' }} />
            &lt;2 qtrs
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
            {[1,2,3,4].map(q => (
              <span key={q} style={{
                color:      q === viewedQuarter ? theme.brandGreen : 'rgba(255,255,255,0.45)',
                fontWeight: q === viewedQuarter ? 700 : 400,
              }}>
                Q{q}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* Rows */}
      <div ref={scrollRef} style={{
        overflowY: 'scroll',
        flex: 1,
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        overscrollBehavior: 'contain',
        paddingBottom: isMobile ? 120 : 80,
      }}>
        {players.length === 0 ? (
          <p style={{ color:'rgba(255,255,255,0.55)', fontSize:12, fontStyle:'italic', padding:'12px 10px' }}>
            No players on roster yet.
          </p>
        ) : (
          <>
            {activePlayers.map(player => (
              <PlayerRow
                key={player.id}
                player={player}
                quarterAssigned={getQuarterAssigned(player.id)}
                totalPlanned={getTotalPlanned(player.id)}
                isAbsent={false}
                isOnField={onFieldInViewed.has(player.id)}
                viewedQuarter={viewedQuarter}
                onToggleAbsent={onToggleAbsent}
                isMobile={isMobile}
              />
            ))}

            {absentPlayers.length > 0 && (
              <>
                <div
                  style={{
                    padding:      '6px 16px',
                    fontSize:     11,
                    color:        'rgba(255,255,255,0.55)',
                    textTransform:'uppercase',
                    letterSpacing:'0.5px',
                    borderTop:    '1px solid rgba(255,255,255,0.08)',
                    marginTop:    4,
                  }}
                >
                  Absent ({absentPlayers.length})
                </div>
                {absentPlayers.map(player => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    quarterAssigned={{ 1:false, 2:false, 3:false, 4:false }}
                    totalPlanned={0}
                    isAbsent={true}
                    isOnField={false}
                    viewedQuarter={viewedQuarter}
                    onToggleAbsent={onToggleAbsent}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
