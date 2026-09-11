// Free Subs mode — continuous-clock playing-time tracking.
//
// Some leagues let a coach substitute at any moment instead of at quarter
// breaks. The cost is that nobody can remember who has been on the field for
// how long. A free-subs plan therefore has no quarters: it keeps one lineup,
// a game clock, and a list of stints.
//
// Everything is measured in GAME milliseconds — time since kickoff with the
// clock running — never wall-clock. Pausing the game pauses every open stint,
// and a stint recorded at 12:34 stays at 12:34 no matter when it is read back.

/** A stint is one continuous spell on the field: { playerId, in, out|null }. */

export function createFreeSubs(gameLengthMin) {
  return {
    gameLengthMin,
    runningSince: null,   // wall-clock ms when the clock was last started; null = stopped
    accumulated:  0,      // game ms banked before the current run
    kickedOff:    false,
    ended:        false,
    preEnd:       null,   // snapshot taken at End, so End can be undone
    stints:       [],
  }
}

export function isRunning(fs) {
  return !!fs && fs.runningSince !== null && !fs.ended
}

/** Game ms elapsed right now. */
export function gameMs(fs, now = Date.now()) {
  if (!fs) return 0
  const running = fs.runningSince !== null && !fs.ended ? Math.max(0, now - fs.runningSince) : 0
  return fs.accumulated + running
}

export function totalMs(fs) {
  return Math.max(1, (fs?.gameLengthMin || 0) * 60000)
}

// ── Clock controls — each returns a new free-subs object ──────────

export function startClock(fs, now = Date.now()) {
  if (!fs || fs.ended || isRunning(fs)) return fs
  return { ...fs, runningSince: now, kickedOff: true }
}

export function pauseClock(fs, now = Date.now()) {
  if (!isRunning(fs)) return fs
  return { ...fs, accumulated: gameMs(fs, now), runningSince: null }
}

export function endGame(fs, now = Date.now()) {
  if (!fs || fs.ended) return fs
  const at = gameMs(fs, now)
  return {
    ...fs,
    accumulated:  at,
    runningSince: null,
    ended:        true,
    // Remember the shape of the game a moment before the whistle, so an
    // accidental End can be taken back with the open stints intact.
    preEnd:       { stints: fs.stints, accumulated: fs.accumulated },
    stints:       closeAll(fs.stints, at),
  }
}

/**
 * Undo an End. The clock comes back paused at the time it was stopped and
 * whoever was on the field is on the field again, so nobody loses minutes and
 * nobody gains any while the mistake is being fixed.
 */
export function resumeGame(fs) {
  if (!fs || !fs.ended) return fs
  const base = { ...fs, ended: false, runningSince: null, preEnd: null }
  // Plans saved before this existed have no snapshot; they simply reopen with
  // every stint closed, which is still better than being stuck on Final.
  if (!fs.preEnd) return base
  return { ...base, stints: fs.preEnd.stints }
}

/**
 * Pull the clock back to a given game time and close every open stint there.
 *
 * Recovery for a clock left running long after the final whistle: the wall
 * clock kept counting all night, so the honest reconstruction is that the game
 * stopped at full time. Stints are clamped rather than deleted, so everything
 * played before that point survives untouched.
 */
export function pauseAt(fs, atMs) {
  if (!fs) return fs
  const at = Math.max(0, atMs)
  return {
    ...fs,
    runningSince: null,
    accumulated:  at,
    stints: fs.stints
      .map(s => ({
        ...s,
        in:  Math.min(s.in, at),
        out: s.out === null ? at : Math.min(s.out, at),
      }))
      .filter(s => s.out > s.in),
  }
}

export function resetClock(fs) {
  if (!fs) return fs
  return { ...fs, runningSince: null, accumulated: 0, kickedOff: false, ended: false, preEnd: null, stints: [] }
}

// ── Stints ───────────────────────────────────────────────────────

function closeAll(stints, atMs) {
  return stints
    .map(s => (s.out === null ? { ...s, out: atMs } : s))
    .filter(s => s.out > s.in)
}

/**
 * Bring the stint list in line with who is on the field right now.
 *
 * Called whenever the lineup changes (a drag, an OUT, a cleared field) and
 * whenever the clock starts, so no individual handler has to remember to
 * record anything. Before kickoff nothing accrues — players can be arranged
 * on the field freely and the first stints open at 0:00 when the clock starts.
 */
export function reconcileStints(fs, onFieldIds, atMs) {
  if (!fs || !fs.kickedOff || fs.ended) return fs.stints
  const next = fs.stints.map(s => ({ ...s }))

  // Close the stints of anyone who has left the field.
  for (const s of next) {
    if (s.out === null && !onFieldIds.has(s.playerId)) s.out = atMs
  }

  // Open a stint for anyone on the field without one.
  const open = new Set(next.filter(s => s.out === null).map(s => s.playerId))
  for (const pid of onFieldIds) {
    if (!open.has(pid)) next.push({ playerId: pid, in: atMs, out: null })
  }

  // Drop zero-length stints — a player subbed on and straight back off at the
  // same clock reading never actually played.
  return next.filter(s => s.out === null || s.out > s.in)
}

export function playedMsFor(stints, playerId, nowMs) {
  let total = 0
  for (const s of stints) {
    if (s.playerId !== playerId) continue
    total += (s.out === null ? nowMs : s.out) - s.in
  }
  return Math.max(0, total)
}

export function playedMsByPlayer(stints, playerIds, nowMs) {
  const out = {}
  for (const pid of playerIds) out[pid] = playedMsFor(stints, pid, nowMs)
  return out
}

export function isOnField(stints, playerId) {
  return stints.some(s => s.playerId === playerId && s.out === null)
}

/**
 * The played spells of one player as percentages of the full game, ready to
 * paint straight onto a 0–100% wide bar.
 */
export function segmentsFor(stints, playerId, nowMs, total) {
  const span = Math.max(1, total)
  const segs = []
  for (const s of stints) {
    if (s.playerId !== playerId) continue
    const end   = s.out === null ? nowMs : s.out
    const left  = (s.in / span) * 100
    const width = ((end - s.in) / span) * 100
    if (width <= 0) continue
    segs.push({
      leftPct:  Math.max(0, Math.min(100, left)),
      widthPct: Math.max(0, Math.min(100 - left, width)),
      open:     s.out === null,
    })
  }
  return segs
}

/** mm:ss from milliseconds. */
export function fmtMs(ms) {
  const s  = Math.floor(Math.max(0, ms) / 1000)
  const m  = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

export function pctOf(ms, total) {
  return Math.round((Math.max(0, ms) / Math.max(1, total)) * 100)
}

// ── Persistence ──────────────────────────────────────────────────

export function serializeFreeSubs(fs) {
  if (!fs) return null
  return {
    gameLengthMin: fs.gameLengthMin,
    runningSince:  fs.runningSince,
    accumulated:   fs.accumulated,
    kickedOff:     !!fs.kickedOff,
    ended:         !!fs.ended,
    preEnd:        fs.preEnd
      ? {
          accumulated: fs.preEnd.accumulated,
          stints: (fs.preEnd.stints || []).map(s => ({ playerId: s.playerId, in: s.in, out: s.out ?? null })),
        }
      : null,
    stints:        (fs.stints || []).map(s => ({ playerId: s.playerId, in: s.in, out: s.out ?? null })),
  }
}

export function parseFreeSubs(raw, fallbackLengthMin, validIds) {
  if (!raw || typeof raw !== 'object') return null
  const base = createFreeSubs(Number(raw.gameLengthMin) || fallbackLengthMin)
  return {
    ...base,
    runningSince: typeof raw.runningSince === 'number' ? raw.runningSince : null,
    accumulated:  Number(raw.accumulated) || 0,
    kickedOff:    !!raw.kickedOff,
    ended:        !!raw.ended,
    preEnd: raw.preEnd
      ? {
          accumulated: Number(raw.preEnd.accumulated) || 0,
          stints: (Array.isArray(raw.preEnd.stints) ? raw.preEnd.stints : [])
            .filter(s => s && (!validIds || validIds.has(s.playerId)) && typeof s.in === 'number')
            .map(s => ({ playerId: s.playerId, in: s.in, out: typeof s.out === 'number' ? s.out : null })),
        }
      : null,
    stints: (Array.isArray(raw.stints) ? raw.stints : [])
      .filter(s => s && (!validIds || validIds.has(s.playerId)) && typeof s.in === 'number')
      .map(s => ({ playerId: s.playerId, in: s.in, out: typeof s.out === 'number' ? s.out : null })),
  }
}
