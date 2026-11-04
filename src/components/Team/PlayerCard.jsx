import theme from '../../theme'
import { positionName } from '../../lib/positions'

// Colors for all current and legacy position values
const POSITION_STYLES = {
  // Current positions
  GK:    { bg: 'rgba(245,158,11,0.18)',  color: '#fcd34d', border: 'rgba(245,158,11,0.4)' },
  CB:    { bg: 'rgba(59,130,246,0.18)',  color: '#93c5fd', border: 'rgba(59,130,246,0.4)' },
  'RB/LB':{ bg: 'rgba(96,165,250,0.15)', color: '#bfdbfe', border: 'rgba(96,165,250,0.35)' },
  CDM:   { bg: 'rgba(99,102,241,0.18)',  color: '#a5b4fc', border: 'rgba(99,102,241,0.4)' },
  CM:    { bg: 'rgba(168,85,247,0.18)',  color: '#d8b4fe', border: 'rgba(168,85,247,0.4)' },
  CAM:   { bg: 'rgba(192,132,252,0.15)', color: '#e9d5ff', border: 'rgba(192,132,252,0.35)' },
  'RM/LM':{ bg: 'rgba(217,70,239,0.15)', color: '#f5d0fe', border: 'rgba(217,70,239,0.35)' },
  'RW/LW':{ bg: 'rgba(249,115,22,0.18)', color: '#fdba74', border: 'rgba(249,115,22,0.4)' },
  ST:    { bg: 'rgba(239,68,68,0.18)',   color: '#fca5a5', border: 'rgba(239,68,68,0.4)' },
  // Legacy positions (backward compat for existing Supabase data)
  DEF:   { bg: 'rgba(59,130,246,0.18)',  color: '#93c5fd', border: 'rgba(59,130,246,0.4)' },
  MID:   { bg: 'rgba(168,85,247,0.18)',  color: '#d8b4fe', border: 'rgba(168,85,247,0.4)' },
  FWD:   { bg: 'rgba(239,68,68,0.18)',   color: '#fca5a5', border: 'rgba(239,68,68,0.4)' },
}

const FALLBACK = { bg: 'rgba(107,114,128,0.18)', color: '#d1d5db', border: 'rgba(107,114,128,0.4)' }

export default function PlayerCard({ player, onEdit }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(player)}
      className="w-full text-left flex items-center gap-3 rounded-xl px-4 py-3 transition group hover:bg-white/5"
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-purple)',
        cursor: 'pointer',
      }}
    >
      {/* Jersey number badge */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
        style={{ backgroundColor: 'var(--team-primary, #1a5c2e)', color: 'var(--team-primary-text, #fff)' }}
      >
        {player.jersey_number}
      </div>

      {/* Name + positions */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{player.name}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {(player.positions || []).map(pos => {
            const s = POSITION_STYLES[pos] || FALLBACK
            return (
              <span
                key={pos}
                title={pos}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: s.bg,
                  color: s.color,
                  border: `1px solid ${s.border}`,
                }}
              >
                {positionName(pos)}
              </span>
            )
          })}
        </div>
      </div>

      {/* Edit pencil — visual affordance; whole card is clickable */}
      <span
        aria-hidden="true"
        className="p-1.5 rounded-lg text-gray-400 group-hover:text-white transition flex-shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </span>
    </button>
  )
}
