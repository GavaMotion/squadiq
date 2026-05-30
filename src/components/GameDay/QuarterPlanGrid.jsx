/**
 * Quarter planning grid — rows = players, columns = Q1–Q4.
 *
 * • Green cell  = player is assigned to that quarter (quarterRoster)
 * • Gray cell   = not assigned
 * • Locked col  = completed quarter (read-only, historical)
 * • Amber row   = total quarters planned < 3 (AYSO ¾ rule at risk)
 * • Absent row  = player marked absent (excluded from planning, shown below)
 *
 * Props:
 *   players           Player[]
 *   quarterRoster     { 1: pid[], 2: pid[], 3: pid[], 4: pid[] }
 *   completedQuarters number[]
 *   currentQuarter    number
 *   gameStarted       bool
 *   absentIds         Set<string>
 *   onToggle          (playerId, quarter) => void
 *   onToggleAbsent    (playerId) => void
 */
export default function QuarterPlanGrid({
  players,
  quarterRoster,
  completedQuarters,
  currentQuarter,
  gameStarted,
  absentIds,
  onToggle,
  onToggleAbsent,
}) {
  const activePlayers = players.filter(p => !absentIds.has(p.id))
  const absentPlayers = players.filter(p => absentIds.has(p.id))

  if (!players.length) {
    return (
      <div className="flex items-center justify-center flex-1 px-4">
        <p className="text-gray-500 text-sm">No players on roster yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Legend */}
      <div
        className="flex items-center gap-3 px-4 py-1.5 border-b border-gray-800 flex-wrap"
        style={{ flexShrink: 0, background: '#111827' }}
      >
        <span className="text-gray-600 text-xs">¾ rule = 3+ quarters</span>
        <div className="flex items-center gap-3 ml-auto">
          {[
            ['#22c55e', 'ON'],
            ['#374151', 'OFF'],
          ].map(([bg, label]) => (
            <span key={label} className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block w-3 h-3 rounded" style={{ background: bg }} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1 text-xs text-amber-500">
            <span className="inline-block w-3 h-3 rounded" style={{ background: '#f59e0b' }} />
            &lt;3 planned
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div
        className="grid border-b border-gray-800 sticky top-0 z-10 flex-shrink-0"
        style={{ gridTemplateColumns: '1fr 44px 44px 44px 44px 36px 32px', background: '#111827' }}
      >
        <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          Player
        </div>
        {[1,2,3,4].map(q => {
          const done   = completedQuarters.includes(q)
          const isCurr = q === currentQuarter && gameStarted && !done
          return (
            <div
              key={q}
              className="flex items-center justify-center py-2 text-xs font-bold"
              style={{ color: done ? '#86efac' : isCurr ? '#4ade80' : '#6b7280' }}
            >
              Q{q}{done ? '✓' : isCurr ? '●' : ''}
            </div>
          )
        })}
        <div className="flex items-center justify-center py-2 text-xs font-bold text-gray-500">Qtrs</div>
        <div className="py-2" />
      </div>

      {/* Scrollable rows */}
      <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>

        {/* Active players */}
        {activePlayers.map(player => {
          const pid          = player.id
          const played       = completedQuarters.filter(q => (quarterRoster[q]||[]).includes(pid)).length
          const totalPlanned = [1,2,3,4].filter(q => (quarterRoster[q]||[]).includes(pid)).length
          const needsMore    = totalPlanned < 3

          return (
            <div
              key={pid}
              className="grid border-b border-gray-800/60 last:border-0 hover:bg-gray-900/30 transition"
              style={{
                gridTemplateColumns: '1fr 44px 44px 44px 44px 36px 32px',
                background:  needsMore ? 'rgba(245,158,11,0.05)' : 'transparent',
                borderLeft:  needsMore ? '2px solid #f59e0b' : '2px solid transparent',
              }}
            >
              {/* Player name */}
              <div className="flex items-center gap-2 px-3 py-2.5 min-w-0">
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ fontSize: 10, background: 'var(--team-primary, #1a5c2e)' }}
                >
                  {player.jersey_number}
                </div>
                <span className="text-white text-sm truncate">{player.name}</span>
                {needsMore && (
                  <span className="flex-shrink-0 text-amber-400 ml-0.5" title="Fewer than 3 quarters planned" style={{ fontSize: 10 }}>⚠</span>
                )}
              </div>

              {/* Quarter cells */}
              {[1,2,3,4].map(q => {
                const isOn     = (quarterRoster[q]||[]).includes(pid)
                const locked   = completedQuarters.includes(q)
                const isActive = q === currentQuarter && gameStarted && !locked

                return (
                  <div key={q} className="flex items-center justify-center py-2">
                    <button
                      onClick={() => !locked && onToggle(pid, q)}
                      disabled={locked}
                      aria-label={locked
                        ? isOn ? `${player.name} played Q${q}` : `${player.name} did not play Q${q}`
                        : isOn ? `Remove ${player.name} from Q${q}` : `Add ${player.name} to Q${q}`}
                      aria-pressed={isOn}
                      className="w-7 h-7 rounded-md flex items-center justify-center transition-all"
                      style={{
                        background: isOn
                          ? locked ? '#14532d' : isActive ? '#16a34a' : 'var(--team-primary, #1a5c2e)'
                          : locked ? '#1a1f2e' : '#374151',
                        cursor: locked ? 'default' : 'pointer',
                        opacity: locked && !isOn ? 0.45 : 1,
                        border: isActive ? `2px solid ${isOn ? '#4ade80' : '#4b5563'}` : '2px solid transparent',
                      }}
                      title={locked
                        ? isOn ? `Played Q${q}` : `Did not play Q${q}`
                        : isOn ? `Remove from Q${q}` : `Add to Q${q}`}
                    >
                      {isOn ? (
                        locked ? (
                          /* Historical checkmark */
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#4ade80' }} />
                        )
                      ) : (
                        !locked && <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#6b7280' }} />
                      )}
                    </button>
                  </div>
                )
              })}

              {/* Quarters count */}
              <div className="flex items-center justify-center py-2">
                <span
                  className="text-xs font-bold tabular-nums"
                  style={{ color: needsMore ? '#f59e0b' : played >= 3 ? '#22c55e' : '#9ca3af' }}
                >
                  {played}/{totalPlanned}
                </span>
              </div>

              {/* Absent toggle */}
              <div className="flex items-center justify-center py-2 pr-2">
                <button
                  onClick={() => onToggleAbsent(pid)}
                  className="w-6 h-6 rounded flex items-center justify-center transition text-gray-600 hover:text-amber-400 hover:bg-amber-900/30"
                  aria-label={`Mark ${player.name} as absent`}
                  title="Mark absent"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="9" cy="7" r="4" />
                    <path d="M3 21v-2a4 4 0 0 1 4-4h4" />
                    <line x1="17" y1="11" x2="23" y2="17" />
                    <line x1="23" y1="11" x2="17" y2="17" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}

        {/* Absent players section */}
        {absentPlayers.length > 0 && (
          <>
            <div
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest border-t border-gray-800"
              style={{ color: '#6b7280', background: '#0d1117' }}
            >
              Absent ({absentPlayers.length})
            </div>
            {absentPlayers.map(player => (
              <div
                key={player.id}
                className="grid border-b border-gray-800/40 last:border-0"
                style={{ gridTemplateColumns: '1fr 44px 44px 44px 44px 36px 32px', opacity: 0.45 }}
              >
                <div className="flex items-center gap-2 px-3 py-2 min-w-0">
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ fontSize: 10, background: '#374151' }}
                  >
                    {player.jersey_number}
                  </div>
                  <span className="text-gray-500 text-sm truncate line-through">{player.name}</span>
                  <span className="text-gray-600 text-xs flex-shrink-0">absent</span>
                </div>
                {/* Empty quarter cells */}
                {[1,2,3,4].map(q => (
                  <div key={q} className="flex items-center justify-center py-2">
                    <div className="w-7 h-7 rounded-md" style={{ background: '#1a1f2e' }} />
                  </div>
                ))}
                <div className="py-2" />
                {/* Mark present button */}
                <div className="flex items-center justify-center py-2 pr-2" style={{ opacity: 1 }}>
                  <button
                    onClick={() => onToggleAbsent(player.id)}
                    className="w-6 h-6 rounded flex items-center justify-center transition text-green-700 hover:text-green-400 hover:bg-green-900/30"
                    aria-label={`Mark ${player.name} as present`}
                    title="Mark present"
                    style={{ opacity: 1 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
