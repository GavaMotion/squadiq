import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { playtimeLevel } from '../../lib/playtime'

/**
 * A single row in the bench/sub-queue panel.
 * Draggable onto field slots.
 *
 * Props:
 *   player            Player object
 *   quarterDots       Array of 4 statuses: 'played' | 'planned' | 'none'
 *                     Index 0 = Q1, index 3 = Q4
 *   quartersPlayed    Number of completed quarters this player has played
 *   totalPlanned      Total quarters planned (played + future); amber at 2, red under 2
 *   isFirst           Whether this is the top of the bench queue (most needs playing time)
 *   onToggleAbsent    (playerId) => void
 */
export default function SortablePlayerRow({
  player,
  quarterDots,
  quartersPlayed,
  totalPlanned,
  isFirst,
  onToggleAbsent,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `queue-${player.id}`,
      data: { playerId: player.id, fromSlot: 'bench' },
    })

  const level      = totalPlanned === undefined ? 'ok' : playtimeLevel(totalPlanned)
  const needsMore  = level !== 'ok'
  const riskColor = level === 'short' ? '#ef4444' : '#f59e0b'

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.25 : 1,
    touchAction: 'none',
  }

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/60 last:border-0"
      style={{
        ...style,
        background: needsMore
          ? (level === 'short' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.05)')
          : isFirst ? 'rgba(26,92,46,0.18)' : 'transparent',
        borderLeft: needsMore
          ? `3px solid ${riskColor}`
          : isFirst ? '3px solid var(--team-primary, #1a5c2e)' : '3px solid transparent',
      }}
    >
      {/* Drag grip */}
      <div
        {...listeners}
        {...attributes}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 transition"
        style={{ padding: '4px 2px' }}
        title="Drag to field"
      >
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          <circle cx="4" cy="3"  r="1.5" />
          <circle cx="8" cy="3"  r="1.5" />
          <circle cx="4" cy="8"  r="1.5" />
          <circle cx="8" cy="8"  r="1.5" />
          <circle cx="4" cy="13" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </div>

      {/* Jersey badge */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold"
        style={{ fontSize: 11, background: 'var(--team-primary, #1a5c2e)', color: 'var(--team-primary-text, #fff)' }}
      >
        {player.jersey_number}
      </div>

      {/* Name + quarter dots */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white text-sm font-medium truncate leading-none">
            {player.name}
          </span>
          <span
            className="text-xs ml-2 flex-shrink-0 tabular-nums"
            style={{ color: needsMore ? riskColor : '#6b7280' }}
          >
            {quartersPlayed}/{totalPlanned ?? 4} Q
            {needsMore && <span className="ml-0.5">⚠</span>}
          </span>
        </div>

        {/* 4 quarter dots */}
        <div className="flex gap-1">
          {quarterDots.map((status, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center gap-0.5"
              title={`Q${idx + 1}: ${status === 'played' ? 'Played' : status === 'planned' ? 'Planned' : 'Not assigned'}`}
            >
              <div
                className="rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  background:
                    status === 'played'  ? '#22c55e' :
                    status === 'planned' ? '#f59e0b' :
                    '#374151',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* NEXT badge or absent toggle */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        {isFirst && !needsMore && (
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'var(--team-primary, #1a5c2e)', color: '#86efac', fontSize: 9 }}
          >
            NEXT
          </span>
        )}
        {onToggleAbsent && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onClick={() => onToggleAbsent(player.id)}
            className="w-6 h-6 rounded flex items-center justify-center transition text-gray-600 hover:text-amber-400 hover:bg-amber-900/30"
            title="Mark absent"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="9" cy="7" r="4" />
              <path d="M3 21v-2a4 4 0 0 1 4-4h4" />
              <line x1="17" y1="11" x2="23" y2="17" />
              <line x1="23" y1="11" x2="17" y2="17" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
