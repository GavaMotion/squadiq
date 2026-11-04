// Plain-language names for the short position codes on the field.
// The field circles keep the codes (no room for words); every sentence,
// list and roster chip uses these names so a new coach never has to decode
// "RB" or "CDM".
const NAMES = {
  GK: 'Goalkeeper',
  CB: 'Center back', RB: 'Right back', LB: 'Left back', D: 'Defender',
  'RB/LB': 'Right/left back',
  CDM: 'Defensive mid', CM: 'Center mid', CAM: 'Attacking mid',
  RM: 'Right mid', LM: 'Left mid', 'RM/LM': 'Right/left mid',
  RW: 'Right wing', LW: 'Left wing', 'RW/LW': 'Right/left wing',
  ST: 'Striker', PV: 'Forward', LF: 'Left forward', RF: 'Right forward',
  // Legacy values still stored on some players
  DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward',
}

export function positionName(code) {
  return NAMES[code] || code || ''
}

// "Right back (RB)" — the code stays so the coach can match it to the circle.
export function positionWithCode(code) {
  const n = NAMES[code]
  return n ? `${n} (${code})` : (code || '')
}

// ['RM/LM','ST'] → "right/left mid or striker"
export function positionList(codes) {
  const names = (codes || []).map(c => positionName(c).toLowerCase()).filter(Boolean)
  if (names.length <= 1) return names[0] || ''
  return names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1]
}
