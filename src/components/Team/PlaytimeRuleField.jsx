import { useState } from 'react'

// Minimum playing time the lineup is checked against. Leagues differ, so the
// coach picks (no league is named in the UI). The explanation sits behind a
// "?" so the setting itself stays two words.
const OPTIONS = [
  { value: 'half',  label: 'Half the game', sub: '2 of 4 quarters' },
  { value: 'three', label: '3 quarters',    sub: '3 of 4 quarters' },
]

export default function PlaytimeRuleField({ value, onChange, labelClassName }) {
  const current = value === 'three' ? 'three' : 'half'
  const [help, setHelp] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label className={labelClassName} style={{ marginBottom: 0 }}>Playing-time rule</label>
        <button
          type="button"
          onClick={() => setHelp(h => !h)}
          aria-expanded={help}
          aria-label="What is the playing-time rule?"
          style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
            background: help ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
            fontSize: 12, fontWeight: 700, lineHeight: '24px', padding: 0,
          }}
        >?</button>
      </div>
      {help && (
        <p className="text-xs text-gray-300" style={{ margin: '6px 0 0', lineHeight: 1.45 }}>
          The least each kid plays in a game. Auto-fill follows it, and a kid below it
          turns <span style={{ color: '#ef4444', fontWeight: 600 }}>red</span> on Lineup.
        </p>
      )}
      <div role="radiogroup" aria-label="Playing-time rule" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
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
    </div>
  )
}
