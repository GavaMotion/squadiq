import { useState, useEffect, useMemo, useCallback } from 'react'
import qrcode from 'qrcode-generator'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../UI/Toast'

// ── QR ────────────────────────────────────────────────────────────
// Drawn as its own SVG rather than an image service: a coach holding this up
// at a field has no signal, and the code should not need one.
function QrCode({ value, size = 168 }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const count = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
      }
    }
    return { d, count }
  }, [value])

  return (
    // The white border is the QR "quiet zone" — the spec wants 4 modules of it
    // and scanners get unreliable without it, so keep it generous.
    <div style={{ background: '#fff', padding: 20, borderRadius: 12, lineHeight: 0 }}>
      <svg
        width={size} height={size}
        viewBox={`0 0 ${path.count} ${path.count}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label="Invite QR code"
      >
        <path d={path.d} fill="#000" />
      </svg>
    </div>
  )
}

// ── Confirm sheet ─────────────────────────────────────────────────
// In-app rather than window.confirm: the browser dialog shows the raw URL and
// looks like a phishing prompt on a phone.
function ConfirmSheet({ title, body, confirmLabel, danger, onConfirm, onCancel, busy }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel, #1a1a2e)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16, padding: 20, width: '100%', maxWidth: 380,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6 }}>{body}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.15)', background: 'none',
              color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1, padding: '11px', borderRadius: 10, border: 'none',
              background: danger ? '#E24B4A' : '#00c853',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Assistant coaches ─────────────────────────────────────────────
export default function TeamSharing({ team }) {
  const {
    teamRole, maxAssistants,
    loadTeamSharing, rotateTeamInvite, removeTeamMember, promoteTeamMember,
  } = useApp()
  const { addToast } = useToast()

  const [invite,  setInvite]  = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState(false)
  const [confirm, setConfirm] = useState(null)   // { kind, member }
  const [showQr,  setShowQr]  = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const isOwner = teamRole(team) === 'owner'

  const refresh = useCallback(async () => {
    if (!team?.id) return
    setLoading(true)
    const { invite: inv, members: mem, error } = await loadTeamSharing(team.id)
    setLoading(false)
    if (error) {
      // Do not fall through to the "no code yet" state on a failed load. The
      // obvious next tap there mints a code, which revokes the one already
      // circulating in the team's group chat.
      setLoadFailed(true)
      return
    }
    setLoadFailed(false)
    setInvite(inv)
    setMembers(mem)
  }, [team?.id, loadTeamSharing])

  useEffect(() => { if (isOwner) refresh() }, [isOwner, refresh])

  if (!team?.id || !isOwner) return null

  const joinUrl = invite
    ? `${window.location.origin}/?join=${invite.code}`
    : ''

  const seatsUsed = members.length
  const unlimited = maxAssistants >= 99
  const full = !unlimited && seatsUsed >= maxAssistants
  const expired = !!invite && new Date(invite.expires_at) < new Date()

  async function createCode() {
    setBusy(true)
    const res = await rotateTeamInvite(team.id, false)
    setBusy(false)
    if (!res?.ok) { addToast(res?.error === 'not_owner' ? 'Only the head coach can do that' : 'Could not create a code', 'error'); return }
    await refresh()
  }

  async function doRenew() {
    setBusy(true)
    const res = await rotateTeamInvite(team.id, false)
    setBusy(false)
    setConfirm(null)
    if (!res?.ok) { addToast('Could not create a new code', 'error'); return }
    await refresh()
    addToast('New code created — your assistants keep their access', 'success', 4000)
  }

  async function doReset() {
    setBusy(true)
    const res = await rotateTeamInvite(team.id, true)
    setBusy(false)
    setConfirm(null)
    if (!res?.ok) { addToast('Could not reset the code', 'error'); return }
    await refresh()
    addToast(
      res.removed > 0
        ? `New code created — ${res.removed} assistant${res.removed === 1 ? '' : 's'} removed`
        : 'New code created — the old one no longer works',
      'success', 4000,
    )
  }

  async function doRemove(member) {
    setBusy(true)
    const res = await removeTeamMember(member.id)
    setBusy(false)
    setConfirm(null)
    if (!res.ok) {
      addToast(res.error === 'nothing_removed'
        ? 'Could not remove that assistant — reload and try again'
        : 'Could not remove that assistant', 'error')
      await refresh()
      return
    }
    await refresh()
    addToast('Assistant removed', 'success', 2500)
  }

  async function makeActive(member) {
    const res = await promoteTeamMember(member.id)
    if (!res?.ok) { addToast('Could not change seats', 'error'); return }
    await refresh()
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      addToast('Invite link copied', 'success', 2000)
    } catch {
      addToast('Could not copy — press and hold the code to select it', 'warning', 3000)
    }
  }

  async function shareCode() {
    const text = `Join ${team.name} on SquadIQ as an assistant coach: ${joinUrl}`
    if (navigator.share) {
      try { await navigator.share({ title: 'SquadIQ', text, url: joinUrl }) } catch { /* dismissed */ }
    } else {
      copyCode()
    }
  }

  const btn = (extra = {}) => ({
    padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    ...extra,
  })

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 className="text-lg font-bold text-white">Assistant coaches</h3>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          {/* 99 is the internal stand-in for "no limit" — never show it as a
              seat count. Over the limit reads "3 of 3 seats · 1 dormant",
              never "4 of 3". */}
          {unlimited
            ? `${seatsUsed} assistant${seatsUsed === 1 ? '' : 's'}`
            : `${Math.min(seatsUsed, maxAssistants)} of ${maxAssistants} ${maxAssistants === 1 ? 'seat' : 'seats'}`}
          {!unlimited && seatsUsed > maxAssistants && ` · ${seatsUsed - maxAssistants} dormant`}
        </span>
      </div>

      <div style={{
        background: 'var(--bg-panel, #1a1a2e)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
          An assistant can run the lineup, edit the roster and plan practices.
          They can&apos;t change billing, rename or delete the team, or invite anyone else.
        </p>

        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Loading…</div>
        ) : loadFailed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#f4a13b', fontSize: 12, lineHeight: 1.6 }}>
              Couldn&apos;t load your assistant coaches just now. Your invite code
              is untouched — try again when you have a connection.
            </div>
            <button onClick={refresh} style={btn({ justifyContent: 'center' })}>Try again</button>
          </div>
        ) : maxAssistants === 0 ? (
          <div style={{ color: '#f4a13b', fontSize: 12, lineHeight: 1.6 }}>
            Your plan has ended, so assistant access is paused. Your assistants are
            still here — they get access back the moment you subscribe again.
          </div>
        ) : !invite ? (
          <button onClick={createCode} disabled={busy} style={btn({ background: '#00c853', border: 'none', color: '#fff', justifyContent: 'center' })}>
            {busy ? 'Creating…' : 'Create an invite code'}
          </button>
        ) : expired ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <div style={{
              fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
              fontSize: 22, fontWeight: 700, letterSpacing: 4,
              color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through',
            }}>
              {invite.code}
            </div>
            <div style={{ color: '#f4a13b', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
              This code expired on {new Date(invite.expires_at).toLocaleDateString()}.
              {members.length > 0 && ' Your assistants still have access.'}
            </div>
            <button
              onClick={doRenew}
              disabled={busy}
              style={btn({ background: '#00c853', border: 'none', color: '#fff', justifyContent: 'center' })}
            >
              {busy ? 'Creating…' : 'Get a new code'}
            </button>
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              padding: '14px 0 4px',
            }}>
              {showQr && <QrCode value={joinUrl} />}
              <div style={{
                fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                fontSize: 26, fontWeight: 700, letterSpacing: 4,
                color: '#fff',
              }}>
                {invite.code}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                Expires {new Date(invite.expires_at).toLocaleDateString()}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => setShowQr(v => !v)} style={btn()}>
                {showQr ? 'Hide QR' : 'Show QR'}
              </button>
              <button onClick={copyCode} style={btn()}>Copy link</button>
              <button onClick={shareCode} style={btn()}>Share</button>
              <button onClick={() => setConfirm({ kind: 'renew' })} style={btn()}>New code</button>
              <button
                onClick={() => setConfirm({ kind: 'reset' })}
                style={btn({ border: '1px solid rgba(226,75,74,0.4)', color: '#fca5a5' })}
              >
                Reset &amp; remove
              </button>
            </div>

            {full && (
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center' }}>
                All seats are taken — the code won&apos;t let anyone else in until you remove someone.
              </div>
            )}
          </>
        )}

        {members.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
            {members.map((m, i) => {
              const dormant = i >= maxAssistants
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, padding: '10px 12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: dormant ? 'rgba(255,255,255,0.45)' : '#fff',
                      fontSize: 13, fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {m.display_name || m.user_email || 'Assistant coach'}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                      {dormant
                        ? 'Dormant — no seat on your plan'
                        : m.last_seen_at
                          ? `Last used ${new Date(m.last_seen_at).toLocaleDateString()}`
                          : `Joined ${new Date(m.joined_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  {dormant && maxAssistants > 0 && (
                    <button onClick={() => makeActive(m)} style={btn({ padding: '6px 10px', fontSize: 11 })}>
                      Make active
                    </button>
                  )}
                  <button
                    onClick={() => setConfirm({ kind: 'remove', member: m })}
                    style={btn({ padding: '6px 10px', fontSize: 11, border: '1px solid rgba(226,75,74,0.4)', color: '#fca5a5' })}
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirm?.kind === 'renew' && (
        <ConfirmSheet
          title="Create a new code?"
          body={
            members.length > 0
              ? `The old code stops working, so anyone still holding it can't join. Your ${members.length} current assistant${members.length === 1 ? '' : 's'} keep${members.length === 1 ? 's' : ''} access.`
              : 'The old code stops working, so anyone you already sent it to will need the new one.'
          }
          confirmLabel="New code"
          busy={busy}
          onConfirm={doRenew}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm?.kind === 'reset' && (
        <ConfirmSheet
          title="Reset and remove everyone?"
          body={
            members.length > 0
              ? `A new code is created and the old one stops working. Everyone who joined with the old code — ${members.length} assistant${members.length === 1 ? '' : 's'} — loses access to ${team.name} straight away. Use this if the code got out.`
              : 'A new code is created and the old one stops working. Anyone you already sent it to will not be able to join.'
          }
          confirmLabel="Reset & remove"
          danger
          busy={busy}
          onConfirm={doReset}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm?.kind === 'remove' && (
        <ConfirmSheet
          title="Remove this assistant?"
          body={`${confirm.member.display_name || confirm.member.user_email || 'This assistant'} loses access to ${team.name} straight away. Nothing they added is deleted, and you can invite them again with the same code.`}
          confirmLabel="Remove"
          danger
          busy={busy}
          onConfirm={() => doRemove(confirm.member)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
