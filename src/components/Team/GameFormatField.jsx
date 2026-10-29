import { GAME_FORMATS, DEFAULT_FORMAT_BY_DIVISION } from '../../lib/formations'

// Players-per-side picker. `value` is the team's override (null = play the
// division's standard format), so a team left on the standard follows the
// division if it is changed later.
export default function GameFormatField({ division, value, onChange, labelClassName }) {
  if (division === 'Futsal') return null
  const standard = DEFAULT_FORMAT_BY_DIVISION[division]
  const current  = value || standard

  return (
    <div>
      <label className={labelClassName}>Game Format</label>
      <div role="radiogroup" aria-label="Game format" style={{ display: 'grid', gridTemplateColumns: `repeat(${GAME_FORMATS.length}, 1fr)`, gap: 6 }}>
        {GAME_FORMATS.map(f => {
          const selected = f === current
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(f === standard ? null : f)}
              className="rounded-lg text-sm font-semibold transition"
              style={{
                padding: '8px 0',
                background: selected ? 'var(--team-primary, #1a5c2e)' : '#1f2937',
                color: selected ? 'var(--team-primary-text, #fff)' : '#d1d5db',
                border: selected ? '1px solid transparent' : '1px solid #374151',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {f}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {current === standard
          ? `Standard for ${division}.`
          : `${division} usually plays ${standard} — your league plays ${current}.`}
      </p>
    </div>
  )
}
