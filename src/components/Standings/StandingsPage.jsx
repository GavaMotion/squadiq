import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function StandingsPage({ team }) {
  const [standingsList, setStandingsList] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(new Set())

  useEffect(() => {
    if (!team?.id) return
    loadStandings()
  }, [team?.id])

  async function loadStandings() {
    const { data } = await supabase
      .from('standings')
      .select('*')
      .eq('team_id', team.id)
      .order('updated_at', { ascending: true })
    if (data && data.length > 0) {
      setStandingsList(data)
      setActiveId(data[0].id)

      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
      for (const standing of data) {
        if (standing.source_url && new Date(standing.updated_at) < sixHoursAgo) {
          refreshStanding(standing)
        }
      }
    }
  }

  async function fetchAndAdd() {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('scrape-standings', {
        body: { url: url.trim(), teamId: team.id, save: false },
      })
      if (fnError || data?.error) throw new Error(data?.error || fnError?.message)
      if (!data?.standings?.length) throw new Error('No standings found at this URL')

      const { data: saved, error: saveError } = await supabase
        .from('standings')
        .insert({
          team_id: team.id,
          mode: data.platform || 'url',
          source_url: url.trim(),
          label: label.trim() || guessLabel(url),
          table_data: data.standings,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (saveError) throw saveError

      setStandingsList(prev => [...prev, saved])
      setActiveId(saved.id)
      setUrl('')
      setLabel('')
      setShowAddForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function refreshStanding(standing) {
    if (!standing?.source_url) return
    setRefreshing(prev => new Set([...prev, standing.id]))
    try {
      const { data, error: fnError } = await supabase.functions.invoke('scrape-standings', {
        body: { url: standing.source_url, teamId: team.id, save: false },
      })
      if (fnError || data?.error) return
      if (!data?.standings?.length) return

      const { data: updated } = await supabase
        .from('standings')
        .update({ table_data: data.standings, updated_at: new Date().toISOString() })
        .eq('id', standing.id)
        .select()
        .single()

      if (updated) {
        setStandingsList(prev => prev.map(s => s.id === standing.id ? updated : s))
      }
    } catch (_) {
      // silent fail
    } finally {
      setRefreshing(prev => {
        const next = new Set(prev)
        next.delete(standing.id)
        return next
      })
    }
  }

  async function deleteActive() {
    if (!activeId) return
    if (!confirm('Delete this standings tab?')) return
    await supabase.from('standings').delete().eq('id', activeId)
    const remaining = standingsList.filter(s => s.id !== activeId)
    setStandingsList(remaining)
    setActiveId(remaining.length > 0 ? remaining[0].id : null)
  }

  function guessLabel(url) {
    if (url.includes('RestrictToCategory=')) {
      const cat = url.split('RestrictToCategory=')[1].split('&')[0]
      const parts = cat.split('-')
      const divPart = parts[parts.length - 1]
      const gender = divPart.startsWith('b') ? 'Boys' : divPart.startsWith('g') ? 'Girls' : ''
      const age = divPart.replace(/[a-z]/g, '')
      return gender && age ? `${gender} U${age}` : cat
    }
    if (url.includes('teamsideline')) return 'Division'
    return 'Standings'
  }

  const activeStanding = standingsList.find(s => s.id === activeId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 16px 100px', overflowY: 'auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>🏆 Standings</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeStanding?.source_url && (
            <button
              onClick={() => refreshStanding(activeStanding)}
              disabled={refreshing.has(activeStanding?.id)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '6px 12px',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
              title="Refresh standings"
            >
              <span style={{
                display: 'inline-block',
                animation: refreshing.has(activeStanding?.id) ? 'spin 1s linear infinite' : 'none',
              }}>🔄</span>
              {refreshing.has(activeStanding?.id) ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
          {activeStanding && (
            <button onClick={deleteActive} style={{
              background: 'rgba(220,50,50,0.08)', border: '1px solid rgba(220,50,50,0.2)',
              borderRadius: 8, padding: '6px 10px', color: '#E24B4A',
              fontSize: 13, cursor: 'pointer',
            }}>
              Delete
            </button>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto',
        paddingBottom: 4, marginBottom: 14,
        scrollbarWidth: 'none',
      }}>
        {standingsList.map(s => (
          <button
            key={s.id}
            onClick={() => { setShowAddForm(false); setActiveId(s.id) }}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${activeId === s.id ? 'rgba(245,200,66,0.6)' : 'rgba(255,255,255,0.1)'}`,
              background: activeId === s.id ? 'rgba(245,200,66,0.15)' : 'rgba(255,255,255,0.04)',
              color: activeId === s.id ? '#F5C842' : 'rgba(255,255,255,0.5)',
              fontSize: 12, fontWeight: activeId === s.id ? 700 : 400,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {s.label || 'Division'}
          </button>
        ))}

        <button
          onClick={() => { setShowAddForm(true); setActiveId(null); setError(null) }}
          style={{
            flexShrink: 0,
            padding: '6px 14px',
            borderRadius: 20,
            border: '1px dashed rgba(0,200,83,0.4)',
            background: showAddForm ? 'rgba(0,200,83,0.1)' : 'transparent',
            color: '#00c853',
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          + Add Division
        </button>
      </div>

      {showAddForm && (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
          marginBottom: 14,
        }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Add Division Standings</div>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Label (e.g. Boys U14) — optional"
            style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13 }}
          />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Paste MatchTrak or TeamSideline URL"
            style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13 }}
          />
          {error && (
            <div style={{ color: '#E24B4A', fontSize: 12 }}>⚠ {error}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowAddForm(false); setUrl(''); setLabel(''); setError(null) }}
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 10, color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={fetchAndAdd} disabled={loading || !url.trim()}
              style={{ flex: 2, background: loading ? 'rgba(0,200,83,0.4)' : '#00c853', border: 'none', borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? 'Fetching...' : 'Fetch & Save'}
            </button>
          </div>
        </div>
      )}

      {standingsList.length === 0 && !showAddForm && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '60px 0', lineHeight: 2, whiteSpace: 'pre-line' }}>
          No standings yet.{'\n'}Tap + Add Division to get started.
        </div>
      )}

      {activeStanding?.table_data?.length > 0 && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 340 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.06)' }}>
                {['#','Team','GP','W','L','T','GF','GA','GD','Pts'].map(h => (
                  <th key={h} style={{ padding: '8px 4px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textAlign: h === 'Team' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeStanding.table_data.map((row, i) => {
                const isMe = team?.name && row.team?.toLowerCase().includes(team.name.toLowerCase().split(' ')[0])
                return (
                  <tr key={i} style={{ background: isMe ? 'rgba(0,200,83,0.08)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '7px 4px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '7px 4px', color: isMe ? '#00c853' : '#fff', fontWeight: isMe ? 700 : 400, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.team}</td>
                    {['gp','w','l','t','gf','ga','gd','pts'].map(k => (
                      <td key={k} style={{ padding: '7px 4px', color: k === 'pts' ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: k === 'pts' ? 700 : 400, textAlign: 'center' }}>{row[k] ?? '–'}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 10, textAlign: 'right', padding: '6px 12px' }}>
            {(() => {
              const updated = new Date(activeStanding.updated_at)
              const hoursAgo = Math.floor((Date.now() - updated) / (1000 * 60 * 60))
              const isStale = hoursAgo >= 6
              return (
                <span style={{ color: isStale ? '#EF9F27' : 'rgba(255,255,255,0.2)' }}>
                  {isStale ? '⚠ ' : ''}
                  Updated {hoursAgo === 0 ? 'just now' : `${hoursAgo}h ago`}
                </span>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
