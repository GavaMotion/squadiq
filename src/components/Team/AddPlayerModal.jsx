import { useState } from 'react'

export const POSITIONS = [
  { id: 'GK',    label: 'GK',    desc: 'Goalkeeper' },
  { id: 'CB',    label: 'CB',    desc: 'Center back' },
  { id: 'RB/LB', label: 'RB/LB', desc: 'Right/left back' },
  { id: 'CDM',   label: 'CDM',   desc: 'Defensive mid' },
  { id: 'CM',    label: 'CM',    desc: 'Center mid' },
  { id: 'CAM',   label: 'CAM',   desc: 'Attacking mid' },
  { id: 'RM/LM', label: 'RM/LM', desc: 'Right/left mid' },
  { id: 'RW/LW', label: 'RW/LW', desc: 'Right/left wing' },
  { id: 'ST',    label: 'ST',    desc: 'Striker' },
]

export default function AddPlayerModal({ onSave, onClose, onDelete, initial }) {
  const [name,      setName]      = useState(initial?.name || '')
  const [jersey,    setJersey]    = useState(initial?.jersey_number ?? '')
  const [positions, setPositions] = useState(initial?.positions || [])
  const [positionRatings, setPositionRatings] = useState(initial?.position_ratings || {})
  const [error,     setError]     = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting,         setDeleting]         = useState(false)

  async function handleConfirmDelete() {
    if (!initial || !onDelete) return
    try {
      setDeleting(true)
      await onDelete(initial.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not delete player')
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

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
                    <span style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.2 }}>{pos.desc}</span>
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
              {positions
              .filter(pos => !['DEF', 'MID', 'FWD'].includes(pos))
              .map(pos => (
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

          {/* Delete — only when editing, separated from primary actions to prevent accidental taps */}
          {initial && onDelete && (
            <div style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'center',
            }}>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(248,113,113,0.85)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove player from roster
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Confirm-delete dialog (sits on top of the edit modal) */}
      {confirmingDelete && initial && (
        <div
          onClick={() => !deleting && setConfirmingDelete(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid rgba(248,113,113,0.35)',
              borderRadius: 14,
              padding: '20px 22px',
              maxWidth: 360,
              width: '100%',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{
              fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6,
            }}>
              Remove {initial.name}?
            </div>
            <div style={{
              fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45,
              marginBottom: 16,
            }}>
              This removes the player from your roster and any future
              lineups. This can&apos;t be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmingDelete(false)}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#d1d5db',
                  fontSize: 13, fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8,
                  background: '#dc2626',
                  border: '1px solid #b91c1c',
                  color: '#fff',
                  fontSize: 13, fontWeight: 700,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? 'Removing…' : 'Remove player'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
