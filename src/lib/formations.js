// Formation slot positions: x/y are percentages of the field container (0–100)
// y=0 is top (opponent goal), y=100 is bottom (our goal / GK end)
// Lower x = right side of pitch (from player's perspective facing opponent goal)

// ── 8U (4v4) ────────────────────────────────────────────────────
const F_8U_21 = {
  id: '8u-121', label: '2-1', slotSizePct: 15,
  slots: [
    { id: 'gk',   label: 'GK', x: 50, y: 87 },
    { id: 'def1', label: 'RB', x: 33, y: 65 },
    { id: 'def2', label: 'LB', x: 67, y: 65 },
    { id: 'fwd1', label: 'ST', x: 50, y: 22 },
  ],
}

const F_8U_12 = {
  id: '8u-112', label: '1-2', slotSizePct: 15,
  slots: [
    { id: 'gk',   label: 'GK', x: 50, y: 87 },
    { id: 'def1', label: 'CB', x: 50, y: 65 },
    { id: 'fwd1', label: 'ST', x: 33, y: 22 },
    { id: 'fwd2', label: 'ST', x: 67, y: 22 },
  ],
}

const F_8U_111 = {
  id: '8u-111', label: '1-1-1', slotSizePct: 15,
  slots: [
    { id: 'gk',   label: 'GK', x: 50, y: 87 },
    { id: 'def1', label: 'CB', x: 50, y: 67 },
    { id: 'mid1', label: 'CM', x: 50, y: 48 },
    { id: 'fwd1', label: 'ST', x: 50, y: 22 },
  ],
}

// ── 10U (7v7) ───────────────────────────────────────────────────
const F_10U_231 = {
  id: '10u-1231', label: '2-3-1', slotSizePct: 13,
  slots: [
    { id: 'gk',   label: 'GK', x: 50, y: 89 },
    { id: 'def1', label: 'RB', x: 33, y: 72 },
    { id: 'def2', label: 'LB', x: 67, y: 72 },
    { id: 'mid1', label: 'RM', x: 25, y: 51 },
    { id: 'mid2', label: 'CM', x: 50, y: 51 },
    { id: 'mid3', label: 'LM', x: 75, y: 51 },
    { id: 'fwd1', label: 'ST', x: 50, y: 21 },
  ],
}

const F_10U_321 = {
  id: '10u-1321', label: '3-2-1', slotSizePct: 13,
  slots: [
    { id: 'gk',   label: 'GK', x: 50, y: 89 },
    { id: 'def1', label: 'RB', x: 25, y: 72 },
    { id: 'def2', label: 'CB', x: 50, y: 72 },
    { id: 'def3', label: 'LB', x: 75, y: 72 },
    { id: 'mid1', label: 'CM', x: 33, y: 51 },
    { id: 'mid2', label: 'CM', x: 67, y: 51 },
    { id: 'fwd1', label: 'ST', x: 50, y: 21 },
  ],
}

const F_10U_222 = {
  id: '10u-1222', label: '2-2-2', slotSizePct: 13,
  slots: [
    { id: 'gk',   label: 'GK', x: 50, y: 89 },
    { id: 'def1', label: 'RB', x: 33, y: 72 },
    { id: 'def2', label: 'LB', x: 67, y: 72 },
    { id: 'mid1', label: 'CM', x: 33, y: 51 },
    { id: 'mid2', label: 'CM', x: 67, y: 51 },
    { id: 'fwd1', label: 'ST', x: 33, y: 21 },
    { id: 'fwd2', label: 'ST', x: 67, y: 21 },
  ],
}

const F_10U_312 = {
  id: '10u-1312', label: '3-1-2', slotSizePct: 13,
  slots: [
    { id: 'gk',   label: 'GK', x: 50, y: 89 },
    { id: 'def1', label: 'RB', x: 25, y: 72 },
    { id: 'def2', label: 'CB', x: 50, y: 72 },
    { id: 'def3', label: 'LB', x: 75, y: 72 },
    { id: 'mid1', label: 'CM', x: 50, y: 51 },
    { id: 'fwd1', label: 'ST', x: 33, y: 21 },
    { id: 'fwd2', label: 'ST', x: 67, y: 21 },
  ],
}

// ── 12U (9v9) ───────────────────────────────────────────────────
const F_12U_332 = {
  id: '12u-1332', label: '3-3-2', slotSizePct: 12,
  slots: [
    { id: 'gk',   label: 'GK', x: 50, y: 90 },
    { id: 'def1', label: 'CB', x: 25, y: 74 },
    { id: 'def2', label: 'CB', x: 50, y: 74 },
    { id: 'def3', label: 'CB', x: 75, y: 74 },
    { id: 'mid1', label: 'RM', x: 25, y: 53 },
    { id: 'mid2', label: 'CM', x: 50, y: 53 },
    { id: 'mid3', label: 'LM', x: 75, y: 53 },
    { id: 'fwd1', label: 'ST', x: 33, y: 23 },
    { id: 'fwd2', label: 'ST', x: 67, y: 23 },
  ],
}

const F_12U_323 = {
  id: '12u-1323', label: '3-2-3', slotSizePct: 12,
  slots: [
    { id: 'gk',   label: 'GK', x: 50, y: 90 },
    { id: 'def1', label: 'CB', x: 25, y: 74 },
    { id: 'def2', label: 'CB', x: 50, y: 74 },
    { id: 'def3', label: 'CB', x: 75, y: 74 },
    { id: 'mid1', label: 'CM', x: 33, y: 53 },
    { id: 'mid2', label: 'CM', x: 67, y: 53 },
    { id: 'fwd1', label: 'RW', x: 25, y: 23 },
    { id: 'fwd2', label: 'ST', x: 50, y: 23 },
    { id: 'fwd3', label: 'LW', x: 75, y: 23 },
  ],
}

const F_12U_422 = {
  id: '12u-1422', label: '4-2-2', slotSizePct: 12,
  slots: [
    { id: 'gk',   label: 'GK', x: 50, y: 90 },
    { id: 'def1', label: 'RB', x: 20, y: 74 },
    { id: 'def2', label: 'CB', x: 40, y: 74 },
    { id: 'def3', label: 'CB', x: 60, y: 74 },
    { id: 'def4', label: 'LB', x: 80, y: 74 },
    { id: 'mid1', label: 'CM', x: 33, y: 53 },
    { id: 'mid2', label: 'CM', x: 67, y: 53 },
    { id: 'fwd1', label: 'ST', x: 33, y: 23 },
    { id: 'fwd2', label: 'ST', x: 67, y: 23 },
  ],
}

const F_12U_242 = {
  id: '12u-1242', label: '2-4-2', slotSizePct: 12,
  slots: [
    { id: 'gk',   label: 'GK', x: 50, y: 90 },
    { id: 'def1', label: 'RB', x: 33, y: 74 },
    { id: 'def2', label: 'LB', x: 67, y: 74 },
    { id: 'mid1', label: 'RM', x: 20, y: 53 },
    { id: 'mid2', label: 'CM', x: 40, y: 53 },
    { id: 'mid3', label: 'CM', x: 60, y: 53 },
    { id: 'mid4', label: 'LM', x: 80, y: 53 },
    { id: 'fwd1', label: 'ST', x: 33, y: 23 },
    { id: 'fwd2', label: 'ST', x: 67, y: 23 },
  ],
}

// ── 11v11 (14U / 16U / 19U) ─────────────────────────────────────
const F_11V11_433 = {
  id: '11v11-433', label: '4-3-3', slotSizePct: 11,
  slots: [
    { id: 'gk',   label: 'GK',  x: 50, y: 91 },
    { id: 'def1', label: 'RB',  x: 20, y: 76 },
    { id: 'def2', label: 'CB',  x: 40, y: 76 },
    { id: 'def3', label: 'CB',  x: 60, y: 76 },
    { id: 'def4', label: 'LB',  x: 80, y: 76 },
    { id: 'mid1', label: 'CM',  x: 25, y: 55 },
    { id: 'mid2', label: 'CM',  x: 50, y: 55 },
    { id: 'mid3', label: 'CM',  x: 75, y: 55 },
    { id: 'fwd1', label: 'RW',  x: 25, y: 27 },
    { id: 'fwd2', label: 'ST',  x: 50, y: 27 },
    { id: 'fwd3', label: 'LW',  x: 75, y: 27 },
  ],
}

const F_11V11_442 = {
  id: '11v11-442', label: '4-4-2', slotSizePct: 11,
  slots: [
    { id: 'gk',   label: 'GK',  x: 50, y: 91 },
    { id: 'def1', label: 'RB',  x: 20, y: 76 },
    { id: 'def2', label: 'CB',  x: 40, y: 76 },
    { id: 'def3', label: 'CB',  x: 60, y: 76 },
    { id: 'def4', label: 'LB',  x: 80, y: 76 },
    { id: 'mid1', label: 'RM',  x: 20, y: 55 },
    { id: 'mid2', label: 'CM',  x: 40, y: 55 },
    { id: 'mid3', label: 'CM',  x: 60, y: 55 },
    { id: 'mid4', label: 'LM',  x: 80, y: 55 },
    { id: 'fwd1', label: 'ST',  x: 33, y: 27 },
    { id: 'fwd2', label: 'ST',  x: 67, y: 27 },
  ],
}

const F_11V11_352 = {
  id: '11v11-352', label: '3-5-2', slotSizePct: 11,
  slots: [
    { id: 'gk',   label: 'GK',  x: 50, y: 91 },
    { id: 'def1', label: 'CB',  x: 25, y: 76 },
    { id: 'def2', label: 'CB',  x: 50, y: 76 },
    { id: 'def3', label: 'CB',  x: 75, y: 76 },
    { id: 'mid1', label: 'RM',  x: 17, y: 55 },
    { id: 'mid2', label: 'CM',  x: 33, y: 55 },
    { id: 'mid3', label: 'CDM', x: 50, y: 55 },
    { id: 'mid4', label: 'CM',  x: 67, y: 55 },
    { id: 'mid5', label: 'LM',  x: 83, y: 55 },
    { id: 'fwd1', label: 'ST',  x: 33, y: 27 },
    { id: 'fwd2', label: 'ST',  x: 67, y: 27 },
  ],
}

const F_11V11_4231 = {
  id: '11v11-4231', label: '4-2-3-1', slotSizePct: 11,
  slots: [
    { id: 'gk',   label: 'GK',  x: 50, y: 91 },
    { id: 'def1', label: 'RB',  x: 20, y: 76 },
    { id: 'def2', label: 'CB',  x: 40, y: 76 },
    { id: 'def3', label: 'CB',  x: 60, y: 76 },
    { id: 'def4', label: 'LB',  x: 80, y: 76 },
    { id: 'mid1', label: 'CDM', x: 33, y: 62 },
    { id: 'mid2', label: 'CDM', x: 67, y: 62 },
    { id: 'att1', label: 'RM',  x: 25, y: 44 },
    { id: 'att2', label: 'CAM', x: 50, y: 44 },
    { id: 'att3', label: 'LM',  x: 75, y: 44 },
    { id: 'fwd1', label: 'ST',  x: 50, y: 22 },
  ],
}

const F_11V11_4411 = {
  id: '11v11-4411', label: '4-4-1-1', slotSizePct: 11,
  slots: [
    { id: 'gk',   label: 'GK',  x: 50, y: 91 },
    { id: 'def1', label: 'RB',  x: 20, y: 76 },
    { id: 'def2', label: 'CB',  x: 40, y: 76 },
    { id: 'def3', label: 'CB',  x: 60, y: 76 },
    { id: 'def4', label: 'LB',  x: 80, y: 76 },
    { id: 'mid1', label: 'RM',  x: 20, y: 58 },
    { id: 'mid2', label: 'CM',  x: 40, y: 58 },
    { id: 'mid3', label: 'CM',  x: 60, y: 58 },
    { id: 'mid4', label: 'LM',  x: 80, y: 58 },
    { id: 'att1', label: 'CAM', x: 50, y: 41 },
    { id: 'fwd1', label: 'ST',  x: 50, y: 24 },
  ],
}

const F_11V11_343 = {
  id: '11v11-343', label: '3-4-3', slotSizePct: 11,
  slots: [
    { id: 'gk',   label: 'GK',  x: 50, y: 91 },
    { id: 'def1', label: 'CB',  x: 25, y: 76 },
    { id: 'def2', label: 'CB',  x: 50, y: 76 },
    { id: 'def3', label: 'CB',  x: 75, y: 76 },
    { id: 'mid1', label: 'RM',  x: 20, y: 55 },
    { id: 'mid2', label: 'CM',  x: 40, y: 55 },
    { id: 'mid3', label: 'CM',  x: 60, y: 55 },
    { id: 'mid4', label: 'LM',  x: 80, y: 55 },
    { id: 'fwd1', label: 'RW',  x: 25, y: 27 },
    { id: 'fwd2', label: 'ST',  x: 50, y: 27 },
    { id: 'fwd3', label: 'LW',  x: 75, y: 27 },
  ],
}

const F_11V11_532 = {
  id: '11v11-532', label: '5-3-2', slotSizePct: 11,
  slots: [
    { id: 'gk',   label: 'GK',  x: 50, y: 91 },
    { id: 'def1', label: 'RB',  x: 17, y: 76 },
    { id: 'def2', label: 'CB',  x: 33, y: 76 },
    { id: 'def3', label: 'CB',  x: 50, y: 76 },
    { id: 'def4', label: 'CB',  x: 67, y: 76 },
    { id: 'def5', label: 'LB',  x: 83, y: 76 },
    { id: 'mid1', label: 'CM',  x: 25, y: 55 },
    { id: 'mid2', label: 'CM',  x: 50, y: 55 },
    { id: 'mid3', label: 'CM',  x: 75, y: 55 },
    { id: 'fwd1', label: 'ST',  x: 33, y: 27 },
    { id: 'fwd2', label: 'ST',  x: 67, y: 27 },
  ],
}

// ── Formation registry by division ──────────────────────────────
export const FORMATIONS_BY_DIVISION = {
  '8U':  [F_8U_21, F_8U_12, F_8U_111],
  '10U': [F_10U_231, F_10U_321, F_10U_222, F_10U_312],
  '12U': [F_12U_332, F_12U_323, F_12U_422, F_12U_242],
  '14U': [F_11V11_433, F_11V11_442, F_11V11_352, F_11V11_4231, F_11V11_4411, F_11V11_343, F_11V11_532],
  '16U': [F_11V11_433, F_11V11_442, F_11V11_352, F_11V11_4231, F_11V11_4411, F_11V11_343, F_11V11_532],
  '19U': [F_11V11_433, F_11V11_442, F_11V11_352, F_11V11_4231, F_11V11_4411, F_11V11_343, F_11V11_532],
}

export function getDefaultFormation(division) {
  const list = FORMATIONS_BY_DIVISION[division]
  return (list && list[0]) || F_11V11_433
}

export function getFormationById(id) {
  for (const list of Object.values(FORMATIONS_BY_DIVISION)) {
    const f = list.find(f => f.id === id)
    if (f) return f
  }
  return null
}

// ── Quarter length = half length ÷ 2 ────────────────────────────
export const HALF_LENGTHS = {
  '8U':  20,
  '10U': 25,
  '12U': 30,
  '14U': 35,
  '16U': 40,
  '19U': 45,
}

export function getHalfLengthMin(division) {
  return HALF_LENGTHS[division] ?? 45
}

export function getQuarterLengthMin(division) {
  return (HALF_LENGTHS[division] ?? 45) / 2
}

// Backward-compat
export function getFormation(division) {
  return getDefaultFormation(division)
}
