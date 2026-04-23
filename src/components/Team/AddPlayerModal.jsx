import { useState } from 'react'

export const POSITIONS = [
  { id: 'GK',    label: 'GK',    desc: 'Goalkeeper' },
  { id: 'CB',    label: 'CB',    desc: 'Centre Back' },
  { id: 'RB/LB', label: 'RB/LB', desc: 'Right/Left Back' },
  { id: 'CDM',   label: 'CDM',   desc: 'Def. Mid' },
  { id: 'CM',    label: 'CM',    desc: 'Centre Mid' },
  { id: 'CAM',   label: 'CAM',   desc: 'Att. Mid' },
  { id: 'RM/LM', label: 'RM/LM', desc: 'Right/Left Mid' },
  { id: 'RW/LW', label: 'RW/LW', desc: 'Right/Left Wing' },
  { id: 'ST',    label: 'ST',    desc: 'Striker' },
]

export default function AddPlayerModal({ onSave, onClose, initial }) {
  const [name,      setName]      = useState(initial?.name || '')
  const [jersey,    setJersey]    = useState(initial?.jersey_number ?? '')
  const [positions, setPositions] = useState(initial?.positions || [])
  const [positionRatings, setPositionRatings] = useState(initial?.position_ratings || {})
  const [error,     setError]     = useState('')

  function handlePositionToggle(id) {
    setPositions(prev => {
      if (prev.includes(id)) {
        // Remove rating when position is deselected
        setPositionRatings(r => { const nr = { ...r }; delete nr[id]; return nr })
        return prev.filter(p => p !== id)
      }
      return [...prev, id]
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim())                          return setError('Player name is required.')
    if (jersey === '' || isNaN(Number(jersey))) return setError('Valid jersey number required.')
    if (positions.length === 0)                return setError('Select at least one position.')
    setError('')
    onSave({ name: name.trim(), jersey_number: Number(jersey), positions, position_ratings: positionRatings })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-0 sm:px-4">
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 overflow-y-auto"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-purple)', maxHeight: '92dvh' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">
            {initial ? 'Edit Player' : 'Add Player'}
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white transition text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Player Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex Johnson"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none transition"
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--team-primary, #1a5c2e)'}
              onBlur={e => e.target.style.boxShadow = ''}
              autoFocus
            />
          </div>

          {/* Jersey */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Jersey Number</label>
            <input
              type="number"
              value={jersey}
              onChange={e => setJersey(e.target.value)}
              placeholder="e.g. 7"
              min={0}
              max={99}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none transition"
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--team-primary, #1a5c2e)'}
              onBlur={e => e.target.style.boxShadow = ''}
            />
          </div>

          {/* Positions — 3-column toggle grid */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Preferred Position(s)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {POSITIONS.map(pos => {
                const active = positions.includes(pos.id)
                return (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => handlePositionToggle(pos.id)}
                    style={{
                      padding: '6px 4px',
                      borderRadius: 8,
                      border: `1px solid ${active ? 'var(--team-primary, #1a5c2e)' : '#374151'}`,
                      background: active ? 'var(--team-primary, #1a5c2e)' : 'var(--bg-secondary)',
                      color: active ? '#fff' : '#9ca3af',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      transition: 'all 0.1s',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{pos.label}</span>
                    <span style={{ fontSize: 9, opacity: 0.75, lineHeight: 1.2 }}>{pos.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Position Ratings — star rating per selected position */}
          {positions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Position Ratings
              </div>
              {positions.map(pos => (
                <div key={pos} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '8px 12px',
                }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, minWidth: 44 }}>{pos}</span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <span
                        key={star}
                        onClick={() => setPositionRatings(prev => ({
                          ...prev,
                          [pos]: prev[pos] === star ? 0 : star,
                        }))}
                        style={{
                          fontSize: 22, cursor: 'pointer', lineHeight: 1,
                          color: star <= (positionRatings[pos] || 0) ? '#FFD700' : 'rgba(255,255,255,0.2)',
                          transition: 'color 0.12s',
                        }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg font-semibold text-white transition"
              style={{ backgroundColor: 'var(--team-primary, #1a5c2e)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#236b38')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--team-primary, #1a5c2e)')}
            >
              {initial ? 'Save Changes' : 'Add Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
