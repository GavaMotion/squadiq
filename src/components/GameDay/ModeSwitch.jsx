import theme from '../../theme'

/**
 * Quarters ⇄ Free subs. This is not a button you press to do something — it
 * is the label that says which set of rules the plan is playing under, so it
 * reads as a heading and shows both options at once.
 *
 * Props:
 *   mode      'quarters' | 'free'
 *   onChange  (mode) => void
 *   compact   bool — phone sizing
 */
export default function ModeSwitch({ mode, onChange, compact }) {
  const isFree = mode === 'free'

  const seg = (active, accent, dark) => ({
    padding:       compact ? '4px 9px' : '5px 12px',
    borderRadius:  999,
    border:        'none',
    cursor:        active ? 'default' : 'pointer',
    fontFamily:    'inherit',
    fontSize:      compact ? 9 : 10,
    fontWeight:    800,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    whiteSpace:    'nowrap',
    background:    active ? accent : 'transparent',
    color:         active ? dark : 'rgba(255,255,255,0.45)',
    boxShadow:     active ? `0 2px 10px ${isFree ? theme.freeAccentGlow : 'rgba(0,200,83,0.28)'}` : 'none',
    transition:    'background 0.14s, color 0.14s',
  })

  return (
    <div
      role="group"
      aria-label="Planning mode"
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          2,
        flexShrink:   0,
        padding:      2,
        borderRadius: 999,
        background:   'rgba(0,0,0,0.35)',
        border:       `1px solid ${isFree ? theme.freeAccentDim : 'rgba(255,255,255,0.09)'}`,
      }}
    >
      <button
        onClick={() => !isFree || onChange('quarters')}
        aria-pressed={!isFree}
        style={seg(!isFree, theme.brandGreen, '#052711')}
        onMouseEnter={e => { if (isFree) e.currentTarget.style.color = '#ffffff' }}
        onMouseLeave={e => { if (isFree) e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
      >
        Quarters
      </button>
      <button
        onClick={() => isFree || onChange('free')}
        aria-pressed={isFree}
        style={seg(isFree, theme.freeAccent, '#04222a')}
        onMouseEnter={e => { if (!isFree) e.currentTarget.style.color = '#ffffff' }}
        onMouseLeave={e => { if (!isFree) e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
      >
        Free subs
      </button>
    </div>
  )
}
