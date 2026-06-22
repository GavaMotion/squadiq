// Maps slot LABELS to compatible player position IDs in preference order.
// Player position IDs come from AddPlayerModal: GK, CB, RB/LB, CDM, CM, CAM, RM/LM, RW/LW, ST
const SLOT_COMPAT = {
  // Generic labels (8U, 10U divisions)
  GK:  ['GK'],
  DEF: ['CB', 'RB/LB', 'CDM'],
  MID: ['CM', 'CDM', 'CAM', 'RM/LM'],
  FWD: ['ST', 'RW/LW', 'CAM'],

  // Specific labels (12U+ divisions)
  CB:    ['CB', 'RB/LB'],
  RB:    ['RB/LB', 'CB'],
  LB:    ['RB/LB', 'CB'],
  'RB/LB': ['RB/LB', 'CB'],
  SW:    ['CB', 'RB/LB'],
  CDM:   ['CDM', 'CM', 'CB'],
  DM:    ['CDM', 'CM'],
  CM:    ['CM', 'CDM', 'CAM'],
  CAM:   ['CAM', 'CM', 'RM/LM', 'RW/LW'],
  AM:    ['CAM', 'CM'],
  RM:    ['RM/LM', 'RW/LW', 'CM'],
  LM:    ['RM/LM', 'RW/LW', 'CM'],
  'RM/LM': ['RM/LM', 'RW/LW', 'CM'],
  RW:    ['RW/LW', 'RM/LM', 'ST'],
  LW:    ['RW/LW', 'RM/LM', 'ST'],
  'RW/LW': ['RW/LW', 'RM/LM', 'ST'],
  ST:    ['ST', 'RW/LW', 'CAM'],
  SS:    ['ST', 'RW/LW'],
  CF:    ['ST', 'CAM', 'RW/LW'],

  // Futsal labels (Fixo / Ala / Pivô)
  D:  ['CB', 'RB/LB', 'CDM'],
  PV: ['ST', 'CAM', 'RW/LW'],
  LF: ['ST', 'RW/LW'],
  RF: ['ST', 'RW/LW'],
}

function getRating(player, slotLabel) {
  const ratings   = player.position_ratings || {}
  const positions = player.positions        || []
  const compat    = SLOT_COMPAT[slotLabel]  || []

  for (let i = 0; i < compat.length; i++) {
    const pos = compat[i]
    if (positions.includes(pos)) {
      const rating  = ratings[pos] > 0 ? ratings[pos] : (Math.floor(Math.random() * 3) + 1)
      const penalty = i === 0 ? 1 : 0.7
      return rating * penalty
    }
  }
  return 0 // no position match
}

const MIN_QUARTERS = 3

const LABEL_ORDER = ['GK', 'D', 'CB', 'RB', 'LB', 'RB/LB', 'SW', 'CDM', 'DM', 'CM', 'CAM', 'AM', 'RM', 'LM', 'RM/LM', 'RW', 'LW', 'RW/LW', 'PV', 'LF', 'RF', 'ST', 'SS', 'CF', 'DEF', 'MID', 'FWD']

export function generateAILineup({
  players,
  absentPlayerIds     = new Set(),
  absentQuarters      = {},
  formation,             // single shared formation (back-compat / single-quarter mode)
  formationsByQuarter,   // optional per-quarter formation map: { 1: f, 2: f, ... }
  quarters            = [1, 2, 3, 4],
}) {
  const allAvailable = players.filter(p => !absentPlayerIds.has(p.id))

  const quarterCount = {}
  allAvailable.forEach(p => { quarterCount[p.id] = 0 })

  // GK rotation — pre-assign GK per quarter, rotate if multiple GK players
  const gkCapable = allAvailable
    .filter(p => (p.positions || []).includes('GK'))
    .sort((a, b) => (b.position_ratings?.GK || 0) - (a.position_ratings?.GK || 0))

  const gkPerQuarter = {}
  if (gkCapable.length > 0) {
    quarters.forEach((q, i) => {
      gkPerQuarter[q] = gkCapable[i % gkCapable.length].id
    })
  }
  const lineup        = {}
  const outOfPosition = []
  const warnings      = []

  for (const q of quarters) {
    // Per-quarter formation (falls back to the shared one)
    const qFormation = formationsByQuarter?.[q] || formation
    if (!qFormation) {
      warnings.push(`Q${q}: no formation set`)
      lineup[q] = {}
      continue
    }
    const slots = qFormation.slots || []
    const sortedSlots = [...slots].sort((a, b) => {
      const ai = LABEL_ORDER.indexOf(a.label)
      const bi = LABEL_ORDER.indexOf(b.label)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

    // Quarters remaining INCLUDING this one — used for the hard rotation
    // constraint. A player whose deficit (MIN_QUARTERS − quartersPlayed) is
    // at least quartersLeft can no longer reach MIN_QUARTERS unless they
    // play every remaining quarter, so we mark them must-play.
    const quartersLeft = quarters.length - quarters.indexOf(q)

    const available = allAvailable.filter(p => {
      const restricted = absentQuarters[p.id] || []
      return !restricted.includes(q)
    })

    const assignment = {}
    const usedIds    = new Set()

    // Force GK assignment for this quarter before Pass 1
    if (gkPerQuarter[q]) {
      const gkSlot   = sortedSlots.find(s => s.label === 'GK')
      const gkPlayer = available.find(p => p.id === gkPerQuarter[q])
      if (gkSlot && gkPlayer && !usedIds.has(gkPlayer.id)) {
        assignment[gkSlot.id] = gkPlayer.id
        usedIds.add(gkPlayer.id)
      }
    }

    // PASS 1 — assign players who match the slot label
    for (const slot of sortedSlots) {
      if (assignment[slot.id]) continue // already assigned (e.g. GK above)

      let best      = null
      let bestScore = -Infinity

      for (const p of available) {
        if (usedIds.has(p.id)) continue
        const rating = getRating(p, slot.label)
        if (rating <= 0) continue
        const deficit  = MIN_QUARTERS - quarterCount[p.id]
        const mustPlay = deficit >= quartersLeft
        // Hard constraint: a forced player must beat any non-forced regardless
        // of skill rating. Soft pressure (×5, up from ×2) keeps un-played
        // players slightly favoured even before the hard constraint kicks in.
        const minuteBonus = mustPlay ? 10000 : Math.max(0, deficit) * 5
        const score = rating * 10 + minuteBonus
        if (score > bestScore) { bestScore = score; best = p }
      }

      if (best) {
        assignment[slot.id] = best.id
        usedIds.add(best.id)
      }
    }

    // PASS 2 — fill any still-empty slots with whoever is left
    for (const slot of sortedSlots) {
      if (assignment[slot.id]) continue

      const remaining = available
        .filter(p => !usedIds.has(p.id))
        .sort((a, b) => quarterCount[a.id] - quarterCount[b.id])

      if (remaining.length === 0) {
        warnings.push(`Q${q}: not enough players to fill ${slot.label}`)
        continue
      }

      const best = remaining[0]
      assignment[slot.id] = best.id
      usedIds.add(best.id)

      outOfPosition.push({
        playerId:     best.id,
        playerName:   best.name,
        jerseyNumber: best.jersey_number,
        slotLabel:    slot.label,
        quarter:      q,
      })
    }

    // Update quarter counts after filling this quarter
    Object.values(assignment).forEach(pid => {
      if (quarterCount[pid] !== undefined) quarterCount[pid]++
    })

    lineup[q] = assignment
  }

  // Warn about 3-quarter rule violations (all-4 mode only)
  if (quarters.length === 4) {
    allAvailable.forEach(p => {
      const restrictedCount = (absentQuarters[p.id] || []).length
      const maxPossible     = 4 - restrictedCount
      if (quarterCount[p.id] < Math.min(MIN_QUARTERS, maxPossible)) {
        warnings.push(`${p.name} only plays ${quarterCount[p.id]} quarter(s)`)
      }
    })
  }

  return { lineup, quarterCount, warnings, outOfPosition }
}
