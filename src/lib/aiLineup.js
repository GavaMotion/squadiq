import { targetQuarters } from './playtime.js'
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
      // Unrated → treat as average (2 of 1–3), not a dice roll, so the same
      // roster gives the same lineup every time.
      const rating  = ratings[pos] > 0 ? ratings[pos] : 2
      const penalty = i === 0 ? 1 : 0.7
      return rating * penalty
    }
  }
  return 0 // no position match
}

const LABEL_ORDER = ['GK', 'D', 'CB', 'RB', 'LB', 'RB/LB', 'SW', 'CDM', 'DM', 'CM', 'CAM', 'AM', 'RM', 'LM', 'RM/LM', 'RW', 'LW', 'RW/LW', 'PV', 'LF', 'RF', 'ST', 'SS', 'CF', 'DEF', 'MID', 'FWD']

export function generateAILineup({
  players,
  absentPlayerIds     = new Set(),
  absentQuarters      = {},
  formation,             // single shared formation (back-compat / single-quarter mode)
  formationsByQuarter,   // optional per-quarter formation map: { 1: f, 2: f, ... }
  quarters            = [1, 2, 3, 4],
  priorCounts         = {},  // quarters each kid already has in the OTHER quarters of the plan
}) {
  const allAvailable = players.filter(p => !absentPlayerIds.has(p.id))

  const quarterCount = {}
  // Start from what's already planned elsewhere, so generating one quarter
  // at a time rests a different group each time instead of the same kids.
  allAvailable.forEach(p => { quarterCount[p.id] = priorCounts[p.id] || 0 })

  // GK rotation — pre-assign GK per quarter, rotate if multiple GK players
  const gkCapable = allAvailable
    .filter(p => (p.positions || []).includes('GK'))
    .sort((a, b) => (b.position_ratings?.GK || 0) - (a.position_ratings?.GK || 0))

  // With two or more keepers they take turns. With only one, they keep goal
  // for the first half and the slot is opened up after that — otherwise the
  // same kid was in goal all four quarters and never got a field quarter.
  const gkPerQuarter = {}
  const gkBlocked    = {}   // quarter → player id who may not take GK that quarter
  if (gkCapable.length > 1) {
    quarters.forEach((q, i) => {
      gkPerQuarter[q] = gkCapable[i % gkCapable.length].id
    })
  } else if (gkCapable.length === 1) {
    const half = Math.ceil(quarters.length / 2)
    quarters.forEach((q, i) => {
      if (i < half) gkPerQuarter[q] = gkCapable[0].id
      else          gkBlocked[q]    = gkCapable[0].id
    })
  }

  // Fair target per kid: the 3-quarter rule, but never more than the kid can
  // play (OUT quarters) or than the field has room for. 12 kids in 7v7 have
  // 28 spots between them — 2 each — so asking all of them for 3 used to
  // make "must play" meaningless and let ratings decide.
  const chancesIn = (p, qs) => qs.filter(qq => !(absentQuarters[p.id] || []).includes(qq)).length
  const totalSpots = quarters.reduce((n, q) =>
    n + ((formationsByQuarter?.[q] || formation)?.slots?.length || 0), 0)
  const share = allAvailable.length ? Math.floor(totalSpots / allAvailable.length) : 0
  const fairTarget = {}
  allAvailable.forEach(p => {
    // OUT for any quarter of the game → half the game (2) is enough
    const need = targetQuarters((absentQuarters[p.id] || []).length)
    fairTarget[p.id] = Math.min(need, chancesIn(p, quarters), share)
  })
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

    const available = allAvailable.filter(p => {
      const restricted = absentQuarters[p.id] || []
      return !restricted.includes(q)
    })

    const assignment = {}
    const usedIds    = new Set()

    // ── STEP 1: decide WHO plays this quarter, fairness first ──────────────
    // Picking slot-by-slot on rating let the strongest kids take every
    // quarter while others sat on 1 (or 0). Now the playing group is chosen
    // first: a kid who will miss their fair target unless they play now goes
    // first, then whoever has played least, then whoever has fewer chances
    // left; skill only breaks ties. Positions are assigned afterwards.
    const gkSlot   = sortedSlots.find(s => s.label === 'GK')
    const gkId     = gkSlot && available.some(p => p.id === gkPerQuarter[q]) ? gkPerQuarter[q] : null
    const qsLeft   = quarters.slice(quarters.indexOf(q))
    const bestFit  = p => Math.max(0, ...sortedSlots.map(s => getRating(p, s.label)))
    const ranked = available
      .filter(p => p.id !== gkId)
      .map(p => {
        const chances = chancesIn(p, qsLeft)
        const deficit = fairTarget[p.id] - quarterCount[p.id]
        return { p, mustPlay: deficit > 0 && deficit >= chances, count: quarterCount[p.id], chances, fit: bestFit(p) }
      })
      .sort((a, b) =>
        (b.mustPlay - a.mustPlay) || (a.count - b.count) || (a.chances - b.chances) ||
        (b.fit - a.fit) || String(a.p.id).localeCompare(String(b.p.id)))
    const playing = ranked.slice(0, sortedSlots.length - (gkId ? 1 : 0)).map(r => r.p)

    // ── STEP 2: place the chosen group into positions ──────────────────────
    if (gkId) {
      assignment[gkSlot.id] = gkId
      usedIds.add(gkId)
    }

    // PASS 1 — put as many chosen players as possible in a position they
    // play (bipartite matching, best rating tried first). Filling slot by
    // slot greedily could hand a kid's only position to someone more
    // flexible and push them out of position for no reason.
    const openSlots = sortedSlots.filter(s => !assignment[s.id])
    const cands = {}
    for (const slot of openSlots) {
      cands[slot.id] = playing
        .filter(p => !usedIds.has(p.id))
        .filter(p => !(slot.label === 'GK' && gkBlocked[q] === p.id))
        .map(p => ({ p, r: getRating(p, slot.label) }))
        .filter(c => c.r > 0)
        .sort((a, b) => b.r - a.r)
        .map(c => c.p.id)
    }
    const slotOf = {}   // player id → slot id
    const tryPlace = (slotId, seen) => {
      for (const pid of cands[slotId]) {
        if (seen.has(pid)) continue
        seen.add(pid)
        if (!slotOf[pid] || tryPlace(slotOf[pid], seen)) { slotOf[pid] = slotId; return true }
      }
      return false
    }
    for (const slot of openSlots) tryPlace(slot.id, new Set())
    for (const [pid, sid] of Object.entries(slotOf)) {
      const p = playing.find(pp => String(pp.id) === pid)
      assignment[sid] = p.id
      usedIds.add(p.id)
    }

    // PASS 2 — fill any still-empty slots with the rest of the chosen group.
    // Field slots go first and GK last, so a keeper who is resting from goal
    // this quarter lands in a field spot rather than being left out.
    // Exception: if there are fewer kids left than empty slots, someone has to
    // stay empty — make that a field spot, never the goal.
    const emptyNow   = sortedSlots.filter(s => !assignment[s.id]).length
    const leftNow    = playing.filter(p => !usedIds.has(p.id)).length
    const gkSlots    = sortedSlots.filter(s => s.label === 'GK')
    const fieldSlots = sortedSlots.filter(s => s.label !== 'GK')
    const pass2Slots = leftNow < emptyNow ? [...gkSlots, ...fieldSlots] : [...fieldSlots, ...gkSlots]
    for (const slot of pass2Slots) {
      if (assignment[slot.id]) continue

      const remaining = playing
        .filter(p => !usedIds.has(p.id))
        .sort((a, b) => quarterCount[a.id] - quarterCount[b.id])
      if (remaining.length === 0) {
        warnings.push(`Q${q}: not enough players to fill ${slot.label}`)
        continue
      }

      let best = remaining.find(p => !(slot.label === 'GK' && gkBlocked[q] === p.id))
      if (!best) {
        // Only the resting keeper is left for GK: swap them with a field
        // player, who goes in goal instead.
        const resting = remaining[0]
        const swapSlot = sortedSlots.find(s => s.label !== 'GK' && assignment[s.id])
        if (!swapSlot) {
          warnings.push(`Q${q}: not enough players to fill ${slot.label}`)
          continue
        }
        best = playing.find(p => p.id === assignment[swapSlot.id])
        assignment[swapSlot.id] = resting.id
        usedIds.add(resting.id)
        if (getRating(resting, swapSlot.label) <= 0) {
          outOfPosition.push({
            playerId: resting.id, playerName: resting.name, jerseyNumber: resting.jersey_number,
            slotLabel: swapSlot.label, quarter: q,
          })
        }
      }

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
  // A kid below their fair target is a real miss and is named. Kids short of
  // 3 only because the field has no room for everyone get one summary line,
  // so the coach isn't handed a list of names they could do nothing about.
  if (quarters.length === 4) {
    const missed = [], noRoom = []
    allAvailable.forEach(p => {
      const maxPossible = chancesIn(p, quarters)
      if (quarterCount[p.id] >= Math.min(targetQuarters((absentQuarters[p.id] || []).length), maxPossible)) return
      if (quarterCount[p.id] < fairTarget[p.id]) missed.push(p)
      else noRoom.push(p)
    })
    missed.forEach(p => warnings.push(`${p.name} only plays ${quarterCount[p.id]} quarter(s)`))
    if (noRoom.length) {
      warnings.push(`${allAvailable.length} players for ${totalSpots} spots: ${noRoom.length} play less than their target, shared out as evenly as possible`)
    }
  }

  return { lineup, quarterCount, warnings, outOfPosition }
}
