// Playing-time urgency, shared by every surface that colours a player by how
// many quarters they are down for. AYSO's everybody-plays rule is three
// quarters, so the scale is: under two → 'short', exactly two → 'near',
// three or more → 'ok'. Each surface maps these to its own palette.

export const MIN_QUARTERS = 3

// A kid who is OUT for any quarter (late, leaving early) only needs half the
// game — two quarters — and never more quarters than they are actually there.
export function targetQuarters(outCount = 0) {
  if (outCount <= 0) return MIN_QUARTERS
  return Math.max(0, Math.min(2, 4 - outCount))
}

export function playtimeLevel(totalPlanned, target = MIN_QUARTERS) {
  if (totalPlanned >= target)     return 'ok'
  if (totalPlanned >= target - 1) return 'near'
  return 'short'
}
