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

function scorePlayerForSlot(player, slotLabel) {
  const ratings   = player.position_ratings || {}
  const positions = player.positions || []
  const compat    = SLOT_COMPAT[slotLabel] || [slotLabel]

  for (let i = 0; i < compat.length; i++) {
    const pos = compat[i]
    if (positions.includes(pos)) {
      const rating = ratings[pos] ?? 3
      return rating * 10 - i * 5 // penalty for each step away from primary
    }
  }
  return 1 // can play but no position match
}

export function generateAILineup({ players, absentPlayerIds, formation, quarters = [1, 2, 3, 4] }) {
  const available = players.filter(p => !absentPlayerIds.has(p.id))
  const slots = formation.slots || []

  const quarterCount = {}
  available.forEach(p => { quarterCount[p.id] = 0 })

  const result = {}

  function generateQuarterLineup(quarterNum) {
    const assignment = {}
    const usedIds    = new Set()

    // GK first, then rest
    const sortedSlots = [...slots].sort((a, b) => {
      if (a.label === 'GK') return -1
      if (b.label === 'GK') return 1
      return 0
    })

    // Players who need minutes most go first in candidate list
    const candidates = [...available].sort((a, b) => {
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
      if (quarterCount[p.id] < 3) {
        warnings.push(`${p.name.split(' ')[0]} only plays ${quarterCount[p.id]} quarter(s)`)
      }
    })
  }

  return { lineup: result, quarterCount, warnings }
}
