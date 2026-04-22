import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp, applyTeamCSSVars } from '../../contexts/AppContext'
import theme from '../../theme'
import PlayerCard from './PlayerCard'
import AddPlayerModal from './AddPlayerModal'
import BrandingFields from './BrandingFields'
import PrivacyPolicy from '../Legal/PrivacyPolicy'
import TermsOfService from '../Legal/TermsOfService'
import { MyTeamSkeleton } from '../UI/Skeleton'

const DIVISIONS = ['8U', '10U', '12U', '14U', '16U', '19U']

// ── Delete confirmation dialog ────────────────────────────────────
function DeleteTeamDialog({ teamName, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        style={{ background: 'var(--bg-panel)', border: '1px solid rgba(153,27,27,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-base mb-2">Delete team?</h3>
        <p className="text-gray-400 text-sm mb-5">
          This will permanently delete <strong className="text-white">{teamName}</strong> and all its players,
          game plans, and practice plans. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl font-semibold text-white transition"
            style={{ background: '#991b1b' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#b91c1c')}
            onMouseLeave={e => (e.currentTarget.style.background = '#991b1b')}
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function MyTeamPage({ onSignOut, onCreateTeam, onShowOnboarding }) {
  const {
    teams,     setTeams,
    team,      setTeam,
    players,   setPlayers,
    setPlayerCount,
    dataLoaded,
    userId,
    deleteTeam: ctxDeleteTeam,
  } = useApp()

  // Team edit state
  const [teamName,    setTeamName]    = useState('')
  const [division,    setDivision]    = useState('10U')
  const [branding,    setBranding]    = useState({
    colorPrimary: null, colorSecondary: null, colorAccent: null,
  })
  const [savingTeam,   setSavingTeam]   = useState(false)
  const [editingTeam,  setEditingTeam]  = useState(false)
  const [showDelete,   setShowDelete]   = useState(false)
  const [deletingTeam, setDeletingTeam] = useState(false)

  // Player modal
  const [showModal,     setShowModal]     = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)

  const [error, setError] = useState('')
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms,   setShowTerms]   = useState(false)

  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteError,       setDeleteError]       = useState('')
  const [isDeleting,        setIsDeleting]        = useState(false)

  // ── Derived values (before any early return) ──────────────────
  const teamColors = [team?.color_primary, team?.color_secondary, team?.color_accent].filter(Boolean)

  // Sync edit form when team changes
  function openEditTeam() {
    setTeamName(team?.name || '')
    setDivision(team?.division || '10U')
    setBranding({
      colorPrimary:   team?.color_primary   || null,
      colorSecondary: team?.color_secondary || null,
      colorAccent:    team?.color_accent    || null,
    })
    setEditingTeam(true)
  }

  const noTeam = dataLoaded && !team

  if (!dataLoaded) return <MyTeamSkeleton />

  if (dataLoaded && !team) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', padding: 32,
        textAlign: 'center', gap: 20,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(0,200,83,0.15)', border: '2px solid rgba(0,200,83,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
        }}>
          ⚽
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            No teams yet
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>
            Create a team to get started. Add your players, set your formation and start planning.
          </div>
        </div>
        <button
          onClick={onCreateTeam}
          style={{
            background: '#00c853', color: '#fff', border: 'none', borderRadius: 12,
            padding: '14px 32px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            width: '100%', maxWidth: 280,
          }}
        >
          + Create my first team
        </button>
      </div>
    )
  }

  // ── Handlers ─────────────────────────────────────────────────

  async function handleSaveTeam(e) {
    e.preventDefault()
    if (!teamName.trim()) return
    setSavingTeam(true)
    setError('')
    try {
      const { error: saveError } = await supabase
        .from('teams')
        .update({
          name:            teamName.trim(),
          division,
          color_primary:   branding.colorPrimary   || null,
          color_secondary: branding.colorSecondary || null,
          color_accent:    branding.colorAccent    || null,
        })
        .eq('id', team.id)

      if (saveError) throw saveError

      const freshTeam = {
        ...team,
        name:            teamName.trim(),
        division,
        color_primary:   branding.colorPrimary   || null,
        color_secondary: branding.colorSecondary || null,
        color_accent:    branding.colorAccent    || null,
      }
      setTeam(freshTeam)
      setTeams(prev => prev.map(t => t.id === freshTeam.id ? freshTeam : t))
      applyTeamCSSVars(freshTeam)
      setEditingTeam(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingTeam(false)
    }
  }

  async function handleDeleteTeam() {
    setDeletingTeam(true)
    try {
      await ctxDeleteTeam(team.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingTeam(false)
      setShowDelete(false)
    }
  }

  async function handleSavePlayer(playerData) {
    setError('')
    try {
      if (editingPlayer) {
        const { data, error: err } = await supabase
          .from('players').update(playerData).eq('id', editingPlayer.id).select().single()
        if (err) throw err
        setPlayers(prev => prev.map(p => p.id === data.id ? data : p))
      } else {
        const { data, error: err } = await supabase
          .from('players').insert({ ...playerData, team_id: team.id }).select().single()
        if (err) throw err
        setPlayers(prev => [...prev, data].sort((a, b) => a.jersey_number - b.jersey_number))
        setPlayerCount(prev => prev + 1)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setShowModal(false)
      setEditingPlayer(null)
    }
  }

  async function handleDeletePlayer(playerId) {
    setError('')
    try {
      const { error: err } = await supabase.from('players').delete().eq('id', playerId)
      if (err) throw err
      setPlayers(prev => prev.filter(p => p.id !== playerId))
      setPlayerCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      setError(err.message)
    }
  }

  function openEdit(player) {
    setEditingPlayer(player)
    setShowModal(true)
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    setIsDeleting(true)
    setDeleteError('')
    try {
      const { error: teamsError } = await supabase.from('teams').delete().eq('user_id', userId)
      if (teamsError) throw teamsError

      await supabase.from('custom_drills').delete().eq('user_id', userId)
      await supabase.from('drill_favorites').delete().eq('user_id', userId)

      const { error: rpcError } = await supabase.rpc('delete_user')
      if (rpcError) throw rpcError

      await supabase.auth.signOut()
      setTeams([])
      setTeam(null)
    } catch (err) {
      console.error('Delete account error:', err)
      setDeleteError('Something went wrong. Please try again or contact support@gavamotion.com')
      setIsDeleting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 pb-6">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">

        {/* My Team header with + New team button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>My Team</span>
          <button
            onClick={onCreateTeam}
            style={{
              background: '#00c853', color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            + New team
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* ── No team ── */}
        {noTeam && (
          <div className="text-center py-16 rounded-2xl border-dashed" style={{ background: 'var(--bg-panel)', border: '1px dashed var(--border-purple)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--team-primary, #1a5c2e)' }}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-white font-semibold text-base mb-1">No team yet</p>
            <p className="text-gray-500 text-sm">Tap the team name in the header to create your first team.</p>
          </div>
        )}

        {/* ── Team section ── */}
        {team && (
          <>
            {editingTeam ? (
              /* ── Edit form ── */
              <div className="rounded-2xl p-6" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-purple)' }}>
                <h2 className="text-xl font-bold text-white mb-1">Edit Team</h2>
                <p className="text-gray-400 text-sm mb-5">Update your team details and branding.</p>
                <form onSubmit={handleSaveTeam} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Team Name</label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={e => setTeamName(e.target.value)}
                      placeholder="e.g. Green Dragons"
                      className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none transition"
                      onFocus={e => (e.target.style.boxShadow = '0 0 0 2px var(--team-primary, #1a5c2e)')}
                      onBlur={e => (e.target.style.boxShadow = '')}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Division</label>
                    <select
                      value={division}
                      onChange={e => setDivision(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none transition appearance-none"
                      onFocus={e => (e.target.style.boxShadow = '0 0 0 2px var(--team-primary, #1a5c2e)')}
                      onBlur={e => (e.target.style.boxShadow = '')}
                    >
                      {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  {/* Branding fields */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                      Team Branding
                    </p>
                    <BrandingFields
                      colorPrimary={branding.colorPrimary}
                      colorSecondary={branding.colorSecondary}
                      colorAccent={branding.colorAccent}
                      onChange={b => setBranding(prev => ({ ...prev, ...b }))}
                    />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingTeam(false)}
                      className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white transition font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingTeam}
                      className="flex-1 py-2.5 rounded-lg font-semibold text-white transition disabled:opacity-60"
                      style={{ backgroundColor: 'var(--team-primary, #1a5c2e)' }}
                    >
                      {savingTeam ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* ── Team banner ── */
              <div className="rounded-2xl overflow-hidden"
                style={{ background: `linear-gradient(135deg, var(--team-primary, #1a5c2e) 0%, color-mix(in srgb, var(--team-primary, #1a5c2e) 70%, #000) 100%)` }}>

                {/* Badge + name row */}
                <div className="flex flex-col items-center pt-8 pb-5 px-5">
                  {/* Initials circle */}
                  <div style={{
                    marginBottom: 12,
                    width: 80, height: 80, borderRadius: '50%',
                    background: team?.color_primary || '#1a5c2e',
                    border: '2px solid rgba(255,255,255,0.15)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 32, fontWeight: 700, color: '#fff',
                  }}>
                    {team?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <p className="text-green-200 text-xs font-medium uppercase tracking-widest mb-1">
                    {team.division} Division
                  </p>
                  <h2 className="text-2xl font-bold text-white text-center">{team.name}</h2>
                  <p className="text-green-300 text-sm mt-1">
                    {players.length} player{players.length !== 1 ? 's' : ''}
                  </p>

                  {/* Color swatches */}
                  {teamColors.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      {teamColors.map((c, i) => (
                        <div key={i} style={{
                          width: 16, height: 16, borderRadius: '50%', background: c,
                          border: '1.5px solid rgba(255,255,255,0.35)',
                        }} title={c} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Edit + Delete buttons row */}
                <div style={{ display: 'flex', gap: 0, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  <button
                    onClick={openEditTeam}
                    style={{
                      flex: 1, padding: '10px', background: 'none', border: 'none',
                      color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      borderRight: '1px solid rgba(255,255,255,0.12)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Team
                  </button>
                  {teams.length > 0 && (
                    <button
                      onClick={() => setShowDelete(true)}
                      style={{
                        flex: 1, padding: '10px', background: 'none', border: 'none',
                        color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.color = '#fca5a5' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Team
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Roster ── */}
            {!editingTeam && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">Roster</h3>
                  <button
                    onClick={() => { setEditingPlayer(null); setShowModal(true) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition"
                    style={{ backgroundColor: 'var(--team-primary, #1a5c2e)' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Player
                  </button>
                </div>

                {players.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl border-dashed" style={{ background: 'var(--bg-panel)', border: '1px dashed var(--border-purple)' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-gray-800">
                      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-400 text-sm">No players yet.</p>
                    <p className="text-gray-500 text-xs mt-1">Tap "Add Player" to build your roster.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {players.map(player => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        onEdit={openEdit}
                        onDelete={handleDeletePlayer}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {onSignOut && (
          <div style={{ paddingTop: 8, paddingBottom: 4, textAlign: 'center' }}>
            <button
              onClick={onSignOut}
              style={{
                fontSize: 13, color: 'rgba(248,113,113,0.6)', background: 'none',
                border: 'none', cursor: 'pointer', padding: '6px 16px', borderRadius: 8,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(248,113,113,0.6)')}
            >
              Sign Out
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <button
            onClick={() => setShowDeleteAccount(true)}
            style={{
              background: 'none', border: 'none', color: 'rgba(220,50,50,0.5)',
              fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: '4px 0',
            }}
          >
            Delete my account
          </button>
        </div>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4, marginBottom: 4, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          <span onClick={() => setShowTerms(true)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Terms of Service</span>
          <span>·</span>
          <span onClick={() => setShowPrivacy(true)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Privacy Policy</span>
        </div>

        <span
          onClick={() => { localStorage.removeItem('onboardingComplete'); onShowOnboarding?.() }}
          style={{
            color: 'rgba(255,255,255,0.2)', fontSize: 11, cursor: 'pointer',
            textDecoration: 'underline', display: 'block', textAlign: 'center',
            marginBottom: 8,
          }}
        >
          View intro again
        </span>
      </div>

      {/* ── Modals ── */}
      {showModal && (
        <AddPlayerModal
          initial={editingPlayer}
          onSave={handleSavePlayer}
          onClose={() => { setShowModal(false); setEditingPlayer(null) }}
        />
      )}

      {showDelete && (
        <DeleteTeamDialog
          teamName={team?.name}
          onConfirm={handleDeleteTeam}
          onCancel={() => setShowDelete(false)}
        />
      )}

      {deletingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: 'var(--team-primary, #1a5c2e)', borderTopColor: 'transparent' }} />
        </div>
      )}

      {showPrivacy && <PrivacyPolicy onBack={() => setShowPrivacy(false)} />}
      {showTerms   && <TermsOfService onBack={() => setShowTerms(false)} />}

      {showDeleteAccount && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 24,
        }}>
          <div style={{
            background: '#1a1a2e', border: '1px solid rgba(220,50,50,0.3)',
            borderRadius: 16, padding: 24, width: '100%', maxWidth: 360,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ color: '#E24B4A', fontSize: 18, fontWeight: 700 }}>Delete account</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6 }}>
              This will permanently delete your account and all your data including teams, players, game plans and practice plans. This cannot be undone.
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6 }}>
                Type DELETE to confirm:
              </div>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                style={{
                  background: '#0d0d1a', border: '1px solid rgba(220,50,50,0.3)',
                  borderRadius: 8, padding: '10px 12px', color: '#fff',
                  fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none',
                }}
              />
            </div>
            {deleteError && (
              <div style={{ color: '#E24B4A', fontSize: 12 }}>{deleteError}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(''); setDeleteError('') }}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                  padding: '12px', color: '#fff', fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                style={{
                  flex: 1,
                  background: deleteConfirmText === 'DELETE' ? '#A32D2D' : 'rgba(163,45,45,0.3)',
                  border: 'none', borderRadius: 8, padding: '12px',
                  color: deleteConfirmText === 'DELETE' ? '#fff' : 'rgba(255,255,255,0.3)',
                  fontSize: 14, fontWeight: 600,
                  cursor: deleteConfirmText === 'DELETE' ? 'pointer' : 'default',
                }}
              >
                {isDeleting ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
