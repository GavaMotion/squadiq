import { useState, useRef, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useToast } from './components/UI/Toast'
import theme from './theme'
import { AppProvider, useApp, getCachedAge } from './contexts/AppContext'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { supabase } from './lib/supabase'
import AuthPage from './components/Auth/AuthPage'
import Onboarding from './components/Onboarding/Onboarding'
import MyTeamPage from './components/Team/MyTeamPage'
import GameDayPage from './components/GameDay/GameDayPage'
import SketchPage from './components/Sketch/SketchPage'
import PracticePage from './components/Practice/PracticePage'
import TeamBadge from './components/Team/TeamBadge'
import BrandingFields from './components/Team/BrandingFields'

// ── Splash screen ────────────────────────────────────────────────
function SplashScreen({ onDone }) {
  const [fadeOut, setFadeOut] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isLandscape, setIsLandscape] = useState(
    () => window.innerWidth > window.innerHeight
  )

  useEffect(() => {
    function handleOrientationChange() {
      setIsLandscape(window.innerWidth > window.innerHeight)
    }
    window.addEventListener('resize', handleOrientationChange)
    return () => window.removeEventListener('resize', handleOrientationChange)
  }, [])

  useEffect(() => {
    if (!imageLoaded) return
    const fadeTimer = setTimeout(() => setFadeOut(true), 2000)
    const doneTimer = setTimeout(() => onDone(), 2500)
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [imageLoaded])

  useEffect(() => {
    setImageLoaded(false)
  }, [isLandscape])

  const coverSrc = isLandscape ? '/cover_H.png' : '/cover_V.png'

  return (
    <div
      className="splash-container"
      style={{
        zIndex: 99999,
        background: '#0d0d1a',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.5s ease-in-out',
      }}
    >
      <img
        key={coverSrc}
        src={coverSrc}
        alt="SquadIQ"
        onLoad={() => setImageLoaded(true)}
        onError={() => onDone()}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block',
        }}
      />
    </div>
  )
}

// ── New Team modal (shown from team switcher) ────────────────────
const DIVISIONS = ['8U', '10U', '12U', '14U', '16U', '19U']

function NewTeamModal({ onSave, onCancel }) {
  const { userId } = useApp()
  const [name,     setName]     = useState('')
  const [division, setDivision] = useState('10U')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  // Branding state
  const [branding, setBranding] = useState({
    colorPrimary: '#1a5c2e', colorSecondary: null, colorAccent: null,
  })

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Team name is required.')
    setSaving(true)
    try {
      await onSave(name.trim(), division, {
        colorPrimary:   branding.colorPrimary,
        colorSecondary: branding.colorSecondary,
        colorAccent:    branding.colorAccent,
      })
    } catch (err) {
      setError(err.message || 'Failed to create team.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl w-full max-w-sm shadow-2xl mx-4 mb-4 sm:mb-0 overflow-y-auto"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-purple)', maxHeight: '90dvh', padding: '20px' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-base mb-4">New Team</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Name + Division */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Team Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Blue Lightning"
              className="w-full text-sm rounded-lg px-3 py-2.5 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none transition"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Division</label>
            <select
              value={division}
              onChange={e => setDivision(e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2.5 bg-gray-800 border border-gray-700 text-white focus:outline-none appearance-none"
            >
              {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Branding */}
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

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 text-sm font-semibold py-2.5 rounded-xl text-white transition"
              style={{
                background: name.trim() ? 'var(--team-primary, #1a5c2e)' : '#374151',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Creating…' : 'Create Team'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 text-sm py-2.5 rounded-xl transition"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Team switcher dropdown (used inside AppHeader) ───────────────
function TeamSwitcher() {
  const { teams, activeTeamId, team, switchTeam, createTeam } = useApp()
  const [open,        setOpen]        = useState(false)
  const [showNewTeam, setShowNewTeam] = useState(false)
  const dropdownRef = useRef(null)

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (teams.length === 0 && !showNewTeam) {
    return (
      <button
        onClick={() => setShowNewTeam(true)}
        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition"
        style={{ background: 'var(--team-primary, #1a5c2e)', color: '#fff' }}
      >
        + New Team
      </button>
    )
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-sm font-medium text-white transition max-w-[180px]"
          style={{ border: '1px solid var(--border-purple)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: team?.color_primary || '#1a5c2e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
            }}>
              {team?.name?.charAt(0).toUpperCase() || '?'}
            </div>
          <span className="truncate" style={{ maxWidth: 110 }}>{team?.name || 'Select team'}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M2 3.5l3 3 3-3" />
          </svg>
        </button>

        {open && (
          <div
            className="absolute left-0 top-full mt-1 rounded-xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-purple)', minWidth: 200, zIndex: 200 }}
          >
            {teams.map(t => {
              const isActive = t.id === activeTeamId
              const primary  = t.color_primary || '#1a5c2e'
              return (
                <button
                  key={t.id}
                  onClick={() => { switchTeam(t.id); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition"
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  style={{ color: isActive ? '#fff' : '#e5e7eb' }}
                >
                  <TeamBadge team={t} size={28} />
                  <span className="flex-1 truncate font-medium">{t.name}</span>
                  {/* Primary color swatch */}
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: primary, flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.2)',
                  }} />
                  <span className="text-xs flex-shrink-0" style={{ color: '#6b7280' }}>{t.division}</span>
                  {isActive && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill={primary} style={{ flexShrink: 0 }}>
                      <circle cx="5" cy="5" r="4" />
                    </svg>
                  )}
                </button>
              )
            })}
            <div style={{ borderTop: '1px solid var(--border-purple)' }}>
              <button
                onClick={() => { setOpen(false); setShowNewTeam(true) }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition"
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                style={{ color: 'var(--team-primary, #4ade80)' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 1v10M1 6h10" />
                </svg>
                New team
              </button>
            </div>
          </div>
        )}
      </div>

      {showNewTeam && (
        <NewTeamModal
          onSave={async (name, division, branding) => {
            await createTeam(name, division, branding)
            setShowNewTeam(false)
          }}
          onCancel={() => setShowNewTeam(false)}
        />
      )}
    </>
  )
}

// ── App name wordmark ─────────────────────────────────────────────
function AppWordmark() {
  return (
    <span style={{ fontSize: 16, lineHeight: 1, userSelect: 'none', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
      <span style={{ color: '#e5e7eb', fontWeight: 400 }}>Squad</span>
      <span style={{ color: 'var(--team-primary, #00c853)', fontWeight: 800 }}>IQ</span>
    </span>
  )
}

// ── Top app header ───────────────────────────────────────────────
function AppHeader({ onSignOut }) {
  return (
    <header
      className="flex items-center justify-between px-4 border-b border-gray-800 bg-gray-950"
      style={{ height: 52, flexShrink: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Left: app wordmark */}
      <AppWordmark />

      {/* Right: team switcher + sign out */}
      <div className="flex items-center gap-2">
        <TeamSwitcher />
        <button
          onClick={onSignOut}
          className="text-xs text-gray-500 hover:text-white transition px-2 py-1.5 rounded-lg hover:bg-gray-800"
        >
          Sign Out
        </button>
      </div>
    </header>
  )
}

// ── Per-tab active colors ─────────────────────────────────────────
const TAB_COLORS = {
  team:     '#D4537E',
  lineup:   '#00c853',
  sketch:   '#FF6B2B',
  practice: '#00BCD4',
}

// ── Bottom tab bar ───────────────────────────────────────────────
function TabBar({ active, onChange }) {
  const tabs = [
    {
      id: 'team', label: 'My Team',
      renderIcon: (color) => (
        <svg width="20" height="20" fill="none" stroke={color} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'lineup', label: 'Lineup',
      renderIcon: (color) => (
        <svg width="20" height="20" fill="none" stroke={color} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 3a9 9 0 010 18M3 12h18M12 3c-2.5 2.5-4 5.5-4 9s1.5 6.5 4 9M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9" />
        </svg>
      ),
    },
    {
      id: 'sketch', label: 'Sketch',
      renderIcon: (color) => (
        <svg width="20" height="20" fill="none" stroke={color} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
    },
    {
      id: 'practice', label: 'Practice',
      renderIcon: (color) => (
        <svg width="20" height="20" fill="none" stroke={color} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
  ]

  return (
    <nav
      className="flex border-t border-gray-800 bg-gray-950"
      style={{ flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map(tab => {
        const isActive = active === tab.id
        const tabColor = isActive ? (TAB_COLORS[tab.id] || '#00c853') : '#6b7280'
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            aria-label={`${tab.label} tab`}
            aria-pressed={isActive}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 2, padding: '8px 0',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{ color: tabColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {tab.renderIcon(tabColor)}
            </span>
            <span style={{ color: tabColor, fontSize: 11, fontWeight: 500, lineHeight: 1 }}>
              {tab.label}
            </span>
            {isActive && (
              <span style={{
                display: 'block', width: 16, height: 2, borderRadius: 2,
                backgroundColor: tabColor,
              }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ── PWA install detection ─────────────────────────────────────────
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const isInStandalone = window.matchMedia('(display-mode: standalone)').matches

// ── Inner content (rendered inside AppProvider) ──────────────────
function AppContent({ tab, setTab, onSignOut, onShowOnboarding }) {
  const { createTeam, syncPendingChanges, activeTeamId } = useApp()
  const { addToast } = useToast()
  const isOnline = useOnlineStatus()
  const wasOfflineRef = useRef(false)
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)
  const [showNewTeam, setShowNewTeam] = useState(false)

  // Android install prompt
  const [installPrompt,     setInstallPrompt]     = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  // iOS install hint
  const [showIOSBanner, setShowIOSBanner] = useState(false)

  useEffect(() => {
    function onResize() { setIsWide(window.innerWidth >= 768) }
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true
      addToast('You\'re offline — changes will be saved when you reconnect', 'warning', 5000)
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false
      addToast('Back online — syncing changes…', 'success', 3000)
      syncPendingChanges().then(({ synced, failed }) => {
        if (synced > 0) addToast(`${synced} change${synced === 1 ? '' : 's'} synced`, 'success', 3000)
        if (failed > 0) addToast(`${failed} change${failed === 1 ? '' : 's'} could not be synced`, 'error', 5000)
      })
    }
  }, [isOnline, addToast, syncPendingChanges])

  useEffect(() => {
    function onUnhandledRejection(event) {
      if (event.reason?.message?.includes('fetch')) {
        addToast('Connection error — please check your internet', 'error')
      }
    }
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }, [addToast])

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  useEffect(() => {
    if (isIOS && !isInStandalone) {
      const seen = localStorage.getItem('iosInstallPromptSeen')
      if (!seen) {
        const t = setTimeout(() => setShowIOSBanner(true), 3000)
        return () => clearTimeout(t)
      }
    }
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') setShowInstallBanner(false)
  }

  const bannerStyle = {
    position: 'fixed', bottom: 70, left: 16, right: 16,
    background: '#1a1a2e', border: '1px solid rgba(0,200,83,0.3)',
    borderRadius: 12, padding: '12px 16px', zIndex: 9999,
  }

  const cacheAge = activeTeamId ? getCachedAge(`cache_players_${activeTeamId}`) : null

  return (
    <div className="flex flex-col bg-gray-950" style={{ height: '100dvh', overflow: 'hidden' }}>
      {!isOnline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99997,
          background: 'rgba(120,70,8,0.97)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, padding: '6px 16px', fontSize: 12, color: '#fff', fontWeight: 500,
        }}>
          <span>⚡</span>
          <span>
            You're offline{cacheAge ? ` — showing data from ${cacheAge}` : ''}
          </span>
        </div>
      )}
      {isWide && <AppHeader onSignOut={onSignOut} />}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'team'     && <MyTeamPage onSignOut={isWide ? undefined : onSignOut} onCreateTeam={() => setShowNewTeam(true)} onShowOnboarding={onShowOnboarding} />}
        {tab === 'lineup'   && <GameDayPage />}
        {tab === 'sketch'   && <SketchPage />}
        {tab === 'practice' && <PracticePage />}
      </div>
      <TabBar active={tab} onChange={setTab} />

      {/* Android install banner */}
      {showInstallBanner && (
        <div style={bannerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/icons/icon-72.png" style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0 }} alt="" />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Install SquadIQ</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Add to your home screen</div>
            </div>
            <button
              onClick={handleInstall}
              style={{ background: '#00c853', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
            >
              Install
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              aria-label="Dismiss install banner"
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* iOS install hint */}
      {showIOSBanner && (
        <div style={bannerStyle}>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Install SquadIQ
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.5 }}>
            Tap the <strong style={{ color: '#fff' }}>Share</strong> button below, then tap <strong style={{ color: '#fff' }}>"Add to Home Screen"</strong>
          </div>
          <div style={{ fontSize: 22, textAlign: 'center', margin: '8px 0', color: '#00c853' }}>
            ↑ Share → Add to Home Screen
          </div>
          <button
            onClick={() => { localStorage.setItem('iosInstallPromptSeen', 'true'); setShowIOSBanner(false) }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'center', marginTop: 4 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {tab !== 'lineup' && (
        <div style={{
          position: 'fixed',
          right: -28,
          bottom: 70,
          fontSize: 8,
          color: 'rgba(255,255,255,0.15)',
          pointerEvents: 'none',
          zIndex: 9999,
          transform: 'rotate(-90deg)',
          transformOrigin: 'right center',
          letterSpacing: '1px',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}>
          Created by Gava Motion
        </div>
      )}

      {showNewTeam && (
        <NewTeamModal
          onSave={async (name, division, branding) => {
            await createTeam(name, division, branding)
            setShowNewTeam(false)
          }}
          onCancel={() => setShowNewTeam(false)}
        />
      )}
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────
export default function App() {
  const { session, signOut } = useAuth()
  const { addToast } = useToast()
  const [tab, setTab] = useState('team')
  const [showSplash, setShowSplash] = useState(() => {
    const seen = sessionStorage.getItem('splashShown')
    if (!seen) { sessionStorage.setItem('splashShown', 'true'); return true }
    return false
  })
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [newPassword,       setNewPassword]       = useState('')
  const [confirmPassword,   setConfirmPassword]   = useState('')
  const [passwordError,     setPasswordError]     = useState('')
  const [showOnboarding,    setShowOnboarding]    = useState(false)
  const [showSessionExpired, setShowSessionExpired] = useState(false)

  // Refs to distinguish manual sign-out from session expiry
  const isManualSignOutRef   = useRef(false)
  const wasAuthenticatedRef  = useRef(false)

  // Track when a real session is established
  useEffect(() => {
    if (session) {
      wasAuthenticatedRef.current = true
      isManualSignOutRef.current  = false  // reset on fresh login
    }
  }, [session])

  // Secondary auth-state listener — detect unexpected sign-outs
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && wasAuthenticatedRef.current && !isManualSignOutRef.current) {
        setShowSessionExpired(true)
      }
      if (event === 'TOKEN_REFRESHED') {
        setShowSessionExpired(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Session check when the app regains focus or becomes visible
  useEffect(() => {
    async function checkSession() {
      if (!wasAuthenticatedRef.current) return
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) {
        addToast('Your session expired — please log in again', 'warning', 5000)
        setShowSessionExpired(true)
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') checkSession()
    }
    window.addEventListener('focus', checkSession)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', checkSession)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [addToast])

  // Proactive token refresh every 30 minutes
  useEffect(() => {
    if (!session) return
    const refreshInterval = setInterval(async () => {
      const { error } = await supabase.auth.refreshSession()
      if (error) {
        console.log('Could not refresh session:', error.message)
        setShowSessionExpired(true)
      }
    }, 30 * 60 * 1000)
    return () => clearInterval(refreshInterval)
  }, [session])

  // Custom 'session-expired' event (dispatched by Supabase 401 interceptors)
  useEffect(() => {
    function handleSessionExpired() { setShowSessionExpired(true) }
    window.addEventListener('session-expired', handleSessionExpired)
    return () => window.removeEventListener('session-expired', handleSessionExpired)
  }, [])

  useEffect(() => {
    Object.entries(theme).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--${key}`, value)
    })
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(r => r.unregister())
      })
      caches.keys().then(names => names.forEach(name => caches.delete(name)))
    }
  }, [])

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const type = hashParams.get('type')
    if (type === 'recovery' && accessToken) {
      setShowResetPassword(true)
    }
  }, [])

  useEffect(() => {
    if (!session?.user) return
    const completed = localStorage.getItem('onboardingComplete')
    if (!completed) {
      const createdAt = new Date(session.user.created_at)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      if (createdAt > fiveMinutesAgo) {
        setShowOnboarding(true)
      }
    }
  }, [session])

  function handleSignOut() {
    isManualSignOutRef.current = true
    setShowSessionExpired(false)
    signOut()
  }

  async function handleUpdatePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
    } else {
      setShowResetPassword(false)
      setPasswordError('')
      setNewPassword('')
      setConfirmPassword('')
      window.location.hash = ''
      alert('Password updated successfully!')
    }
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: 'var(--team-primary, #1a5c2e)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <>
      {/* ── Session expired overlay (sits above everything) ── */}
      {showSessionExpired && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: 24,
        }}>
          <div style={{
            background: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding: 32,
            width: '100%',
            maxWidth: 360,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{ fontSize: 48 }}>⏱</div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>
              Session expired
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.7 }}>
              You have been logged out due to inactivity. Please log in again to continue.
            </div>
            <button
              onClick={() => {
                setShowSessionExpired(false)
                isManualSignOutRef.current = true
                signOut()
              }}
              style={{
                background: '#00c853',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '14px 32px',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Log in again
            </button>
          </div>
        </div>
      )}

      {/* ── Main app or auth page ── */}
      {!session ? (
        <AuthPage />
      ) : (
        <>
          {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
          <div style={{
            opacity: showSplash ? 0 : 1,
            transition: 'opacity 0.3s ease-in',
            visibility: showSplash ? 'hidden' : 'visible',
          }}>
            <AppProvider userId={session.user.id}>
              <AppContent tab={tab} setTab={setTab} onSignOut={handleSignOut} onShowOnboarding={() => setShowOnboarding(true)} />
            </AppProvider>
          </div>

          {!showSplash && showOnboarding && (
            <Onboarding onComplete={() => setShowOnboarding(false)} />
          )}

          {showResetPassword && (
            <div style={{
              position: 'fixed', inset: 0, background: '#0d0d1a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24, zIndex: 99999,
            }}>
              <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>Set new password</div>
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{
                    background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 8, padding: '12px 14px', color: '#fff', fontSize: 14,
                    width: '100%', boxSizing: 'border-box', outline: 'none',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#00c853')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{
                    background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 8, padding: '12px 14px', color: '#fff', fontSize: 14,
                    width: '100%', boxSizing: 'border-box', outline: 'none',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#00c853')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
                />
                {passwordError && (
                  <div style={{ color: '#f87171', fontSize: 12 }}>{passwordError}</div>
                )}
                <button
                  onClick={handleUpdatePassword}
                  style={{
                    background: '#00c853', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '12px', fontSize: 14,
                    fontWeight: 600, cursor: 'pointer', width: '100%',
                  }}
                >
                  Update password
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
