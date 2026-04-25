import { useState, useRef, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useToast } from './components/UI/Toast'
import theme from './theme'
import { AppProvider, useApp, getCachedAge } from './contexts/AppContext'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { supabase } from './lib/supabase'
import { getStripe, PRICE_IDS } from './lib/stripe'
import AuthPage from './components/Auth/AuthPage'
import Onboarding from './components/Onboarding/Onboarding'
import PrivacyPolicy from './components/Legal/PrivacyPolicy'
import TermsOfService from './components/Legal/TermsOfService'
import MyTeamPage from './components/Team/MyTeamPage'
import GameDayPage from './components/GameDay/GameDayPage'
import SketchPage from './components/Sketch/SketchPage'
import PracticePage from './components/Practice/PracticePage'
import StandingsPage from './components/Standings/StandingsPage'
import TeamBadge from './components/Team/TeamBadge'
import BrandingFields from './components/Team/BrandingFields'

// ── Splash screen ────────────────────────────────────────────────
function SplashScreen({ onDone }) {
  const [fadeOut, setFadeOut] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const timerRef = useRef(null)
  const doneCalledRef = useRef(false)
  const [isLandscape, setIsLandscape] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight
  )

  useEffect(() => {
    function handleResize() { setIsLandscape(window.innerWidth > window.innerHeight) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function triggerDone() {
    if (doneCalledRef.current) return
    doneCalledRef.current = true
    setFadeOut(true)
    setTimeout(() => onDone(), 500)
  }

  // Absolute maximum — splash never stays longer than 5 seconds
  useEffect(() => {
    const absoluteMax = setTimeout(() => triggerDone(), 5000)
    return () => clearTimeout(absoluteMax)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!imageLoaded) return
    timerRef.current = setTimeout(() => triggerDone(), 2000)
    return () => clearTimeout(timerRef.current)
  }, [imageLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const coverSrc = isLandscape ? '/cover_H.png' : '/cover_V.png'

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      overflow: 'hidden', zIndex: 99999,
      background: '#0d0d1a',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.5s ease-in-out',
    }}>
      <img
        key={coverSrc}
        src={coverSrc}
        alt="SquadIQ"
        onLoad={() => setImageLoaded(true)}
        onError={() => triggerDone()}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center',
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
  const { teams, activeTeamId, team, switchTeam, createTeam, maxTeams, isTrialExpired } = useApp()
  const { addToast } = useToast()
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
                onClick={() => {
                  setOpen(false)
                  if (teams.length >= maxTeams) {
                    addToast(isTrialExpired
                      ? 'Your trial has expired — upgrade to add teams'
                      : `Your plan allows up to ${maxTeams} team${maxTeams === 1 ? '' : 's'} — upgrade to add more`,
                      'warning', 4000)
                    return
                  }
                  setShowNewTeam(true)
                }}
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
  team:      '#D4537E',
  lineup:    '#00c853',
  sketch:    '#FF6B2B',
  practice:  '#00BCD4',
  standings: '#F5C842',
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
    {
      id: 'standings', label: 'Standings',
      renderIcon: (color) => (
        <svg width="20" height="20" fill="none" stroke={color} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5 3v18M5 7h6a3 3 0 010 6H5M19 14v7M19 14h-4a3 3 0 010-6h4" />
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
  const { createTeam, syncPendingChanges, activeTeamId, team, teams, maxTeams, isTrialExpired, daysLeftInTrial, subscription, setSubscription } = useApp()
  const { session } = useAuth()
  const user = session?.user
  const { addToast } = useToast()
  const isOnline = useOnlineStatus()
  const wasOfflineRef = useRef(false)
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)
  const [showNewTeam, setShowNewTeam] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [checkoutLoading, setCheckoutLoading] = useState(null)

  // Check for successful Stripe payment on return from checkout
  useEffect(() => {
    async function checkPaymentSuccess() {
      const urlParams = new URLSearchParams(window.location.search)
      const sessionId = urlParams.get('session_id')
      if (!sessionId || !user) return

      window.history.replaceState({}, '', window.location.pathname)

      try {
        addToast('Confirming your subscription...', 'info', 3000)

        const { data, error } = await supabase.functions.invoke('confirm-subscription', {
          body: { sessionId, userId: user.id },
        })

        if (error) throw error

        if (data?.plan) {
          const { data: freshSub } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (freshSub) setSubscription(freshSub)

          addToast(
            `Welcome to SquadIQ ${data.plan === 'premium' ? 'Premium Coach' : 'Solo Coach'}! 🎉`,
            'success',
            5000
          )

          setShowUpgradeModal(false)
        }
      } catch (err) {
        console.error('Payment confirmation error:', err)
        addToast('Could not confirm subscription — please refresh the app', 'warning', 5000)
      }
    }

    checkPaymentSuccess()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpgrade(plan) {
    try {
      const priceKey = plan === 'multi' ? 'premium' : 'solo'
      const priceId = PRICE_IDS[priceKey]?.[billingPeriod]

      if (!priceId) {
        addToast(`No price ID found for ${plan} ${billingPeriod}`, 'error')
        return
      }
      if (!user?.id) {
        addToast('Not logged in', 'error')
        return
      }

      addToast('Redirecting to checkout...', 'info', 3000)

      const payload = {
        priceId,
        userId: user.id,
        userEmail: user.email,
        successUrl: 'https://squadiq-coach.vercel.app',
        cancelUrl: 'https://squadiq-coach.vercel.app',
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: payload,
      })

      if (error) throw error
      if (!data?.url) throw new Error('No checkout URL returned')

      window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
      addToast('Could not start checkout — please try again', 'error')
    }
  }

  async function handleCreateTeam(name, division, branding) {
    if (teams.length >= maxTeams) {
      addToast(isTrialExpired
        ? 'Your trial has expired — upgrade to add teams'
        : `Your plan allows up to ${maxTeams} team${maxTeams === 1 ? '' : 's'} — upgrade to add more`,
        'warning', 4000)
      setShowUpgradeModal(true)
      return
    }
    await createTeam(name, division, branding)
  }

  const [installPrompt,     setInstallPrompt]     = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

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
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches
    const alreadyDismissed = localStorage.getItem('installBannerDismissed')
    if (isInstalled || alreadyDismissed) return

    function handleBeforeInstall(e) {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
      setTimeout(() => {
        setShowInstallBanner(false)
        localStorage.setItem('installBannerDismissed', 'true')
      }, 6000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  function dismissInstallBanner() {
    setShowInstallBanner(false)
    localStorage.setItem('installBannerDismissed', 'true')
  }

  async function handleInstallApp() {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      localStorage.setItem('installBannerDismissed', 'true')
    }
    setShowInstallBanner(false)
    setInstallPrompt(null)
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
        {tab === 'team'     && <MyTeamPage onSignOut={isWide ? undefined : onSignOut} onCreateTeam={() => setShowNewTeam(true)} onShowOnboarding={onShowOnboarding} installPrompt={installPrompt} onInstallApp={handleInstallApp} />}
        {tab === 'lineup'   && <GameDayPage />}
        {tab === 'sketch'   && <SketchPage />}
        {tab === 'practice'  && <PracticePage />}
        {tab === 'standings' && <StandingsPage team={team} />}
      </div>
      <TabBar active={tab} onChange={setTab} />

      {/* Install banner — shows once for 6s */}
      {showInstallBanner && (
        <div style={{
          position: 'fixed', bottom: 70, left: 16, right: 16,
          background: '#1a1a2e', border: '1px solid rgba(0,200,83,0.3)',
          borderRadius: 12, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          zIndex: 9990, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'slideUp 0.3s ease',
        }}>
          <img src="/icons/icon-192.png" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} alt="SquadIQ" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Install SquadIQ</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Add to your home screen</div>
          </div>
          <button onClick={handleInstallApp} style={{ background: '#00c853', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            Install
          </button>
          <button onClick={dismissInstallBanner} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 18, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>
            ✕
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
            await handleCreateTeam(name, division, branding)
            setShowNewTeam(false)
          }}
          onCancel={() => setShowNewTeam(false)}
        />
      )}

      {/* ── Trial expiry banner ── */}
      {subscription?.plan === 'trial' && daysLeftInTrial !== null && daysLeftInTrial <= 7 && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: daysLeftInTrial <= 3 ? 'rgba(163,45,45,0.95)' : 'rgba(133,79,11,0.95)',
          color: '#fff', fontSize: 12, fontWeight: 500,
          padding: '6px 16px', textAlign: 'center', zIndex: 9000,
        }}>
          {daysLeftInTrial === 0
            ? 'Your trial expires today — upgrade to keep access'
            : `${daysLeftInTrial} day${daysLeftInTrial === 1 ? '' : 's'} left in your free trial`}
          <span
            onClick={() => setShowUpgradeModal(true)}
            style={{ marginLeft: 10, textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}
          >
            Upgrade
          </span>
        </div>
      )}

      {/* ── Upgrade modal ── */}
      {(isTrialExpired || showUpgradeModal) && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99990, padding: 24,
        }}>
          <div style={{
            background: '#1a1a2e', border: '1px solid rgba(0,200,83,0.2)',
            borderRadius: 20, padding: 32, width: '100%', maxWidth: 380,
            display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center',
          }}>
            <div style={{ fontSize: 36 }}>🏆</div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
              {isTrialExpired ? 'Your trial has ended' : 'Upgrade SquadIQ'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6 }}>
              {isTrialExpired
                ? 'Subscribe to continue coaching with SquadIQ'
                : 'Choose a plan to unlock more teams'}
            </div>

            {/* Billing period toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, gap: 2 }}>
              {['monthly', 'yearly'].map(period => (
                <button
                  key={period}
                  onClick={() => setBillingPeriod(period)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                    background: billingPeriod === period ? '#00c853' : 'none',
                    color: billingPeriod === period ? '#fff' : 'rgba(255,255,255,0.45)',
                  }}
                >
                  {period === 'monthly' ? 'Monthly' : 'Yearly · save 33%'}
                </button>
              ))}
            </div>

            {/* Solo plan */}
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Solo Coach</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>1 team · All features</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#00c853', fontSize: 18, fontWeight: 700 }}>
                    {billingPeriod === 'monthly' ? '$4.99' : '$39.99'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                    {billingPeriod === 'monthly' ? '/month' : '/year'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleUpgrade('solo')}
                disabled={!!checkoutLoading}
                style={{ marginTop: 12, width: '100%', background: '#00c853', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: checkoutLoading ? 'not-allowed' : 'pointer', opacity: checkoutLoading === 'solo' ? 0.7 : 1 }}
              >
                {checkoutLoading === 'solo' ? 'Opening checkout…' : billingPeriod === 'monthly' ? 'Choose Solo — $4.99/mo' : 'Choose Solo — $39.99/yr'}
              </button>
            </div>

            {/* Multi plan */}
            <div style={{ background: 'rgba(0,200,83,0.05)', border: '1px solid rgba(0,200,83,0.3)', borderRadius: 12, padding: 16, textAlign: 'left', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -10, right: 16, background: '#00c853', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
                BEST VALUE
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Multi Coach</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Up to 4 teams · All features</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#00c853', fontSize: 18, fontWeight: 700 }}>
                    {billingPeriod === 'monthly' ? '$7.99' : '$63.99'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                    {billingPeriod === 'monthly' ? '/month' : '/year'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleUpgrade('multi')}
                disabled={!!checkoutLoading}
                style={{ marginTop: 12, width: '100%', background: '#00c853', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: checkoutLoading ? 'not-allowed' : 'pointer', opacity: checkoutLoading === 'multi' ? 0.7 : 1 }}
              >
                {checkoutLoading === 'multi' ? 'Opening checkout…' : billingPeriod === 'monthly' ? 'Choose Multi — $7.99/mo' : 'Choose Multi — $63.99/yr'}
              </button>
            </div>

            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
              Secure payment via Stripe · Cancel anytime
            </div>

            {!isTrialExpired && (
              <button onClick={() => setShowUpgradeModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer' }}>
                Not now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────
export default function App() {
  // Serve legal pages at /privacy and /terms without requiring auth
  const pathname = window.location.pathname
  if (pathname === '/privacy') return <PrivacyPolicy onBack={() => window.history.back()} />
  if (pathname === '/terms')   return <TermsOfService onBack={() => window.history.back()} />

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
