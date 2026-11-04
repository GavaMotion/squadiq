// Minimum playing time the lineup is checked against. Regions differ, so the
// coach picks; the app never asks for more than the roster can give.
const OPTIONS = [
  { value: 'half',  label: 'Half the game',  help: 'AYSO minimum: every kid plays at least 2 quarters.' },
  { value: 'three', label: '3 quarters',     help: 'Every kid plays 3 quarters where the roster allows. Kids who are late or leave early need half.' },
]

export default function PlaytimeRuleField({ value, onChange, labelClassName }) {
  const current = value === 'three' ? 'three' : 'half'
  return (
    <div>
      <label className={labelClassName}>Playing-time rule</label>
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
                padding: '8px 0',
                background: selected ? 'var(--team-primary, #1a5c2e)' : '#1f2937',
                color: selected ? 'var(--team-primary-text, #fff)' : '#d1d5db',
                border: selected ? '1px solid transparent' : '1px solid #374151',
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 mt-1">{OPTIONS.find(o => o.value === current).help}</p>
    </div>
  )
}
