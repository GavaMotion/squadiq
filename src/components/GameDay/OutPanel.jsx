// ── Draggable mini-tag inside OUT panel ───────────────────────────
function MiniTag({ player, badge, isMobile, onDragStart, fromSource, isDragging }) {
  const isOutAll = fromSource === 'outall'

  return (
    <div
      onPointerDown={e => onDragStart(e, player.id, fromSource, null)}
      style={{
        width:          isMobile ? 59 : 68,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            2,
        padding:        '5px 3px',
        background:     'rgba(220,50,50,0.1)',
        border:         '1.5px solid rgba(220,50,50,0.3)',
        borderRadius:   7,
        opacity:        isDragging ? 0.3 : 1,
        cursor:         'grab',
        touchAction:    'none',
        userSelect:     'none',
        filter:         isOutAll ? 'grayscale(0.7) opacity(0.6)' : 'grayscale(0.4) opacity(0.75)',
        flexShrink:     0,
        transition:     'opacity 0.1s',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {player.jersey_number}
      </span>
      <span style={{
        fontSize:     10,
        color:        '#d1d5db',
        maxWidth:     '100%',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
        textAlign:    'center',
      }}>
        {player.name.split(' ')[0]}
      </span>
      {badge && (
        <span style={{
          fontSize:   8,
          fontWeight: 700,
          color:      '#fca5a5',
          background: 'rgba(220,50,50,0.3)',
          borderRadius: 3,
          padding:    '1px 3px',
          lineHeight: 1.2,
        }}>
          {badge}
        </span>
      )}
    </div>
  )
}

// ── Drop zone section ─────────────────────────────────────────────
function DropSection({ dropAttr, label, players, fromSource, badge, isOver, isMobile, onDragStart, draggingPlayerId }) {
  return (
    <div
      data-drop={dropAttr}
      style={{
        flex:           1,
        minHeight:      0,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        padding:        '6px 4px',
        gap:            5,
        background:     isOver ? 'rgba(220,50,50,0.15)' : 'transparent',
        transition:     'background 0.12s',
        overflowY:      'auto',
        overflowX:      'hidden',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <span style={{
        flexShrink:    0,
        fontSize:      8,
        fontWeight:    700,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color:         isOver ? 'rgba(220,80,80,0.9)' : 'rgba(220,50,50,0.55)',
        transition:    'color 0.12s',
      }}>
        {label}
      </span>

      {players.map(p => (
        <MiniTag
          key={p.id}
          player={p}
          fromSource={fromSource}
          badge={badge}
          isMobile={isMobile}
          onDragStart={onDragStart}
          isDragging={draggingPlayerId === p.id}
        />
      ))}

      {players.length === 0 && (
        <span style={{
          fontSize:   8,
          color:      'rgba(220,50,50,0.25)',
          textAlign:  'center',
          lineHeight: 1.4,
          marginTop:  4,
          padding:    '0 4px',
        }}>
          Drop here
        </span>
      )}
    </div>
  )
}

// ── Main out panel ────────────────────────────────────────────────
export default function OutPanel({
  players,
  outAllIds,     // Set<playerId>
  outQIds,       // { 1: Set, 2: Set, 3: Set, 4: Set }
  viewedQuarter,
  isMobile,
  onDragStart,
  draggingPlayerId,
  outAllIsOver,
  outQIsOver,
  freeMode,      // free subs has no quarters, so no per-quarter OUT bucket
}) {
  const outAllPlayers = players.filter(p => outAllIds.has(p.id))
  const outQPlayers   = players.filter(
    p => !outAllIds.has(p.id) && (outQIds[viewedQuarter] || new Set()).has(p.id)
  )

  const w = 80

  return (
    <div style={{
      width:         w,
      flexShrink:    0,
      display:       'flex',
      flexDirection: 'column',
      background:    'rgba(0,0,0,0.28)',
      borderLeft:    '1px solid rgba(220,50,50,0.18)',
    }}>
      {/* OUT ALL section */}
      <DropSection
        dropAttr="out-all"
        label="OUT"
        players={outAllPlayers}
        fromSource="outall"
        badge="ALL"
        isOver={outAllIsOver}
        isMobile={isMobile}
        onDragStart={onDragStart}
        draggingPlayerId={draggingPlayerId}
      />

      {/* Divider — only when there is a second bucket below it */}
      {!freeMode && (<>
      <div style={{
        height:     1,
        background: 'rgba(220,50,50,0.15)',
        flexShrink: 0,
        position:   'relative',
      }}>
        <span style={{
          position:   'absolute',
          left:       '50%',
          top:        '50%',
          transform:  'translate(-50%,-50%)',
          fontSize:   7,
          color:      'rgba(255,255,255,0.15)',
          background: 'rgba(0,0,0,0.3)',
          padding:    '0 3px',
          whiteSpace: 'nowrap',
        }}>
          ···
        </span>
      </div>

      {/* OUT Q section */}
      <DropSection
        dropAttr="out-quarter"
        label={`Q${viewedQuarter}`}
        players={outQPlayers}
        fromSource="outq"
        badge={`Q${viewedQuarter}`}
        isOver={outQIsOver}
        isMobile={isMobile}
        onDragStart={onDragStart}
        draggingPlayerId={draggingPlayerId}
      />
      </>)}
    </div>
  )
}
