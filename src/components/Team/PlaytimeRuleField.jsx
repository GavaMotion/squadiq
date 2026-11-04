// Minimum playing time the lineup is checked against. Regions differ, so the
// coach picks; the app never asks for more than the roster can give.
const OPTIONS = [
  { value: 'half',  label: 'Half the game', sub: '2 of 4 quarters',
    help: 'Every kid must play at least 2 quarters. This is the AYSO minimum.' },
  { value: 'three', label: '3 quarters',    sub: '3 of 4 quarters',
    help: 'Every kid should play 3 quarters. If you have too many kids for everyone to get 3, SquadIQ asks only for what fits. Kids who arrive late or leave early only need 2.' },
]

export default function PlaytimeRuleField({ value, onChange, labelClassName }) {
  const current = value === 'three' ? 'three' : 'half'
  return (
    <div>
      <label className={labelClassName}>Playing-time rule</label>
      <p className="text-xs text-gray-400" style={{ margin: '-2px 0 8px', lineHeight: 1.45 }}>
        The least each kid must play in a game. Auto-fill follows it, and on the Lineup screen
        a kid below it turns <span style={{ color: '#ef4444', fontWeight: 600 }}>red</span> so you can fix it before kick-off.
      </p>
      <div role="radiogroup" aria-label="Playing-time rule" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {OPTIONS.map(o => {
          const selected = o.value === current
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.value)}
              className="rounded-lg text-sm font-semibold transition"
              style={{
                padding: '8px 4px', lineHeight: 1.2,
                background: selected ? 'var(--team-primary, #1a5c2e)' : '#1f2937',
                color: selected ? 'var(--team-primary-text, #fff)' : '#d1d5db',
                border: selected ? '1px solid transparent' : '1px solid #374151',
              }}
            >
              {o.label}
              <span style={{ display: 'block', fontSize: 11, fontWeight: 500, opacity: 0.75, marginTop: 2 }}>{o.sub}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 mt-2" style={{ lineHeight: 1.45 }}>{OPTIONS.find(o => o.value === current).help}</p>
      <p className="text-xs text-gray-500 mt-1" style={{ lineHeight: 1.45 }}>
        Not sure? Most AYSO regions use half the game. Check your region's rules.
      </p>
    </div>
  )
}
