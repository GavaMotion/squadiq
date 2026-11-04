// Playing-time rule, shared by every surface that colours a player by how
// many quarters they are down for. The app enforces only the team's rule —
// the coach is free to play strong players more. Colours describe the amount
// played; only 'below' is a warning.
//
//   'half'  (default) AYSO national minimum: half the game, two quarters.
//   'three' three quarters, but never more than the roster can give everyone.

export const PLAYTIME_RULES = ['half', 'three']

export function teamRule(team) {
  return team?.playtime_rule === 'three' ? 'three' : 'half'
}

// How many quarters a kid must play. A kid OUT for any quarter (late, leaving
// early) needs half the game and never more quarters than they are there.
// roomShare = the most quarters every present kid can get from the roster
// (field spots ÷ kids), so 'three' never asks for the impossible.
export function targetQuarters(outCount = 0, rule = 'half', roomShare = 4) {
  const half = Math.max(0, Math.min(2, 4 - outCount))
  if (outCount > 0 || rule !== 'three') return half
  return Math.max(half, Math.min(3, roomShare))
}

// 'below' = under the rule (red). Otherwise the amount: half / three / all.
export function playtimeLevel(totalPlanned, target = 2) {
  if (totalPlanned < target) return 'below'
  if (totalPlanned >= 4) return 'all'
  if (totalPlanned >= 3) return 'three'
  return 'half'
}

export const PLAYTIME_COLORS = {
  below: '#ef4444',
  half:  '#22d3ee',
  three: '#00c853',
  all:   '#00c853',  // same outline as three; the card fill is lighter instead
}
