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

const LABEL_ORDER = ['GK', 'CB', 'RB', 'LB', 'RB/LB', 'SW', 'CDM', 'DM', 'CM', 'CAM', 'AM', 'RM', 'LM', 'RM/LM', 'RW', 'LW', 'RW/LW', 'ST', 'SS', 'CF', 'DEF', 'MID', 'FWD']

export function generateAILineup({
  players,
  absentPlayerIds = new Set(),
  absentQuarters  = {},
  formation,
  quarters        = [1, 2, 3, 4],
}) {
  const slots        = formation.slots || []
  const allAvailable = players.filter(p => !absentPlayerIds.has(p.id))

  const sortedSlots = [...slots].sort((a, b) => {
    const ai = LABEL_ORDER.indexOf(a.label)
    const bi = LABEL_ORDER.indexOf(b.label)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  const quarterCount = {}
  allAvailable.forEach(p => { quarterCount[p.id] = 0 })

  const lineup        = {}
  const outOfPosition = []
  const warnings      = []

  for (const q of quarters) {
    const available = allAvailable.filter(p => {
      const restricted = absentQuarters[p.id] || []
      return !restricted.includes(q)
    })

    const assignment = {}
    const usedIds    = new Set()

    // PASS 1 — assign players who match the slot label
    for (const slot of sortedSlots) {
      let best      = null
      let bestScore = -Infinity

      for (const p of available) {
        if (usedIds.has(p.id)) continue
        const rating = getRating(p, slot.label)
        if (rating <= 0) continue
        const minuteBonus = Math.max(0, MIN_QUARTERS - quarterCount[p.id]) * 2
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
