// ── Merging two coaches' edits to one game plan ───────────────────
// A head coach and an assistant can both edit the same plan, often with no
// signal. Saving the whole plan meant whichever phone synced last silently
// erased the other's work. Instead each phone remembers the plan as it last
// saw it on the server (the "base") and, when it saves, sends only what it
// changed since then on top of the server's current plan — a three-way merge.
//
//   • Each quarter's position slot, each kid's whole-game absence and each
//     kid's per-quarter OUT mark merge on their own. Two coaches editing
//     different spots both keep their work.
//   • The same spot changed by both: the edit reaching the server now wins
//     (arrival order — phone clocks are often wrong, so they are never used).
//     The overwritten version is kept server-side (saved_game_plan_versions).
//   • Attendance beats placement: a kid marked absent, by either coach, is
//     taken out of every slot, so an older lineup edit can never put a missing
//     kid back on the field.
//   • A kid can't end up in two positions in the same quarter: the slot this
//     phone just set keeps them.
//   • Sub anytime data (clock, stints, minutes) is one unit — never mixed
//     across phones.

const QS = ['1', '2', '3', '4']

// JSONB reorders object keys, so compare by content with sorted keys.
export function stableStringify(v) {
  if (v === undefined) return 'undefined'
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  return '{' + Object.keys(v).sort()
    .filter(k => v[k] !== undefined)
    .map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
}

const same = (a, b) => stableStringify(a ?? null) === stableStringify(b ?? null)

function pick(base, mine, theirs) {
  return same(mine, base) ? theirs : mine
}

function getQ(qd, q) {
  return qd?.[q] ?? qd?.[Number(q)] ?? null
}

// Sets: start from the server, apply what this phone added and removed.
function mergeSet(base, mine, theirs) {
  const b = new Set(base || []), m = new Set(mine || [])
  const out = new Set(theirs || [])
  for (const id of m) if (!b.has(id)) out.add(id)
  for (const id of b) if (!m.has(id)) out.delete(id)
  return [...out]
}

function mergeSlots(base, mine, theirs) {
  const out = { ...(theirs || {}) }
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(mine || {})])
  for (const k of keys) {
    const b = base?.[k] ?? null, m = mine?.[k] ?? null
    if (m !== b) out[k] = m
  }
  return out
}

// row: { quarter_data, absent_players, formation_id }
export function mergePlanRows(base, mine, theirs) {
  const bq = base?.quarter_data || {}, mq = mine?.quarter_data || {}, tq = theirs?.quarter_data || {}
  const qd = {}
  const mineSet = {}   // per quarter: slot keys this phone changed

  for (const q of QS) {
    const b = getQ(bq, q) || {}, m = getQ(mq, q) || {}, t = getQ(tq, q) || {}
    mineSet[q] = new Set()
    if ((m.formationId ?? null) !== (t.formationId ?? null)) {
      // A different formation means different slot names, so slots can't be
      // matched one by one: the side that changed the formation keeps the
      // whole quarter. (The other side's version is kept server-side.)
      const mineChangedForm = (m.formationId ?? null) !== (b.formationId ?? null)
      const src = mineChangedForm ? m : t
      qd[q] = { ...src, slots: { ...(src.slots || {}) } }
      if (mineChangedForm) for (const k of Object.keys(m.slots || {})) mineSet[q].add(k)
      continue
    }
    const slots = mergeSlots(b.slots, m.slots, t.slots)
    for (const k of Object.keys(m.slots || {})) {
      if ((m.slots?.[k] ?? null) !== (b.slots?.[k] ?? null)) mineSet[q].add(k)
    }
    qd[q] = { ...t, ...m, formationId: m.formationId ?? t.formationId, slots }
  }

  const outQ = {}
  for (const q of QS) {
    outQ[q] = mergeSet(getQ(bq.out_q, q), getQ(mq.out_q, q), getQ(tq.out_q, q))
  }
  qd.out_q = outQ

  qd.mode = pick(bq.mode, mq.mode, tq.mode) || 'quarters'
  const fs = pick(bq.free_subs, mq.free_subs, tq.free_subs)
  if (fs) qd.free_subs = fs

  const absent = mergeSet(base?.absent_players, mine?.absent_players, theirs?.absent_players)

  // Attendance beats placement.
  const absentAll = new Set(absent)
  for (const q of QS) {
    const outHere = new Set(outQ[q])
    const slots = qd[q].slots || {}
    for (const k of Object.keys(slots)) {
      const id = slots[k]
      if (id && (absentAll.has(id) || outHere.has(id))) slots[k] = null
    }
    // One position per kid per quarter: the slot this phone set wins.
    const seen = new Map()
    const keys = Object.keys(slots).sort((a, c) =>
      (mineSet[q].has(c) ? 1 : 0) - (mineSet[q].has(a) ? 1 : 0))
    for (const k of keys) {
      const id = slots[k]
      if (!id) continue
      if (seen.has(id)) slots[k] = null
      else seen.set(id, k)
    }
  }

  return {
    quarter_data: qd,
    absent_players: absent,
    formation_id: pick(base?.formation_id, mine?.formation_id, theirs?.formation_id),
  }
}

export function samePlanContent(a, b) {
  return same(a?.quarter_data, b?.quarter_data)
    && same([...(a?.absent_players || [])].sort(), [...(b?.absent_players || [])].sort())
    && (a?.formation_id ?? null) === (b?.formation_id ?? null)
}

// ── The base: the plan as this phone last saw it on the server ────
// Kept in localStorage so it survives the app being closed on the field.
const BASE_PREFIX = 'plan_base_'

export function readPlanBase(id) {
  try {
    const raw = localStorage.getItem(BASE_PREFIX + id)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function writePlanBase(id, row) {
  try {
    localStorage.setItem(BASE_PREFIX + id, JSON.stringify({
      quarter_data: row.quarter_data ?? null,
      absent_players: row.absent_players ?? [],
      formation_id: row.formation_id ?? null,
    }))
  } catch { /* storage full */ }
}

export function clearPlanBase(id) {
  try { localStorage.removeItem(BASE_PREFIX + id) } catch { /* silent */ }
}
