import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function StandingsPage({ team }) {
  const [mode, setMode] = useState('url')
  const [url, setUrl] = useState('')
  const [standings, setStandings] = useState(null)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAddGame, setShowAddGame] = useState(false)
  const [newGame, setNewGame] = useState({ opponent: '', goalsFor: '', goalsAgainst: '', date: new Date().toISOString().split('T')[0] })
  const [platform, setPlatform] = useState(null)
  const [divisions, setDivisions] = useState(null)
  const [selectedDivision, setSelectedDivision] = useState(null)

  useEffect(() => {
    if (!team?.id) return
    loadSaved()
  }, [team?.id])

  async function loadSaved() {
    const { data } = await supabase
      .from('standings')
      .select('*')
      .eq('team_id', team.id)
      .maybeSingle()
    if (data) {
      setMode(data.mode === 'manual' ? 'manual' : 'url')
      setStandings(data.table_data || null)
      setGames(data.games || [])
      setPlatform(data.mode)
    }
  }

  async function fetchStandings(overrideUrl = null) {
    const fetchUrl = overrideUrl || url
    console.log('fetchStandings called with:', fetchUrl)
    if (!fetchUrl || typeof fetchUrl !== 'string' || !fetchUrl.trim()) {
      console.log('URL is empty, returning')
      return
    }
    setLoading(true)
    setError(null)
    setDivisions(null)
    try {
      console.log('Invoking scrape-standings with URL:', fetchUrl)
      const { data, error: fnError } = await supabase.functions.invoke('scrape-standings', {
        body: { url: fetchUrl.trim(), teamId: team.id, save: true },
      })
      console.log('Response data:', data)
      console.log('Response error:', fnError)
      if (fnError || data?.error) throw new Error(data?.error || fnError?.message || 'Failed to fetch standings')

      if (data?.needsDivisionPick) {
        console.log('Divisions found:', data.divisions)
        setDivisions(data.divisions)
        return
      }

      setStandings(data.standings)
      setPlatform(data.platform)
      setDivisions(null)
    } catch (err) {
      console.error('fetchStandings error:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function calcRecord(gameList) {
    const r = { GP: 0, W: 0, L: 0, T: 0, GF: 0, GA: 0, GD: 0, Pts: 0 }
    gameList.forEach(g => {
      const gf = parseInt(g.goalsFor) || 0
      const ga = parseInt(g.goalsAgainst) || 0
      r.GP++; r.GF += gf; r.GA += ga
      if (gf > ga) { r.W++; r.Pts += 3 }
      else if (gf < ga) r.L++
      else { r.T++; r.Pts += 1 }
    })
    r.GD = r.GF - r.GA
    return r
  }

  async function addGame() {
    const updated = [...games, { ...newGame, id: Date.now() }]
    setGames(updated)
    setNewGame({ opponent: '', goalsFor: '', goalsAgainst: '', date: new Date().toISOString().split('T')[0] })
    setShowAddGame(false)
    await supabase.from('standings').upsert({
      team_id: team.id,
      mode: 'manual',
      games: updated,
      updated_at: new Date().toISOString(),
    })
  }

  async function deleteGame(id) {
    const updated = games.filter(g => g.id !== id)
    setGames(updated)
    await supabase.from('standings').upsert({
      team_id: team.id,
      mode: 'manual',
      games: updated,
      updated_at: new Date().toISOString(),
    })
  }

  const record = calcRecord(games)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 16px 100px', overflowY: 'auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>🏆 Standings</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'url', label: '🔗 Auto' }, { id: 'manual', label: '✏️ Manual' }].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              padding: '5px 12px', borderRadius: 8, border: 'none',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: mode === m.id ? '#00c853' : 'rgba(255,255,255,0.08)',
              color: mode === m.id ? '#fff' : 'rgba(255,255,255,0.5)',
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {mode === 'url' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.5 }}>
            Works with <span style={{ color: '#00c853' }}>MatchTrak</span> and <span style={{ color: '#00c853' }}>TeamSideline</span>. Paste your league standings URL below.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={url}
              onChange={e => {
                console.log('URL input changed:', e.target.value)
                setUrl(e.target.value)
              }}
              placeholder="https://s11e-26-spring.matchtrak.com/..."
              style={{ flex: 1, background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 12 }}
            />
            <button onClick={() => fetchStandings()} disabled={loading || !url.trim()} style={{
              background: loading ? 'rgba(0,200,83,0.4)' : '#00c853',
              border: 'none', borderRadius: 8, padding: '10px 16px',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}>
              {loading ? '...' : 'Fetch'}
            </button>
          </div>

          {platform && platform !== 'manual' && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              Detected: <span style={{ color: '#00c853' }}>{platform}</span>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#E24B4A', lineHeight: 1.5 }}>
              ⚠ {error}
              <div>
                <button onClick={() => { setMode('manual'); setError(null) }} style={{ background: 'none', border: 'none', color: '#00c853', fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 4 }}>
                  Switch to manual entry →
                </button>
              </div>
            </div>
          )}

          {divisions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Select your division:
              </div>
              {divisions.map(div => (
                <button
                  key={div.id}
                  onClick={() => {
                    setSelectedDivision(div)
                    fetchStandings(div.url)
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{div.label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>→</span>
                </button>
              ))}
            </div>
          )}

          {standings?.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
                {standings.length} teams · tap Fetch to refresh
              </div>
              <StandingsTable data={standings} myTeam={team?.name} />
            </>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {games.length > 0 && (
            <div style={{ background: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.2)', borderRadius: 12, padding: 16 }}>
              <div style={{ color: '#00c853', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{team?.name}</div>
              <div style={{ display: 'flex' }}>
                {['GP','W','L','T','GF','GA','GD','Pts'].map(k => (
                  <div key={k} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 600 }}>{k}</div>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{record[k]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {games.map(game => {
            const gf = parseInt(game.goalsFor) || 0
            const ga = parseInt(game.goalsAgainst) || 0
            const result = gf > ga ? 'W' : gf < ga ? 'L' : 'T'
            const color = result === 'W' ? '#00c853' : result === 'L' ? '#E24B4A' : '#EF9F27'
            return (
              <div key={game.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#000', flexShrink: 0 }}>
                  {result}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>vs {game.opponent}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{game.date} · {gf}–{ga}</div>
                </div>
                <button onClick={() => deleteGame(game.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
            )
          })}

          {!showAddGame && (
            <button onClick={() => setShowAddGame(true)} style={{ background: 'rgba(0,200,83,0.08)', border: '1px dashed rgba(0,200,83,0.3)', borderRadius: 10, padding: 12, color: '#00c853', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Add Game Result
            </button>
          )}

          {showAddGame && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Add Game Result</div>
              <input value={newGame.opponent} onChange={e => setNewGame(p => ({ ...p, opponent: e.target.value }))}
                placeholder="Opponent name"
                style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newGame.goalsFor} onChange={e => setNewGame(p => ({ ...p, goalsFor: e.target.value }))}
                  placeholder="Our goals" type="number" min="0"
                  style={{ flex: 1, background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13 }} />
                <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>–</div>
                <input value={newGame.goalsAgainst} onChange={e => setNewGame(p => ({ ...p, goalsAgainst: e.target.value }))}
                  placeholder="Their goals" type="number" min="0"
                  style={{ flex: 1, background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13 }} />
              </div>
              <input value={newGame.date} onChange={e => setNewGame(p => ({ ...p, date: e.target.value }))}
                type="date"
                style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAddGame(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 10, color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={addGame} disabled={!newGame.opponent || !newGame.goalsFor || !newGame.goalsAgainst}
                  style={{ flex: 2, background: '#00c853', border: 'none', borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Save Game
                </button>
              </div>
            </div>
          )}

          {games.length === 0 && !showAddGame && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '40px 0' }}>
              No games yet. Add your first game result!
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StandingsTable({ data, myTeam }) {
  if (!data?.length) return null
  return (
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
          {data.map((row, i) => {
            const isMe = myTeam && row.team?.toLowerCase().includes(myTeam.toLowerCase().split(' ')[0])
            return (
              <tr key={i} style={{ background: isMe ? 'rgba(0,200,83,0.08)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '7px 4px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ padding: '7px 4px', color: isMe ? '#00c853' : '#fff', fontWeight: isMe ? 700 : 400, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.team}</td>
                {['gp','w','l','t','gf','ga','gd','pts'].map(k => (
                  <td key={k} style={{ padding: '7px 4px', color: k === 'pts' ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: k === 'pts' ? 700 : 400, textAlign: 'center' }}>{row[k] ?? '–'}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
