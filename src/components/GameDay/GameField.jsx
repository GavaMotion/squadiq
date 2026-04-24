/**
 * GameField — completely self-contained soccer field + DnD slots.
 */
import theme from '../../theme'

// ── Zone helper ───────────────────────────────────────────────────
function getZone(label) {
  const l = (label || '').toUpperCase()
  if (l === 'GK') return 'GK'
  if (['CB','RB','LB','SW','RWB','LWB'].includes(l)) return 'DEF'
  if (['CDM','CM','CAM','RM','LM','DM','AM'].includes(l)) return 'MID'
  if (['ST','RW','LW','CF','SS','FW'].includes(l)) return 'FWD'
  // fallback for any remaining generic labels
  if (l === 'DEF') return 'DEF'
  if (l === 'MID') return 'MID'
  if (l === 'FWD') return 'FWD'
  return 'MID'
}

const slotColors = {
  GK:  { border: theme.slotBorderGk,  filledBg: theme.slotFilledGk  },
  DEF: { border: theme.slotBorderDef, filledBg: theme.slotFilledDef },
  MID: { border: theme.slotBorderMid, filledBg: theme.slotFilledMid },
  FWD: { border: theme.slotBorderFwd, filledBg: theme.slotFilledFwd },
}

// ── Draggable player chip (field variant) ────────────────────────
function PlayerChip({ player, fromSlot, sizePct, chipColor, onDragStart, isDragging }) {
  const fs  = `clamp(8px, ${sizePct * 0.29}vw, 13px)`
  const fs2 = `clamp(6px, ${sizePct * 0.22}vw, 10px)`

  return (
    <div
      onPointerDown={e => onDragStart(e, player.id, 'field', fromSlot)}
      style={{
        position:      'absolute',
        inset:         0,
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        justifyContent:'center',
        borderRadius:  '50%',
        background:    chipColor,
        cursor:        'grab',
        touchAction:   'none',
        userSelect:    'none',
        opacity:       isDragging ? 0.3 : 1,
        transition:    'opacity 0.1s',
      }}
    >
      <span style={{ color:'#fff', fontWeight:700, fontSize:fs, lineHeight:1 }}>
        {player.jersey_number}
      </span>
      <span style={{
        color:'#fff', fontSize:fs2, lineHeight:1.3,
        maxWidth:'88%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>
        {player.name.split(' ')[0]}
      </span>
    </div>
  )
}

// ── Droppable slot ───────────────────────────────────────────────
function Slot({ slot, slotSizePct, player, zone, onDragStart, draggingPlayerId, hoverSlotId, isAnyDragging, isOutOfPosition }) {
  const colors = slotColors[zone] || slotColors.FWD
  const isOver     = hoverSlotId === slot.id
  const isDragging = !!player && player.id === draggingPlayerId
  const isMobile   = window.innerWidth < 768
  const hitArea    = isMobile ? 90 : 80
  const visualSize = player ? 57 : 53

  return (
    <div
      data-slot-id={slot.id}
      style={{
        position:   'absolute',
        left:       `${slot.x}%`,
        top:        `${slot.y}%`,
        width:      hitArea,
        height:     hitArea,
        transform:  'translate(-50%,-50%)',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex:     3,
      }}
    >
      {player ? (
        /* Filled slot — visual only, centered inside hit area */
        <div style={{
          position:    'relative',
          width:       visualSize,
          height:      visualSize,
          borderRadius:'50%',
          border:      `2px solid ${isOver ? '#fff' : isOutOfPosition ? '#EF9F27' : theme.slotFilledBorder}`,
          boxShadow:   theme.slotFilledShadow,
          overflow:    'visible',
          flexShrink:  0,
        }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }}>
            <PlayerChip
              player={player}
              fromSlot={slot.id}
              sizePct={slotSizePct}
              chipColor={colors.filledBg}
              onDragStart={onDragStart}
              isDragging={isDragging}
            />
          </div>
          {isOutOfPosition && (
            <div style={{
              position: 'absolute', top: -3, right: -3,
              width: 14, height: 14, borderRadius: '50%',
              background: '#EF9F27',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: '#000', zIndex: 2,
              pointerEvents: 'none',
            }}>!</div>
          )}
        </div>
      ) : (
        /* Empty slot — visual only, centered inside hit area */
        <div style={{
          width:         visualSize,
          height:        visualSize,
          borderRadius:  '50%',
          border:        `2px dashed ${isOver ? '#fff' : colors.border}`,
          background:    isOver ? 'rgba(255,255,255,0.12)' : isAnyDragging ? 'rgba(0,200,83,0.08)' : theme.slotFill,
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
          transition:    'border-color 0.12s, background 0.12s',
          flexShrink:    0,
        }}>
          <span style={{
            color:      isOver ? '#fff' : theme.slotText,
            fontWeight: 700,
            fontSize:   `clamp(7px,${slotSizePct * 0.29}vw,12px)`,
            userSelect: 'none',
          }}>
            {slot.label}
          </span>
        </div>
      )}
    </div>
  )
}

// ── SVG field markings ───────────────────────────────────────────
function FieldSVG() {
  const line = theme.fieldLines
  return (
    <svg
      viewBox="0 0 100 154"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'block', zIndex:0 }}
    >
      {/* Near-black tactical board surface */}
      <rect width="100" height="154" fill={theme.fieldBg} />

      {/* Outer border */}
      <rect x="3" y="3" width="94" height="148" fill="none" stroke={line} strokeWidth="0.7" />
      {/* Halfway line */}
      <line x1="3" y1="77" x2="97" y2="77" stroke={line} strokeWidth="0.7" />
      {/* Centre circle + spot */}
      <circle cx="50" cy="77" r="13" fill="none" stroke={line} strokeWidth="0.7" />
      <circle cx="50" cy="77" r="0.8" fill={line} />

      {/* ── Opponent end (top) ── */}
      <rect x="22" y="3"  width="56" height="23" fill="none" stroke={line} strokeWidth="0.7" />
      <rect x="37" y="3"  width="26" height="8"  fill="none" stroke={line} strokeWidth="0.7" />
      <rect x="44.5" y="0" width="11" height="4.5"
        fill="rgba(0,0,0,0.3)" stroke={line} strokeWidth="0.7" />
      <circle cx="50" cy="19" r="0.7" fill={line} />

      {/* ── Our goal (bottom) ── */}
      <rect x="22" y="128" width="56" height="23" fill="none" stroke={line} strokeWidth="0.7" />
      <rect x="37" y="143" width="26" height="8"  fill="none" stroke={line} strokeWidth="0.7" />
      <rect x="44.5" y="149.5" width="11" height="4.5"
        fill="rgba(0,0,0,0.3)" stroke={line} strokeWidth="0.7" />
      <circle cx="50" cy="135" r="0.7" fill={line} />

      {/* Corner arcs */}
      <path d="M 3 8 A 5 5 0 0 0 8 3"       fill="none" stroke={line} strokeWidth="0.7" />
      <path d="M 92 3 A 5 5 0 0 0 97 8"     fill="none" stroke={line} strokeWidth="0.7" />
      <path d="M 3 146 A 5 5 0 0 1 8 151"   fill="none" stroke={line} strokeWidth="0.7" />
      <path d="M 92 151 A 5 5 0 0 1 97 146" fill="none" stroke={line} strokeWidth="0.7" />

      {/* Direction labels */}
      <text x="50" y="13" textAnchor="middle"
        fill={theme.fieldLabel} fontSize="4" fontFamily="sans-serif">OPPONENT</text>
      <text x="50" y="149" textAnchor="middle"
        fill={theme.fieldLabel} fontSize="4" fontFamily="sans-serif">OUR GOAL</text>
    </svg>
  )
}

// ── Zone overlays ────────────────────────────────────────────────
const ZONES = [
  { background: theme.fieldZoneGk,  bottom: '0%',  height: '25%' },
  { background: theme.fieldZoneDef, bottom: '25%', height: '25%' },
  { background: theme.fieldZoneMid, bottom: '50%', height: '25%' },
  { background: theme.fieldZoneFwd, bottom: '75%', height: '25%' },
]

function FieldZones() {
  return (
    <>
      {ZONES.map((z, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0,
          bottom: z.bottom, height: z.height,
          background: z.background,
          pointerEvents: 'none', zIndex: 1,
        }} />
      ))}
    </>
  )
}

// ── Main export ──────────────────────────────────────────────────
export default function GameField({
  formation, slotAssignments, players,
  onDragStart, draggingPlayerId, hoverSlotId, isDragging,
  outOfPositionPlayerIds,
}) {
  if (!formation) return null

  console.log('GAMEFIELD slotAssignments:', slotAssignments)
  console.log('GAMEFIELD formation slots:', formation?.slots?.map(s => s.id))

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
  const oop = outOfPositionPlayerIds || new Set()

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', overflow:'hidden' }}>
      <FieldSVG />
      <FieldZones />
      {formation.slots.map(slot => {
        const playerId = slotAssignments[slot.id]
        return (
          <Slot
            key={slot.id}
            slot={slot}
            slotSizePct={formation.slotSizePct}
            player={playerId ? playerMap[playerId] : null}
            zone={getZone(slot.label)}
            onDragStart={onDragStart}
            draggingPlayerId={draggingPlayerId}
            hoverSlotId={hoverSlotId}
            isAnyDragging={isDragging}
            isOutOfPosition={!!playerId && oop.has(playerId)}
          />
        )
      })}
    </div>
  )
}
