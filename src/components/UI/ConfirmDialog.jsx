/**
 * In-app confirmation dialog.
 *
 * window.confirm() puts the page's origin in the title — "squadiq-coach.
 * vercel.app says", or "localhost:5173 says" in development — which is browser
 * chrome no script can change. Anything a coach sees mid-game should say
 * SquadIQ, so these live in the app instead.
 *
 * Props:
 *   icon          emoji shown in the badge
 *   title         short question
 *   message       node — the explanation
 *   confirmLabel  text on the confirming button
 *   cancelLabel   text on the dismissing button (default "Cancel")
 *   tone          'accent' (default, cyan) | 'danger' | 'brand'
 *   onConfirm / onCancel
 */
const TONES = {
  accent: { line: 'rgba(0,184,212,0.35)', soft: 'rgba(0,184,212,0.12)', solid: '#00b8d4', text: '#04222a' },
  danger: { line: 'rgba(220,50,50,0.3)',  soft: 'rgba(220,50,50,0.1)',  solid: '#A32D2D', text: '#ffffff' },
  brand:  { line: 'rgba(0,200,83,0.3)',   soft: 'rgba(0,200,83,0.1)',   solid: '#00c853', text: '#052711' },
}

export default function ConfirmDialog({
  icon = '?', title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'accent', onConfirm, onCancel,
}) {
  const t = TONES[tone] || TONES.accent

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: '#1a1a2e', border: `1px solid ${t.line}`, borderRadius: 16,
          padding: 24, width: '100%', maxWidth: 340,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            background: t.soft, border: `1px solid ${t.line}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
          }}>
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
            }}>
              SquadIQ
            </div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, lineHeight: 1.25 }}>
              {title}
            </div>
          </div>
        </div>

        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6 }}>
          {message}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10,
              padding: 12, color: '#fff', fontSize: 14, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, background: t.solid, border: 'none', borderRadius: 10,
              padding: 12, color: t.text, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
