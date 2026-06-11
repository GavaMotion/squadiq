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
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

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
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        setLoading(false)
        return
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: 'https://squadiq-coach.vercel.app' },
      })
      setLoading(false)
      if (signUpError) { setError(signUpError.message); return }
      if (data?.user && !data.user.confirmed_at) {
        setConfirmPassword('')
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

  async function handleGoogleSignIn() {
    setError('')
    setGoogleLoading(true)
    // Redirect-based OAuth: the page navigates to Google and back to this origin.
    // Supabase's detectSessionInUrl picks up the session on return, which fires
    // onAuthStateChange in AuthContext and logs the user in — no extra handling needed.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setGoogleLoading(false)
    }
    // On success the browser leaves this page, so we intentionally leave the
    // button in its loading state until navigation happens.
  }

  async function handleResetPassword() {
    if (!resetEmail) { setResetError('Please enter your email address'); return }
    setResetError('')
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: 'https://squadiq-coach.vercel.app',
    })
    if (error) { setResetError(error.message) } else { setResetSent(true); addToast('Reset link sent — check your email', 'success') }
  }

  async function handleResendVerification() {
    if (resendCooldown > 0) return
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: 'https://squadiq-coach.vercel.app' },
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
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '32px 24px' }}>

      {/* Blurred background image */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/cover_V.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(12px)', transform: 'scale(1.1)', opacity: 0.4,
      }} />

      {/* Dark overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,26,0.75)' }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <img src="/icons/icon-192.png" alt="SquadIQ" style={{ width: 90, height: 90, borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Squad<span style={{ color: '#00c853' }}>IQ</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>The smart coaching companion</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(26,26,46,0.85)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '32px 28px',
          width: '100%', boxSizing: 'border-box',
        }}>

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
                color: resendCooldown > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.7)',
                fontSize: 13, cursor: resendCooldown > 0 ? 'default' : 'pointer',
              }}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation email'}
            </button>
            <span
              onClick={() => { setShowVerificationMessage(false); setEmail(''); setPassword(''); setError('') }}
              style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
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
              style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', textAlign: 'center', textDecoration: 'underline' }}
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

            {/* ── Continue with Google ── */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: '#fff', color: '#1f1f1f', border: 'none', borderRadius: 8,
                padding: '12px', fontSize: 14, fontWeight: 600,
                cursor: googleLoading || loading ? 'default' : 'pointer',
                opacity: googleLoading ? 0.7 : 1,
              }}
              onMouseEnter={e => !googleLoading && !loading && (e.currentTarget.style.background = '#f1f1f1')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {googleLoading ? 'Connecting…' : `${mode === 'login' ? 'Continue' : 'Sign up'} with Google`}
            </button>

            {/* ── Divider ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            </div>

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
                      style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Forgot password?
                    </span>
                  </div>
                )}
              </div>

              {mode === 'signup' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500 }}>
                    Confirm password
                  </label>
                  <input
                    type="password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    style={{
                      background: '#1a1a2e',
                      border: `1px solid ${
                        confirmPassword && confirmPassword !== password
                          ? 'rgba(220,50,50,0.6)'
                          : confirmPassword && confirmPassword === password
                            ? 'rgba(0,200,83,0.6)'
                            : 'rgba(255,255,255,0.15)'
                      }`,
                      borderRadius: 8,
                      padding: '12px 14px',
                      color: '#fff',
                      fontSize: 14,
                      width: '100%',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <div style={{ color: '#E24B4A', fontSize: 11, marginTop: 2 }}>
                      Passwords do not match
                    </div>
                  )}
                  {confirmPassword && confirmPassword === password && (
                    <div style={{ color: '#00c853', fontSize: 11, marginTop: 2 }}>
                      ✓ Passwords match
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (mode === 'signup' && confirmPassword !== password)}
                className="w-full py-2.5 rounded-lg font-semibold text-white transition-opacity"
                style={{
                  background: mode === 'signup' && confirmPassword !== password
                    ? 'rgba(0,200,83,0.4)'
                    : 'var(--color-green, #00c853)',
                  cursor: mode === 'signup' && confirmPassword !== password ? 'default' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
                onMouseEnter={e => !loading && !(mode === 'signup' && confirmPassword !== password) && (e.target.style.opacity = '0.85')}
                onMouseLeave={e => (e.target.style.opacity = loading ? '0.6' : '1')}
              >
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setConfirmPassword('') }}
                className="font-medium underline"
                style={{ color: 'var(--color-green, #00c853)' }}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>

            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
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
        </div>{/* end card */}
      </div>{/* end content */}

      {showPrivacy && <PrivacyPolicy onBack={() => setShowPrivacy(false)} />}
      {showTerms   && <TermsOfService onBack={() => setShowTerms(false)} />}
    </div>
  )
}
