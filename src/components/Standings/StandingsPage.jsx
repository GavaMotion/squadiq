import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function StandingsPage({ team }) {
  const [standingsList, setStandingsList] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(new Set())
  const [myTeamRow, setMyTeamRow] = useState({})
  const inputRef = useRef(null)

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

      const savedMyTeam = {}
      data.forEach(s => {
        if (s.my_team_name) savedMyTeam[s.id] = s.my_team_name
      })
      setMyTeamRow(savedMyTeam)

      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
      data.forEach(s => {
        if (s.source_url && new Date(s.updated_at) < sixHoursAgo) {
          refreshStanding(s)
        }
      })
    }
  }

  async function toggleMyTeam(standing, teamName) {
    const current = myTeamRow[standing.id]
    const newValue = current === teamName ? null : teamName
    setMyTeamRow(prev => ({ ...prev, [standing.id]: newValue }))
    await supabase
      .from('standings')
      .update({ my_team_name: newValue })
      .eq('id', standing.id)
  }

  async function fetchAndAdd() {
    if (!url.trim() || loading) return
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
          label: guessLabel(url.trim()),
          table_data: data.standings,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (saveError) throw saveError
      setStandingsList(prev => [...prev, saved])
      setActiveId(saved.id)
      setUrl('')
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
      const { data } = await supabase.functions.invoke('scrape-standings', {
        body: { url: standing.source_url, teamId: team.id, save: false },
      })
      if (!data?.standings?.length) return
      const { data: updated } = await supabase
        .from('standings')
        .update({ table_data: data.standings, updated_at: new Date().toISOString() })
        .eq('id', standing.id)
        .select()
        .single()
      if (updated) setStandingsList(prev => prev.map(s => s.id === standing.id ? updated : s))
    } catch (_) {}
    finally {
      setRefreshing(prev => { const n = new Set(prev); n.delete(standing.id); return n })
    }
  }

  async function deleteActive() {
    if (!activeId || !confirm('Remove this standings tab?')) return
    await supabase.from('standings').delete().eq('id', activeId)
    const remaining = standingsList.filter(s => s.id !== activeId)
    setStandingsList(remaining)
    setActiveId(remaining[0]?.id || null)
  }

  function guessLabel(url) {
    if (url.includes('RestrictToCategory=')) {
      const cat = url.split('RestrictToCategory=')[1].split('&')[0]
      const parts = cat.split('-')
      const divPart = parts[parts.length - 1]
      const gender = divPart.startsWith('b') ? 'Boys' : divPart.startsWith('g') ? 'Girls' : ''
      const age = divPart.replace(/[a-z]/g, '')
      return gender && age ? `${gender} U${age}` : divPart.toUpperCase()
    }
    if (url.includes('teamsideline')) return 'Division'
    return 'Standings'
  }

  const active = standingsList.find(s => s.id === activeId)
  const hoursAgo = active ? Math.floor((Date.now() - new Date(active.updated_at)) / 3600000) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 16px 100px', overflowY: 'auto' }}>

      <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>🏆 Standings</div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          value={url}
          onChange={e => { setUrl(e.target.value); setError(null) }}
          onKeyDown={e => e.key === 'Enter' && fetchAndAdd()}
          placeholder="Paste MatchTrak or TeamSideline URL..."
          style={{
            flex: 1,
            background: '#0d0d1a',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '10px 14px',
            color: '#fff',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={fetchAndAdd}
          disabled={loading || !url.trim()}
          style={{
            background: loading ? 'rgba(0,200,83,0.4)' : '#00c853',
            border: 'none', borderRadius: 10,
            padding: '10px 16px',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            flexShrink: 0,
          }}
        >
          {loading ? '...' : 'Add'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#E24B4A', fontSize: 12, padding: '6px 10px', background: 'rgba(220,50,50,0.08)', borderRadius: 8 }}>
          ⚠ {error}
        </div>
      )}

      {standingsList.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {standingsList.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
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
        </div>
      )}

      {active?.table_data?.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 10, color: hoursAgo >= 6 ? '#EF9F27' : 'rgba(255,255,255,0.25)' }}>
              {hoursAgo >= 6 ? '⚠ ' : ''}Updated {hoursAgo === 0 ? 'just now' : `${hoursAgo}h ago`}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => refreshStanding(active)}
                disabled={refreshing.has(active.id)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}
              >
                {refreshing.has(active.id) ? '⏳' : '🔄'} Refresh
              </button>
              <button
                onClick={deleteActive}
                style={{ background: 'none', border: 'none', color: 'rgba(220,50,50,0.5)', fontSize: 13, cursor: 'pointer' }}
              >
                🗑 Delete
              </button>
            </div>
          </div>

          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 320 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.06)' }}>
                  {['#','Team','GP','W','L','T','GF','GA','GD','Pts'].map(h => (
                    <th key={h} style={{ padding: '8px 4px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textAlign: h === 'Team' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.table_data.map((row, i) => {
                  const isMe = myTeamRow[active.id] === row.team
                  return (
                    <tr
                      key={i}
                      onClick={() => toggleMyTeam(active, row.team)}
                      style={{
                        background: isMe ? 'rgba(0,200,83,0.08)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '7px 4px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '7px 4px', color: isMe ? '#00c853' : '#fff', fontWeight: isMe ? 700 : 400, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isMe && <span style={{ marginRight: 4 }}>⚽</span>}
                        {row.team}
                      </td>
                      {['gp','w','l','t','gf','ga','gd','pts'].map(k => (
                        <td key={k} style={{ padding: '7px 4px', color: k === 'pts' ? (isMe ? '#00c853' : '#fff') : 'rgba(255,255,255,0.6)', fontWeight: k === 'pts' ? 700 : 400, textAlign: 'center' }}>
                          {row[k] ?? '–'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '6px 0' }}>
            Tap a row to highlight your team
          </div>
        </>
      )}

      {standingsList.length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13, padding: '50px 0', lineHeight: 2, whiteSpace: 'pre-line' }}>
          Paste a MatchTrak or TeamSideline{'\n'}standings URL above to get started.
        </div>
      )}
    </div>
  )
}
