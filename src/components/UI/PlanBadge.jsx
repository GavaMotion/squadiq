import { useApp } from '../../contexts/AppContext'

// Which plans earn a badge. Solo pays too, but the badge exists to make the
// top tier feel special — so solo (and anything unknown) shows nothing.
function planTier(subscription) {
  if (!subscription) return null
  if (subscription.plan_override === 'unlimited') return 'premium'
  if (subscription.plan === 'premium' || subscription.plan === 'multi') return 'premium'
  if (subscription.plan === 'trial') return 'trial'
  return null
}

/**
 * The plan badge that sits next to the team name.
 *
 * size="sm" is the header pill; size="lg" is the one on the team banner in
 * My Team, which is deliberately louder — that page is where a coach looks
 * when they wonder what they are paying for.
 */
export default function PlanBadge({ size = 'sm', style }) {
  const { subscription, daysLeftInTrial } = useApp()
  const tier = planTier(subscription)
  if (!tier) return null

  const lg      = size === 'lg'
  const premium = tier === 'premium'

  const label = premium
    ? 'Premium'
    : lg && daysLeftInTrial !== null
      ? `Trial · ${daysLeftInTrial} day${daysLeftInTrial === 1 ? '' : 's'} left`
      : 'Trial'

  const palette = premium
    ? {
        background: 'linear-gradient(135deg, #f7d774 0%, #e0a32e 55%, #f2c75c 100%)',
        color:      '#3b2a05',
        border:     '1px solid rgba(255,255,255,0.35)',
        boxShadow:  lg ? '0 2px 10px rgba(224,163,46,0.45)' : '0 1px 4px rgba(224,163,46,0.35)',
      }
    : {
        background: 'rgba(255,255,255,0.12)',
        color:      'rgba(255,255,255,0.82)',
        border:     '1px solid rgba(255,255,255,0.28)',
        boxShadow:  'none',
      }

  return (
    <span
      title={premium ? 'Premium account' : 'Trial account'}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            lg ? 5 : 3,
        flexShrink:     0,
        padding:        lg ? '4px 11px' : '2px 7px',
        borderRadius:   999,
        fontSize:       lg ? 12 : 9.5,
        fontWeight:     800,
        letterSpacing:  '0.06em',
        textTransform:  'uppercase',
        lineHeight:     1.2,
        whiteSpace:     'nowrap',
        userSelect:     'none',
        ...palette,
        ...style,
      }}
    >
      {premium && (
        <svg width={lg ? 12 : 9} height={lg ? 12 : 9} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M12 2.6l2.65 5.85 6.35.72-4.72 4.3 1.28 6.28L12 16.6l-5.56 3.15 1.28-6.28L3 9.17l6.35-.72L12 2.6z" />
        </svg>
      )}
      {label}
    </span>
  )
}
