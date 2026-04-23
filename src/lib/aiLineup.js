// Maps formation slot labels → player position IDs (ordered by preference)
const SLOT_COMPAT = {
  GK:  ['GK'],
  DEF: ['CB', 'RB/LB'],
  CB:  ['CB', 'RB/LB'],
  RB:  ['RB/LB', 'CB'],
  LB:  ['RB/LB', 'CB'],
  SW:  ['CB', 'RB/LB'],
  CDM: ['CDM', 'CM'],
  DM:  ['CDM', 'CM'],
  MID: ['CM', 'CDM', 'CAM', 'RM/LM'],
  CM:  ['CM', 'CDM', 'CAM', 'RM/LM'],
  CAM: ['CAM', 'CM', 'RM/LM', 'RW/LW'],
  AM:  ['CAM', 'CM'],
  RM:  ['RM/LM', 'CM', 'RW/LW'],
  LM:  ['RM/LM', 'CM', 'RW/LW'],
  RW:  ['RW/LW', 'RM/LM', 'ST'],
  LW:  ['RW/LW', 'RM/LM', 'ST'],
  FWD: ['ST', 'RW/LW', 'CAM'],
  ST:  ['ST', 'RW/LW', 'CAM'],
  SS:  ['ST', 'RW/LW'],
  CF:  ['ST', 'CAM', 'RW/LW'],
}

function getEffectiveRating(player, slotLabel) {
  const ratings   = player.position_ratings || {}
  const positions = player.positions || []
  const compat    = SLOT_COMPAT[slotLabel] || [slotLabel]

  for (let i = 0; i < compat.length; i++) {
    const pos = compat[i]
    if (positions.includes(pos)) {
      if (ratings[pos] !== undefined && ratings[pos] > 0) {
        // Use actual rating, slightly penalised for non-primary slot
        return i === 0 ? ratings[pos] : ratings[pos] * 0.7
      }
      // Player plays this position but no rating — random estimate
      return i === 0
        ? Math.floor(Math.random() * 3) + 1  // 1–3 for primary
        : Math.floor(Math.random() * 2) + 1  // 1–2 for compatible
    }
  }
  return 0.5 // can play but not their position
}

function scorePlayerForSlot(player, slotLabel) {
  return getEffectiveRating(player, slotLabel) * 10
}

export function generateAILineup({
  players,
  absentPlayerIds,
  absentQuarters = {},   // { playerId: [1, 3] } — absent in specific quarters
  formation,
  quarters = [1, 2, 3, 4],
}) {
  const available = players.filter(p => !absentPlayerIds.has(p.id))
  const slots = formation.slots || []

  const quarterCount = {}
  available.forEach(p => { quarterCount[p.id] = 0 })

  const result = {}

  function generateQuarterLineup(quarterNum) {
    const assignment = {}
    const usedIds    = new Set()

    // Filter out players absent this specific quarter
    const quarterAvailable = available.filter(p => {
      const restricted = absentQuarters[p.id] || []
      return !restricted.includes(quarterNum)
    })

    // GK first, then rest
    const sortedSlots = [...slots].sort((a, b) => {
      if (a.label === 'GK') return -1
      if (b.label === 'GK') return 1
      return 0
    })

    // Players who need minutes most go first
    const candidates = [...quarterAvailable].sort((a, b) => {
      const aNeed = Math.max(0, 3 - quarterCount[a.id])
      const bNeed = Math.max(0, 3 - quarterCount[b.id])
      return bNeed - aNeed
    })

    for (const slot of sortedSlots) {
      let bestPlayer = null
      let bestScore  = -Infinity

      for (const player of candidates) {
        if (usedIds.has(player.id)) continue
        if (quarterCount[player.id] >= 4) continue

        const posScore    = scorePlayerForSlot(player, slot.label)
        const minuteBonus = Math.max(0, 3 - quarterCount[player.id]) * 15
        const total       = posScore + minuteBonus

        if (total > bestScore) {
          bestScore  = total
          bestPlayer = player
        }
      }

      if (bestPlayer) {
        assignment[slot.id] = bestPlayer.id
        usedIds.add(bestPlayer.id)
      }
    }

    return assignment
  }

  for (const q of quarters) {
    const qAssignment = generateQuarterLineup(q)
    Object.values(qAssignment).forEach(pid => {
      if (pid && quarterCount[pid] !== undefined) quarterCount[pid]++
    })
    result[q] = qAssignment
  }

  const warnings = []
  if (quarters.length === 4) {
    available.forEach(p => {
      const restricted = Object.values(absentQuarters[p.id] || []).length
      if (quarterCount[p.id] < 3 && restricted < 2) {
        warnings.push(`${p.name.split(' ')[0]} only plays ${quarterCount[p.id]} quarter(s)`)
      }
    })
  }

  return { lineup: result, quarterCount, warnings }
}
