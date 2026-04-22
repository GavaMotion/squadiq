import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../UI/Toast'
import PrivacyPolicy from '../Legal/PrivacyPolicy'
import TermsOfService from '../Legal/TermsOfService'

export default function AuthPage() {
  const { addToast } = useToast()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')

  // Email verification
  const [showVerificationMessage, setShowVerificationMessage] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Legal
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms,   setShowTerms]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        setLoading(false)
        return
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: 'https://coachpad-tactix.vercel.app' },
      })
      setLoading(false)
      if (signUpError) { setError(signUpError.message); return }
      if (data?.user && !data.user.confirmed_at) {
        setShowVerificationMessage(true)
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (signInError) {
        if (signInError.message.toLowerCase().includes('email not confirmed')) {
          setShowVerificationMessage(true)
          setError('Please verify your email before logging in. Check your inbox.')
        } else {
          setError(signInError.message)
        }
      }
    }
  }

  async function handleResetPassword() {
    if (!resetEmail) { setResetError('Please enter your email address'); return }
    setResetError('')
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: 'https://coachpad-tactix.vercel.app/reset-password',
    })
    if (error) { setResetError(error.message) } else { setResetSent(true); addToast('Reset link sent — check your email', 'success') }
  }

  async function handleResendVerification() {
    if (resendCooldown > 0) return
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: 'https://coachpad-tactix.vercel.app' },
    })
    if (!error) {
      setResendCooldown(60)
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0 }
          return prev - 1
        })
      }, 1000)
    }
  }

  // ── Shared input style ───────────────────────────────────────────
  const inputStyle = {
    background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8, padding: '12px 14px', color: '#fff', fontSize: 14,
    width: '100%', boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,200,83,0.08) 0%, var(--bg-primary) 60%)' }}>

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ backgroundColor: 'var(--color-green-dark, #1a5c2e)', boxShadow: '0 0 24px rgba(0,200,83,0.3)' }}>
          <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 1.5c1.16 0 2.27.22 3.29.61L12 7.36 8.71 4.11A8.47 8.47 0 0 1 12 3.5zm-4.5 1.27 3.5 3.5-1.5 4.5H6.08A8.51 8.51 0 0 1 4.5 8.5c0-1.4.34-2.73.95-3.9L7.5 4.77zm9 0 2.05.83c.61 1.17.95 2.5.95 3.9 0 1.22-.26 2.38-.72 3.42L17 12.77l-1.5-4.5 3.5-3.5zM6.08 14.5H9l2 3.46-1.27 3.5A8.52 8.52 0 0 1 3.5 12c0-.52.05-1.03.13-1.53L6.08 14.5zm7.92 0h2.92l2.45-4.03c.08.5.13 1.01.13 1.53a8.52 8.52 0 0 1-6.23 8.46L13 16l1-1.5zm-3 .77L9.73 18h4.54L13 15.27l-2 .77z" />
          </svg>
        </div>
        <h1 className="text-3xl tracking-tight" style={{ color: '#fff', fontWeight: 400 }}>
          CoachPad{' '}
          <span style={{ fontWeight: 800, color: 'var(--color-green, #00c853)' }}>Tactix</span>
        </h1>
        <p className="text-gray-500 mt-1 text-sm">The smart coaching companion.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl shadow-xl p-8"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-purple)' }}>

        {/* ── Email verification screen ── */}
        {showVerificationMessage ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(0,200,83,0.15)', border: '2px solid rgba(0,200,83,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
            }}>
              ✉
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                Check your email
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.7, maxWidth: 280 }}>
                We sent a confirmation link to{' '}
                <span style={{ color: '#00c853' }}>{email}</span>.
                Click the link in the email to activate your account.
              </div>
            </div>
            <button
              onClick={handleResendVerification}
              disabled={resendCooldown > 0}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, padding: '10px 20px',
                color: resendCooldown > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
                fontSize: 13, cursor: resendCooldown > 0 ? 'default' : 'pointer',
              }}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation email'}
            </button>
            <span
              onClick={() => { setShowVerificationMessage(false); setEmail(''); setPassword(''); setError('') }}
              style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Back to login
            </span>
          </div>

        ) : showForgotPassword ? (
          /* ── Forgot password form ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Reset your password</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              Enter your email and we'll send you a link to reset your password.
            </div>
            <input
              type="email"
              placeholder="Your email address"
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#00c853')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
            {resetError && <div style={{ color: '#f87171', fontSize: 12 }}>{resetError}</div>}
            {resetSent ? (
              <div style={{
                background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.3)',
                borderRadius: 8, padding: '12px 14px', color: '#00c853', fontSize: 13,
              }}>
                ✓ Check your email for a password reset link
              </div>
            ) : (
              <button
                onClick={handleResetPassword}
                style={{ background: '#00c853', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}
              >
                Send reset link
              </button>
            )}
            <span
              onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetError('') }}
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', textAlign: 'center', textDecoration: 'underline' }}
            >
              Back to login
            </span>
          </div>

        ) : (
          /* ── Login / Signup form ── */
          <>
            <h2 className="text-xl font-semibold text-white mb-6">
              {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="coach@example.com"
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none transition"
                  onFocus={e => (e.target.style.boxShadow = '0 0 0 2px var(--color-green, #00c853)')}
                  onBlur={e => (e.target.style.boxShadow = '')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input
                  type="password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none transition"
                  onFocus={e => (e.target.style.boxShadow = '0 0 0 2px var(--color-green, #00c853)')}
                  onBlur={e => (e.target.style.boxShadow = '')}
                />
                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: 4 }}>
                    <span
                      onClick={() => { setShowForgotPassword(true); setResetEmail(email) }}
                      style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Forgot password?
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-green, #00c853)' }}
                onMouseEnter={e => !loading && (e.target.style.opacity = '0.85')}
                onMouseLeave={e => (e.target.style.opacity = '1')}
              >
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
                className="font-medium underline"
                style={{ color: 'var(--color-green, #00c853)' }}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>

            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              By signing up you agree to our{' '}
              <span onClick={() => setShowTerms(true)} style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer', textDecoration: 'underline' }}>
                Terms of Service
              </span>
              {' '}and{' '}
              <span onClick={() => setShowPrivacy(true)} style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer', textDecoration: 'underline' }}>
                Privacy Policy
              </span>
            </div>
          </>
        )}
      </div>

      {showPrivacy && <PrivacyPolicy onBack={() => setShowPrivacy(false)} />}
      {showTerms   && <TermsOfService onBack={() => setShowTerms(false)} />}
    </div>
  )
}
