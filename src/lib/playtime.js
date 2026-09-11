// Playing-time urgency, shared by every surface that colours a player by how
// many quarters they are down for. AYSO's everybody-plays rule is three
// quarters, so the scale is: under two → 'short', exactly two → 'near',
// three or more → 'ok'. Each surface maps these to its own palette.

export const MIN_QUARTERS = 3

export function playtimeLevel(totalPlanned) {
  if (totalPlanned >= MIN_QUARTERS)     return 'ok'
  if (totalPlanned >= MIN_QUARTERS - 1) return 'near'
  return 'short'
}
