import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

// Joining a team as an assistant coach.
//
// Deliberately self-contained — it talks to Supabase directly rather than
// through AppContext, because it has to work before any team data is loaded,
// from outside the provider, and while signed out entirely (a scanned QR lands
// on a cold app with no account at all).
//
// An assistant does not create an account. Signups here need email
// confirmation, which means leaving the app for an inbox — not something that
// happens ten minutes before kickoff. They sign in anonymously instead: a real,
// distinct, removable user with no paperwork. The lasting link to the head
// coach is the membership row on the server, not anything on the device.
export default function JoinTeamModal({ code: initialCode, signedIn = true, onClose, onJoined }) {
  const [code,    setCode]    = useState((initialCode || '').toUpperCase())
  const [name,    setName]    = useState('')
  const [preview, setPreview] = useState(null)
  const [error,   setError]   = useState('')
  const [busy,    setBusy]    = useState(false)
  const [checked, setChecked] = useState(false)

  const message = (key, fallback) => ({
    invalid:       'That code doesn’t match any team. Check it and try again.',
    revoked:       'That code has been reset by the head coach. Ask them for the new one.',
    expired:       'That code has expired. Ask the head coach for a fresh one.',
    full:          'This team has no assistant seats left. The head coach can free one up.',
    own_team:      'That’s your own team — you already have full access.',
    not_signed_in: 'Could not start your access. Try again.',
  }[key] || fallback)

  const check = useCallback(async (value) => {
    const clean = (value || '').trim().toUpperCase()
    if (!clean) return
    setBusy(true); setError('')
    const { data, error: rpcError } = await supabase.rpc('peek_team_invite', { invite_code: clean })
    setBusy(false); setChecked(true)
    if (rpcError) { setError('Could not check that code — are you online?'); return }
    if (!data?.ok) { setPreview(null); setError(message(data?.error, 'That code did not work.')); return }
    setPreview(data)
  }, [])

  // A scanned link should resolve on its own — no extra tap.
  useEffect(() => { if (initialCode) check(initialCode) }, [initialCode, check])

  async function join() {
    setBusy(true); setError('')

    if (!signedIn) {
      const { error: authError } = await supabase.auth.signInAnonymously()
      if (authError) {
        setBusy(false)
        // The one case a coach can actually act on is worth naming plainly.
        const disabled = /anonymous/i.test(authError.message || '')
        setError(disabled
          ? 'Assistant access isn’t switched on for this app yet. Ask the head coach to contact support.'
          : 'Could not start your access — are you online?')
        return
      }
    }

    const { data, error: rpcError } = await supabase.rpc('accept_team_invite', {
      invite_code: code.trim().toUpperCase(),
      joiner_name: name.trim() || null,
    })
    setBusy(false)
    if (rpcError) { setError('Could not join — are you online?'); return }
    if (!data?.ok) { setError(message(data?.error, 'Could not join that team.')); return }
    onJoined?.(data)
  }

  const label = { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }
  const field = {
    background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10, padding: '12px 14px', color: '#fff',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16, padding: 22, width: '100%', maxWidth: 380,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>
          {preview ? 'Join a team' : 'Assistant coach invite'}
        </div>

        {preview ? (
          <>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6 }}>
              You&apos;ve been invited to help coach:
            </div>
            <div style={{
              background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.3)',
              borderRadius: 12, padding: 14,
            }}>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{preview.team_name}</div>
              {preview.division && (
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
                  {preview.division}
                </div>
              )}
            </div>

            {!signedIn && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={label}>YOUR NAME</span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && join()}
                  placeholder="So the head coach knows it's you"
                  style={{ ...field, fontSize: 14 }}
                />
              </div>
            )}

            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.6 }}>
              {signedIn
                ? 'As an assistant you can run the lineup, edit the roster and plan practices. Billing and the team itself stay with the head coach.'
                : 'No account or password needed — one tap and you’re in. You can run the lineup, edit the roster and plan practices; billing and the team stay with the head coach.'}
            </div>
          </>
        ) : (
          <>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6 }}>
              Enter the invite code the head coach gave you.
            </div>
            <input
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); setChecked(false) }}
              onKeyDown={e => e.key === 'Enter' && check(code)}
              placeholder="ABCD2345"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              style={{
                ...field,
                fontSize: 20, fontWeight: 700, letterSpacing: 4, textAlign: 'center',
                fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
              }}
            />
          </>
        )}

        {error && (
          <div style={{
            color: '#fca5a5', fontSize: 12, lineHeight: 1.5,
            background: 'rgba(226,75,74,0.1)', borderRadius: 8, padding: '8px 10px',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.15)', background: 'none',
              color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {preview ? 'Not now' : 'Cancel'}
          </button>
          <button
            onClick={preview ? join : () => check(code)}
            disabled={busy || (!preview && !code.trim())}
            style={{
              flex: 1, padding: '12px', borderRadius: 10, border: 'none',
              background: '#00c853', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy || (!preview && !code.trim()) ? 0.5 : 1,
            }}
          >
            {busy ? '…' : preview ? (signedIn ? 'Join team' : 'Join as assistant') : checked ? 'Try again' : 'Continue'}
          </button>
        </div>

        {!signedIn && !preview && (
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
              fontSize: 11, textDecoration: 'underline', cursor: 'pointer', padding: 0,
            }}
          >
            I have a SquadIQ account — sign in instead
          </button>
        )}
      </div>
    </div>
  )
}
