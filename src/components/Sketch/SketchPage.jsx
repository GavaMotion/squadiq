import { Component, useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../contexts/AppContext'
import theme from '../../theme'
import { FORMATIONS_BY_DIVISION, getFormationById } from '../../lib/formations'
import { getContrastTextColor } from '../../lib/utils'

// ── Error boundary ────────────────────────────────────────────────
class SketchErrorBoundary extends Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#0a0f0c', padding: 24 }}>
          <p style={{ color: '#f87171', fontWeight: 700, fontSize: 14 }}>Sketch error — please reload</p>
          <pre style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', maxWidth: 300, whiteSpace: 'pre-wrap' }}>{this.state.error?.message}</pre>
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{ padding: '6px 16px', borderRadius: 6, background: '#00c853', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Constants ─────────────────────────────────────────────────────
const ARROW_COLORS = {
  white:  '#ffffff',
  yellow: '#fbbf24',
  red:    '#ef4444',
  green:  '#22c55e',
}

const DIVISION_PLAYER_COUNT = {
  Futsal: 5, U6: 3, U8: 4, U10: 7, U12: 9, U14: 11, U16: 11, U19: 11,
}

// Net pointer travel (px) below which a press counts as a tap, not a drag.
// Generous enough to absorb finger jitter on touch screens.
const DRAG_THRESHOLD = 10

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Normalize any stored arrow format to { id, points: [{x,y},...], color }
function normalizeArrow(a) {
  if (a == null) return null
  if (Array.isArray(a.points) && a.points.length >= 2) return a
  if ('x1' in a) return { id: a.id, points: [{ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }], color: a.color }
  return null
}

// ── Color utilities ───────────────────────────────────────────────
function hexToHsl(hex) {
  const h2 = (hex || '#00c853').replace('#', '')
  let r = parseInt(h2.slice(0, 2), 16) / 255
  let g = parseInt(h2.slice(2, 4), 16) / 255
  let b = parseInt(h2.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) { h = s = 0 }
  else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
      default: h = 0
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function getOpponentColor(primaryHex) {
  const [h] = hexToHsl(primaryHex || '#00c853')
  const oppositeH = (h + 180) % 360
  return hslToHex(oppositeH, 90, 60)
}

// ── Player helpers ────────────────────────────────────────────────
function buildMyPlayers(players, gdPlanStates, gdActivePlanId, quarter = 1) {
  const qData = gdPlanStates?.[gdActivePlanId]?.quarters?.[quarter]
  const formation = qData?.formation
  const slots = qData?.slots || {}
  return players.map(p => {
    const slotEntry = formation && Object.entries(slots).find(([, pid]) => pid === p.id)
    const slot = slotEntry && formation.slots.find(s => s.id === slotEntry[0])
    return {
      id: p.id, name: p.name, jerseyNumber: p.jersey_number,
      onField: !!slot,
      x: slot ? slot.x : 50,
      y: slot ? slot.y : 50,
      fromFormation: !!slot,
    }
  })
}

// Places opp players at mirrored formation positions with fromFormation flag
function buildOppPlayersFromFormation(formation) {
  return formation.slots.map((slot, i) => ({
    id: `opp-${i + 1}`,
    label: String(i + 1),
    jerseyNumber: i + 1,
    onField: true,
    x: slot.x,
    y: 100 - slot.y,
    fromFormation: true,
  }))
}

// Places my players at formation positions (GK bottom, FWD top)
function buildMyPlayersFromFormation(formation, playerList) {
  const slots = formation.slots
  return playerList.map((p, i) => ({
    id: p.id,
    name: p.name,
    jerseyNumber: p.jersey_number || p.jerseyNumber,
    onField: i < slots.length,
    x: i < slots.length ? slots[i].x : 50,
    y: i < slots.length ? slots[i].y : 50,
    fromFormation: i < slots.length,
  }))
}

// Creates N bench opponent players
function buildDefaultOppBench(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `opp-${i + 1}`,
    label: String(i + 1),
    jerseyNumber: i + 1,
    onField: false,
    x: 50,
    y: 50,
    fromFormation: false,
  }))
}

// ── Field SVG background ──────────────────────────────────────────
function SketchFieldSVG() {
  const L = theme.fieldLines
  return (
    <svg viewBox="0 0 68 105" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
      <rect width="68" height="105" fill={theme.fieldBg} />
      <rect x="2.04" y="2.05" width="63.92" height="100.91" fill="none" stroke={L} strokeWidth="0.5" />
      <line x1="2.04" y1="52.5" x2="65.96" y2="52.5" stroke={L} strokeWidth="0.5" />
      <circle cx="34" cy="52.5" r="8.84" fill="none" stroke={L} strokeWidth="0.5" />
      <circle cx="34" cy="52.5" r="0.54" fill={L} />
      <rect x="14.96" y="2.05" width="38.08" height="15.68" fill="none" stroke={L} strokeWidth="0.5" />
      <rect x="25.16" y="2.05" width="17.68" height="5.45" fill="none" stroke={L} strokeWidth="0.5" />
      <rect x="30.26" y="0" width="7.48" height="2.05" fill="rgba(0,0,0,0.4)" stroke={L} strokeWidth="0.5" />
      <circle cx="34" cy="12.95" r="0.48" fill={L} />
      <rect x="14.96" y="87.27" width="38.08" height="15.68" fill="none" stroke={L} strokeWidth="0.5" />
      <rect x="25.16" y="97.5" width="17.68" height="5.45" fill="none" stroke={L} strokeWidth="0.5" />
      <rect x="30.26" y="102.95" width="7.48" height="2.05" fill="rgba(0,0,0,0.4)" stroke={L} strokeWidth="0.5" />
      <circle cx="34" cy="92.05" r="0.48" fill={L} />
      <path d="M 2.04 5.45 A 3.4 3.4 0 0 0 5.44 2.05"    fill="none" stroke={L} strokeWidth="0.5" />
      <path d="M 62.56 2.05 A 3.4 3.4 0 0 0 65.96 5.45"  fill="none" stroke={L} strokeWidth="0.5" />
      <path d="M 2.04 99.58 A 3.4 3.4 0 0 1 5.44 102.96"  fill="none" stroke={L} strokeWidth="0.5" />
      <path d="M 62.56 102.96 A 3.4 3.4 0 0 1 65.96 99.58" fill="none" stroke={L} strokeWidth="0.5" />
    </svg>
  )
}

// ── Player circle ─────────────────────────────────────────────────
function PlayerCircle({ p, isOpp, color, textColor, size, isSelected, onPointerDown }) {
  const label    = isOpp ? p.label    : String(p.jerseyNumber || '')
  const subLabel = isOpp ? 'OPP'      : (p.name ? p.name.split(' ')[0] : '')
  const sz       = size || 44
  const txt      = textColor || '#fff'
  // Sub-label is dimmed; lighten/darken depending on whether txt is light or dark.
  const isDarkTxt = txt.startsWith('#0') || txt.toLowerCase().startsWith('#1') || txt.toLowerCase() === '#000' || txt.toLowerCase() === 'black'
  const subTxt = isDarkTxt ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.75)'
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        width: sz, height: sz, borderRadius: '50%', flexShrink: 0,
        background: color || '#1a5c2e',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'grab',
        boxShadow: isSelected
          ? `0 0 0 3px #fbbf24, 3px 4px 8px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,255,255,0.35)`
          : `3px 4px 8px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,255,255,0.35)`,
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <span style={{ color: txt, fontWeight: 700, fontSize: sz > 40 ? 14 : 12, lineHeight: 1 }}>{label}</span>
      {subLabel && (
        <span style={{
          color: subTxt, fontSize: sz > 40 ? 8 : 7,
          lineHeight: 1, maxWidth: sz - 8,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{subLabel}</span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function SketchPage() {
  const { team, players, gdPlanStates, gdActivePlanId } = useApp()

  // ── Sketch tabs ────────────────────────────────────────────────
  const [sketches,        setSketches]        = useState([])
  const [activeSketchId,  setActiveSketchId]  = useState(null)
  const [sketchStates,    setSketchStates]    = useState({})
  const [loading,         setLoading]         = useState(true)
  const [editingTabId,    setEditingTabId]    = useState(null)
  const [editingName,     setEditingName]     = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // ── Formation state (per-sketch, session-only) ─────────────────
  const [oppFormationIds,  setOppFormationIds]  = useState({})
  const [myFormationIds,   setMyFormationIds]   = useState({})
  const [pendingOppFormId, setPendingOppFormId] = useState(null)
  const [pendingMyFormId,  setPendingMyFormId]  = useState(null)

  // ── Undo / redo ────────────────────────────────────────────────
  const [history, setHistory] = useState([])
  const [future,  setFuture]  = useState([])

  // ── UI ─────────────────────────────────────────────────────────
  const [drawColor,       setDrawColor]       = useState('white')
  const [selectedArrowId, setSelectedArrowId] = useState(null)
  const [showLoadQMenu,   setShowLoadQMenu]   = useState(false)
  const [interaction,     setInteractionSt]   = useState(null)
  const interactionRef = useRef(null)
  function setInteraction(val) {
    const next = typeof val === 'function' ? val(interactionRef.current) : val
    interactionRef.current = next
    setInteractionSt(next)
  }

  // ── Responsive ────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h, { passive: true })
    return () => window.removeEventListener('resize', h)
  }, [])
  const circleSize = isMobile ? 40 : 44
  const benchH     = isMobile ? 60 : 80

  // ── Refs ───────────────────────────────────────────────────────
  const fieldRef          = useRef(null)
  const saveTimerRef      = useRef(null)
  const sketchStatesRef   = useRef(sketchStates)
  const activeSketchIdRef = useRef(activeSketchId)
  const saveSnapshotRef   = useRef(null)
  const undoRef           = useRef(null)
  const redoRef           = useRef(null)
  const q1PosRef          = useRef({}) // playerId -> { onField, x, y } from GD Q1
  const dragLastRef       = useRef(null) // last pointermove pos: { clientX, clientY, inField }

  useEffect(() => { sketchStatesRef.current   = sketchStates   }, [sketchStates])
  useEffect(() => { activeSketchIdRef.current = activeSketchId }, [activeSketchId])

  // ── Snapshot helpers (read refs so safe in stale closures) ─────
  function saveSnapshot() {
    const sid   = activeSketchIdRef.current
    const state = sketchStatesRef.current[sid]
    if (!state) return
    setHistory(prev => [...prev.slice(-30), {
      myPlayers:  JSON.parse(JSON.stringify(state.myPlayers  || [])),
      oppPlayers: JSON.parse(JSON.stringify(state.oppPlayers || [])),
      arrows:     JSON.parse(JSON.stringify(state.arrows     || [])),
    }])
    setFuture([])
  }

  function undo() {
    setHistory(prev => {
      if (prev.length === 0) return prev
      const previous   = prev[prev.length - 1]
      const newHistory = prev.slice(0, -1)
      const sid        = activeSketchIdRef.current
      const state      = sketchStatesRef.current[sid]
      if (!sid || !state) return prev
      setFuture(f => [...f, {
        myPlayers:  JSON.parse(JSON.stringify(state.myPlayers  || [])),
        oppPlayers: JSON.parse(JSON.stringify(state.oppPlayers || [])),
        arrows:     JSON.parse(JSON.stringify(state.arrows     || [])),
      }])
      setSketchStates(ss => ({ ...ss, [sid]: { ...ss[sid], ...previous } }))
      scheduleSave(sid)
      return newHistory
    })
  }

  function redo() {
    setFuture(prev => {
      if (prev.length === 0) return prev
      const next      = prev[prev.length - 1]
      const newFuture = prev.slice(0, -1)
      const sid       = activeSketchIdRef.current
      const state     = sketchStatesRef.current[sid]
      if (!sid || !state) return prev
      setHistory(h => [...h, {
        myPlayers:  JSON.parse(JSON.stringify(state.myPlayers  || [])),
        oppPlayers: JSON.parse(JSON.stringify(state.oppPlayers || [])),
        arrows:     JSON.parse(JSON.stringify(state.arrows     || [])),
      }])
      setSketchStates(ss => ({ ...ss, [sid]: { ...ss[sid], ...next } }))
      scheduleSave(sid)
      return newFuture
    })
  }

  // Keep refs current every render so closures always call the latest version
  saveSnapshotRef.current = saveSnapshot
  undoRef.current         = undo
  redoRef.current         = redo

  // Q1 field positions per player id — used to place a benched player when it's
  // tapped (not dragged). Read via ref inside the once-bound window handlers.
  q1PosRef.current = (() => {
    const map = {}
    for (const p of buildMyPlayers(players, gdPlanStates, gdActivePlanId, 1)) {
      map[p.id] = { onField: p.onField, x: p.x, y: p.y }
    }
    return map
  })()

  // Clear history/future when switching sketches
  useEffect(() => {
    setHistory([])
    setFuture([])
  }, [activeSketchId])

  // Keyboard shortcuts (Ctrl/Cmd+Z = undo, Ctrl/Cmd+Y or Shift+Z = redo)
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoRef.current?.()
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redoRef.current?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Window-level drag/draw handlers (run once) ─────────────────
  useEffect(() => {
    function onWindowMove(e) {
      const ix = interactionRef.current
      if (!ix) return
      const r = fieldRef.current?.getBoundingClientRect()
      if (!r) return

      if (ix.type === 'dragging') {
        // Record the live pointer position (pointermove coords are reliable on
        // touch, unlike pointerup). The player renders as a floating ghost at the
        // cursor; nothing is committed to the field until drop.
        dragLastRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          inField: e.clientX >= r.left && e.clientX <= r.right
                && e.clientY >= r.top  && e.clientY <= r.bottom,
        }
        // Below threshold this is still a tap; don't start the drag ghost yet.
        const threshold = ix.isTouch ? DRAG_THRESHOLD : 4
        if (!ix.moved) {
          const dist = Math.hypot(e.clientX - ix.startClientX, e.clientY - ix.startClientY)
          if (dist < threshold) return
        }
        // Move the floating ghost (and flip moved=true on the first qualifying move).
        setInteraction(prev => prev
          ? { ...prev, moved: true, clientX: e.clientX, clientY: e.clientY }
          : null)
      }

      if (ix.type === 'drawing') {
        const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width)  * 100))
        const y = Math.min(100, Math.max(0, ((e.clientY - r.top)  / r.height) * 100))
        const last = ix.points[ix.points.length - 1]
        const dx = x - last.x, dy = y - last.y
        if (Math.sqrt(dx * dx + dy * dy) > 0.8) {
          setInteraction(prev => prev ? { ...prev, points: [...prev.points, { x, y }] } : null)
        }
      }
    }

    // Also used as the pointercancel handler — Android fires pointercancel
    // instead of pointerup for many touch taps. Decisions here never read the
    // event's coordinates, so cancel and up are handled identically.
    function onWindowUp() {
      const ix = interactionRef.current
      if (!ix) return

      if (ix.type === 'dragging') {
        const key = ix.playerType === 'my' ? 'myPlayers' : 'oppPlayers'

        // Tap vs. drag is decided by ix.moved, which only flips true when a
        // pointermove crossed the threshold. pointerup coords are NOT used (Android
        // reports them as 0,0 on touch), so a tap can never be misread as a drag.
        if (!ix.moved) {
          const sid = activeSketchIdRef.current
          if (!ix.originOnField) {
            // Tap on a benched player → place it on the field at its Q1 position.
            const q1     = ix.playerType === 'my' ? q1PosRef.current[ix.playerId] : null
            const target = q1 && q1.onField ? { x: q1.x, y: q1.y }
                         : ix.playerType === 'opp' ? { x: 50, y: 25 }   // no Q1 for opponents
                         : { x: 50, y: 50 }                              // benched in Q1 too → center
            saveSnapshotRef.current?.()
            setSketchStates(prev => {
              if (!sid || !prev[sid]) return prev
              return { ...prev, [sid]: {
                ...prev[sid],
                [key]: prev[sid][key].map(p => p.id === ix.playerId
                  ? { ...p, onField: true, x: target.x, y: target.y, fromFormation: false }
                  : p),
              }}
            })
            scheduleSave()
          } else {
            // Tap on an on-field player → snap back to where it started, undoing
            // any sub-threshold drift; it stays on the field.
            setSketchStates(prev => {
              if (!sid || !prev[sid]) return prev
              return { ...prev, [sid]: {
                ...prev[sid],
                [key]: prev[sid][key].map(p => p.id === ix.playerId
                  ? { ...p, onField: true, x: ix.originX, y: ix.originY }
                  : p),
              }}
            })
          }
          setInteraction(null)
          return
        }

        // Drop: commit based on where the cursor was released (last reliable pos).
        saveSnapshotRef.current?.()
        const last    = dragLastRef.current
        const inField = last?.inField ?? true
        const sid     = activeSketchIdRef.current
        const fr      = fieldRef.current?.getBoundingClientRect()

        if (inField && last && fr) {
          // Dropped inside the field → place the player exactly where released.
          const x = Math.min(100, Math.max(0, ((last.clientX - ix.offsetX - fr.left) / fr.width)  * 100))
          const y = Math.min(100, Math.max(0, ((last.clientY - ix.offsetY - fr.top)  / fr.height) * 100))
          setSketchStates(prev => {
            if (!sid || !prev[sid]) return prev
            return { ...prev, [sid]: {
              ...prev[sid],
              [key]: prev[sid][key].map(p => p.id === ix.playerId
                ? { ...p, onField: true, x, y, fromFormation: false }
                : p),
            }}
          })
        } else if (!ix.originOnField && ix.isTouch) {
          // Touch only: a benched player released off-field has no drop target —
          // send it to its Q1 position instead of letting it vanish.
          const q1     = ix.playerType === 'my' ? q1PosRef.current[ix.playerId] : null
          const target = q1 && q1.onField ? { x: q1.x, y: q1.y }
                       : ix.playerType === 'opp' ? { x: 50, y: 25 }
                       : { x: 50, y: 50 }
          setSketchStates(prev => {
            if (!sid || !prev[sid]) return prev
            return { ...prev, [sid]: {
              ...prev[sid],
              [key]: prev[sid][key].map(p => p.id === ix.playerId
                ? { ...p, onField: true, x: target.x, y: target.y, fromFormation: false }
                : p),
            }}
          })
        } else {
          // Dropped outside the field → to the bench (classic mouse behavior; an
          // on-field player dragged off the field is removed to the bench too).
          setSketchStates(prev => {
            if (!sid || !prev[sid]) return prev
            return { ...prev, [sid]: {
              ...prev[sid],
              [key]: prev[sid][key].map(p => p.id === ix.playerId
                ? { ...p, onField: false, fromFormation: false }
                : p),
            }}
          })
        }
        scheduleSave()
      }

      if (ix.type === 'drawing') {
        if (ix.points.length > 3) {
          saveSnapshotRef.current?.()
          const arrow = { id: uid(), points: ix.points, color: ix.color }
          const sid = activeSketchIdRef.current
          if (sid) {
            setSketchStates(prev => {
              if (!prev[sid]) return prev
              return { ...prev, [sid]: { ...prev[sid], arrows: [...prev[sid].arrows, arrow] } }
            })
            scheduleSave()
          }
        }
      }

      setInteraction(null)
    }

    window.addEventListener('pointermove',   onWindowMove)
    window.addEventListener('pointerup',     onWindowUp)
    window.addEventListener('pointercancel', onWindowUp)
    return () => {
      window.removeEventListener('pointermove',   onWindowMove)
      window.removeEventListener('pointerup',     onWindowUp)
      window.removeEventListener('pointercancel', onWindowUp)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ─────────────────────────────────────────────
  const activeState    = sketchStates[activeSketchId] || null
  const myPlayers      = activeState?.myPlayers  || []
  const oppPlayers     = activeState?.oppPlayers || []
  const arrows         = (activeState?.arrows    || []).map(normalizeArrow).filter(Boolean)
  const myColor        = team?.color_primary || '#00c853'
  const myTextColor    = team?.color_accent || getContrastTextColor(myColor)
  const oppColor       = getOpponentColor(team?.color_primary)
  const oppTextColor   = getContrastTextColor(oppColor)
  const oppFormationId = oppFormationIds[activeSketchId] || null
  const myFormationId  = myFormationIds[activeSketchId]  || null
  const formationList  = team ? (FORMATIONS_BY_DIVISION[team.division] || []) : []

  // ── Helpers (need access to component state) ───────────────────
  function getDefaultOppCount() {
    const q1 = gdPlanStates?.[gdActivePlanId]?.quarters?.[1]
    if (q1?.formation?.slots?.length) return q1.formation.slots.length
    return DIVISION_PLAYER_COUNT[team?.division] || players.length || 7
  }

  // ── State helpers ──────────────────────────────────────────────
  function buildInitialState() {
    const myPs = buildMyPlayers(players, gdPlanStates, gdActivePlanId)
    return {
      myPlayers:  myPs,
      oppPlayers: buildDefaultOppBench(getDefaultOppCount()),
      arrows:     [],
    }
  }

  function stateToDb(state) {
    return {
      my_players:  (state.myPlayers  || []).map(({ id, name, jerseyNumber, onField, x, y }) => ({ id, name, jerseyNumber, onField, x, y })),
      opp_players: (state.oppPlayers || []).map(({ id, label, jerseyNumber, onField, x, y }) => ({ id, label, jerseyNumber, onField, x, y })),
      arrows:      (state.arrows || []).map(normalizeArrow).filter(Boolean)
                     .map(({ id, points, color }) => ({ id, points, color })),
    }
  }

  function dbToState(row) {
    const savedMy = row.my_players || []
    const myMap = Object.fromEntries(savedMy.map(p => [p.id, p]))
    const mergedMy = players.map(p => {
      const saved = myMap[p.id]
      return saved
        ? { id: p.id, name: p.name, jerseyNumber: p.jersey_number, onField: saved.onField, x: saved.x, y: saved.y, fromFormation: false }
        : { id: p.id, name: p.name, jerseyNumber: p.jersey_number, onField: false, x: 50, y: 50, fromFormation: false }
    })
    const savedOpp = row.opp_players || []
    // If no opp players stored, create default bench players
    const oppPs = savedOpp.length > 0
      ? savedOpp
      : buildDefaultOppBench(getDefaultOppCount())
    return {
      myPlayers:  mergedMy,
      oppPlayers: oppPs,
      arrows:     (row.arrows || []).map(normalizeArrow).filter(Boolean),
    }
  }

  // ── Load sketches ──────────────────────────────────────────────
  useEffect(() => {
    if (team?.id) {
      loadSketches()
    } else {
      // No team yet — run in local demo mode so new users can try the board.
      // Nothing persists (all ids stay `local-`); creating a team starts fresh.
      const initState = buildInitialState()
      const localId = `local-${Date.now()}`
      setSketches([{ id: localId, name: 'Sketch 1' }])
      setSketchStates({ [localId]: initState })
      setActiveSketchId(localId)
      setLoading(false)
    }
  }, [team?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSketches() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('strategy_sketches').select('*')
        .eq('team_id', team.id).order('created_at', { ascending: true })

      if (error) throw error

      // Pre-populate my formation from GD Q1 plan
      const gdQ1FormId = gdPlanStates?.[gdActivePlanId]?.quarters?.[1]?.formation?.id || null

      if (!data || data.length === 0) {
        const initState = buildInitialState()
        const { data: newSketch } = await supabase.from('strategy_sketches')
          .insert({ team_id: team.id, name: 'Sketch 1', ...stateToDb(initState) })
          .select().single()
        if (newSketch) {
          setSketches([newSketch])
          setSketchStates({ [newSketch.id]: initState })
          setActiveSketchId(newSketch.id)
          if (gdQ1FormId) setMyFormationIds({ [newSketch.id]: gdQ1FormId })
        }
      } else {
        setSketches(data)
        const states = {}
        data.forEach(s => { states[s.id] = dbToState(s) })
        setSketchStates(states)
        setActiveSketchId(data[0].id)
        if (gdQ1FormId) {
          const initMyForms = {}
          data.forEach(s => { initMyForms[s.id] = gdQ1FormId })
          setMyFormationIds(initMyForms)
        }
      }
    } catch {
      const initState = buildInitialState()
      const localId = `local-${Date.now()}`
      setSketches([{ id: localId, name: 'Sketch 1' }])
      setSketchStates({ [localId]: initState })
      setActiveSketchId(localId)
    }
    setLoading(false)
  }

  // ── Save ───────────────────────────────────────────────────────
  function scheduleSave(id) {
    const sid = id || activeSketchIdRef.current
    if (!sid || String(sid).startsWith('local-')) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const state = sketchStatesRef.current[sid]
      if (!state) return
      try {
        await supabase.from('strategy_sketches').update(stateToDb(state)).eq('id', sid)
      } catch { /* silent */ }
    }, 1200)
  }

  function updateSketch(updater) {
    const sid = activeSketchIdRef.current
    if (!sid) return
    setSketchStates(prev => ({ ...prev, [sid]: updater(prev[sid] || buildInitialState()) }))
  }

  // ── Sketch CRUD ────────────────────────────────────────────────
  async function handleCreateSketch() {
    const initState = buildInitialState()
    const blank = {
      ...initState,
      myPlayers:  initState.myPlayers.map(p => ({ ...p, onField: false })),
      oppPlayers: buildDefaultOppBench(getDefaultOppCount()),
    }
    const name   = `Sketch ${sketches.length + 1}`
    const tempId = `local-${Date.now()}`
    setSketches(prev => [...prev, { id: tempId, name }])
    setSketchStates(prev => ({ ...prev, [tempId]: blank }))
    setActiveSketchId(tempId)

    if (!team?.id) return  // demo mode — keep the sketch local, nothing to persist
    try {
      const { data } = await supabase.from('strategy_sketches')
        .insert({ team_id: team.id, name, ...stateToDb(blank) }).select().single()
      if (data) {
        setSketches(prev => prev.map(s => s.id === tempId ? data : s))
        setSketchStates(prev => {
          const s = prev[tempId]; const next = { ...prev, [data.id]: s }
          delete next[tempId]; return next
        })
        setActiveSketchId(cur => cur === tempId ? data.id : cur)
      }
    } catch { /* silent */ }
  }

  function commitRename(id) {
    const name = editingName.trim() || sketches.find(s => s.id === id)?.name || 'Sketch'
    setSketches(prev => prev.map(s => s.id === id ? { ...s, name } : s))
    setEditingTabId(null)
    if (!String(id).startsWith('local-')) {
      supabase.from('strategy_sketches').update({ name }).eq('id', id)
    }
  }

  async function handleDeleteSketch(id) {
    setConfirmDeleteId(null)
    if (sketches.length <= 1) return
    const remaining = sketches.filter(s => s.id !== id)
    setSketches(remaining)
    setSketchStates(prev => { const n = { ...prev }; delete n[id]; return n })
    if (id === activeSketchId) setActiveSketchId(remaining[0].id)
    if (!String(id).startsWith('local-')) {
      supabase.from('strategy_sketches').delete().eq('id', id)
    }
  }

  // ── Opponent formation handlers ────────────────────────────────
  function applyOppFormation(formationId) {
    const formation = getFormationById(formationId)
    if (!formation) return
    saveSnapshot()
    const newOppPlayers = buildOppPlayersFromFormation(formation)
    updateSketch(state => ({ ...state, oppPlayers: newOppPlayers }))
    setOppFormationIds(prev => ({ ...prev, [activeSketchId]: formationId }))
    scheduleSave()
  }

  function handleOppFormationChange(formationId) {
    if (!formationId) {
      // Return formation-placed players to bench; manually moved ones stay on field
      updateSketch(state => ({
        ...state,
        oppPlayers: state.oppPlayers.map(p => ({
          ...p,
          onField: p.fromFormation ? false : p.onField,
        })),
      }))
      setOppFormationIds(prev => ({ ...prev, [activeSketchId]: null }))
      scheduleSave()
      return
    }

    const anyOnField = oppPlayers.some(p => p.onField)
    const hasPrevFormation = !!oppFormationId

    if (anyOnField && hasPrevFormation && formationId !== oppFormationId) {
      setPendingOppFormId(formationId)
      return
    }

    applyOppFormation(formationId)
  }

  // ── My team formation handlers ─────────────────────────────────
  function applyMyFormation(formationId) {
    const formation = getFormationById(formationId)
    if (!formation) return
    saveSnapshot()
    const newMyPlayers = buildMyPlayersFromFormation(formation, players)
    updateSketch(state => ({ ...state, myPlayers: newMyPlayers }))
    setMyFormationIds(prev => ({ ...prev, [activeSketchId]: formationId }))
    scheduleSave()
  }

  function handleMyFormationChange(formationId) {
    if (!formationId) {
      // Return formation-placed players to bench; manually moved ones stay on field
      updateSketch(state => ({
        ...state,
        myPlayers: state.myPlayers.map(p => ({
          ...p,
          onField: p.fromFormation ? false : p.onField,
        })),
      }))
      setMyFormationIds(prev => ({ ...prev, [activeSketchId]: null }))
      scheduleSave()
      return
    }

    const anyOnField = myPlayers.some(p => p.onField)
    const hasPrevFormation = !!myFormationId

    if (anyOnField && hasPrevFormation && formationId !== myFormationId) {
      setPendingMyFormId(formationId)
      return
    }

    applyMyFormation(formationId)
  }

  // ── Interaction handlers ───────────────────────────────────────
  function onPlayerPointerDown(e, playerType, playerId) {
    e.stopPropagation()
    e.preventDefault()
    const elRect = e.currentTarget.getBoundingClientRect()
    const key    = playerType === 'my' ? 'myPlayers' : 'oppPlayers'
    const origin = sketchStatesRef.current[activeSketchIdRef.current]?.[key]?.find(p => p.id === playerId)
    dragLastRef.current = null
    setInteraction({
      type:          'dragging',
      playerType,
      playerId,
      offsetX:       e.clientX - (elRect.left + elRect.width  / 2),
      offsetY:       e.clientY - (elRect.top  + elRect.height / 2),
      startClientX:  e.clientX,
      startClientY:  e.clientY,
      moved:         false,
      isTouch:       e.pointerType !== 'mouse',
      originOnField: !!origin?.onField,
      originX:       origin?.x ?? 50,
      originY:       origin?.y ?? 50,
    })
  }

  function onFieldPointerDown(e) {
    if (interactionRef.current) return
    const r = fieldRef.current?.getBoundingClientRect()
    if (!r) return
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width)  * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top)  / r.height) * 100))
    setInteraction({ type: 'drawing', points: [{ x, y }], color: drawColor })
  }

  // ── Toolbar actions ────────────────────────────────────────────
  function handleDeleteArrow() {
    if (!selectedArrowId) return
    saveSnapshot()
    updateSketch(state => ({ ...state, arrows: state.arrows.filter(a => a.id !== selectedArrowId) }))
    setSelectedArrowId(null)
    scheduleSave()
  }

  function handleClearArrows() {
    saveSnapshot()
    updateSketch(state => ({ ...state, arrows: [] }))
    setSelectedArrowId(null)
    scheduleSave()
  }

  function handleLoadQuarter(q) {
    saveSnapshot()
    const gdQFormId = gdPlanStates?.[gdActivePlanId]?.quarters?.[q]?.formation?.id || null
    updateSketch(state => ({ ...state, myPlayers: buildMyPlayers(players, gdPlanStates, gdActivePlanId, q) }))
    if (gdQFormId) setMyFormationIds(prev => ({ ...prev, [activeSketchId]: gdQFormId }))
    scheduleSave()
  }

  function handleResetPositions() {
    saveSnapshot()
    updateSketch(state => ({
      ...state,
      myPlayers:  state.myPlayers.map(p  => ({ ...p, onField: false, fromFormation: false })),
      oppPlayers: state.oppPlayers.map(p => ({ ...p, onField: false, fromFormation: false })),
    }))
    scheduleSave()
  }

  // ── Render guards ──────────────────────────────────────────────
  if (loading) {
    return (
      <SketchErrorBoundary>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f0c' }}>
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: 'var(--team-primary, #1a5c2e)', borderTopColor: 'transparent' }} />
        </div>
      </SketchErrorBoundary>
    )
  }


  // While a drag is in progress the player is "picked up": hidden from its bench
  // slot / field spot and shown as a floating ghost at the cursor instead.
  const dragging   = interaction?.type === 'dragging' && interaction.moved ? interaction : null
  const dragId     = dragging?.playerId ?? null
  const dragType   = dragging?.playerType ?? null
  const dragPlayer = dragging
    ? (dragType === 'my' ? myPlayers : oppPlayers).find(p => p.id === dragId)
    : null

  const oppBenchPlayers = oppPlayers.filter(p => !p.onField && !(dragType === 'opp' && p.id === dragId))
  const myBenchPlayers  = myPlayers.filter(p => !p.onField && !(dragType === 'my'  && p.id === dragId))

  const benchSelectStyle = {
    width: 90, height: circleSize,
    padding: '0 6px', fontSize: 12,
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, color: '#ffffff',
    cursor: 'pointer', outline: 'none', flexShrink: 0,
  }

  return (
    <SketchErrorBoundary>
    {/* Floating drag ghost — follows the cursor anywhere, unclipped by the field */}
    {dragging && dragPlayer && (
      <div style={{
        position: 'fixed',
        left: dragging.clientX - dragging.offsetX,
        top:  dragging.clientY - dragging.offsetY,
        transform: 'translate(-50%, -50%)',
        zIndex: 99998, pointerEvents: 'none', opacity: 0.92,
      }}>
        <PlayerCircle
          p={dragPlayer}
          isOpp={dragType === 'opp'}
          color={dragType === 'opp' ? oppColor : myColor}
          textColor={dragType === 'opp' ? oppTextColor : myTextColor}
          size={circleSize}
          isSelected={false}
          onPointerDown={null}
        />
      </div>
    )}
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#0a0f0c', overflow: 'hidden' }}>

      {/* ══ Sketch tabs ══ */}
      <div style={{
        height: 32, flexShrink: 0, display: 'flex', alignItems: 'stretch',
        background: '#0d1117', borderBottom: '1px solid #1f2937',
        overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none',
      }}>
        {sketches.map(s => {
          const isActive = s.id === activeSketchId
          return (
            <div key={s.id} style={{
              position: 'relative', display: 'flex', alignItems: 'stretch',
              flexShrink: 0, minWidth: 80, maxWidth: 160,
              borderRight: '1px solid #1f2937',
              borderBottom: isActive ? `2px solid ${myColor}` : '2px solid transparent',
              background: isActive ? '#161d2a' : 'transparent',
            }}>
              {editingTabId === s.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={() => commitRename(s.id)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setEditingTabId(null) }}
                  style={{ flex: 1, minWidth: 0, padding: '0 4px 0 8px', fontSize: 11, color: '#e5e7eb', background: '#1f2937', border: 'none', outline: 'none' }}
                />
              ) : (
                <button
                  onClick={() => setActiveSketchId(s.id)}
                  onDoubleClick={() => { setEditingTabId(s.id); setEditingName(s.name) }}
                  onTouchStart={() => {
                    const timer = setTimeout(() => {
                      setEditingTabId(s.id);
                      setEditingName(s.name);
                    }, 600);
                    s._pressTimer = timer;
                  }}
                  onTouchEnd={() => { if (s._pressTimer) clearTimeout(s._pressTimer); }}
                  onTouchMove={() => { if (s._pressTimer) clearTimeout(s._pressTimer); }}
                  style={{
                    flex: 1, minWidth: 0, padding: '0 4px 0 8px',
                    fontSize: 11, fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#e5e7eb' : '#9ca3af',
                    textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    cursor: 'pointer', background: 'none', border: 'none',
                  }}
                  title={`${s.name} (double-click to rename)`}
                >
                  {s.name}
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); setConfirmDeleteId(s.id) }}
                style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4b5563')}
              >✕</button>
            </div>
          )
        })}
        <button
          onClick={handleCreateSketch}
          style={{ flexShrink: 0, width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 300, color: '#6b7280', cursor: 'pointer', background: 'none', border: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#e5e7eb')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          title="New sketch"
        >+</button>
      </div>

      {/* Hint for renaming */}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', paddingLeft: 2, paddingBottom: 4 }}>
        Double-tap or long-press a tab to rename
      </div>

      {/* Delete confirmation bar */}
      {confirmDeleteId && (
        <div style={{ height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: '#1a0a0a', borderBottom: '1px solid #3b1515' }}>
          <span style={{ flex: 1, fontSize: 12, color: '#f87171' }}>
            Delete "{sketches.find(s => s.id === confirmDeleteId)?.name}"?
          </span>
          <button onClick={() => handleDeleteSketch(confirmDeleteId)} style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 5, background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', cursor: 'pointer' }}>Delete</button>
          <button onClick={() => setConfirmDeleteId(null)}            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'none', color: '#9ca3af', border: '1px solid #374151', cursor: 'pointer' }}>Cancel</button>
        </div>
      )}

      {/* My formation change confirmation bar */}
      {pendingMyFormId && (
        <div style={{ height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: '#0d1a0d', borderBottom: '1px solid rgba(220,150,50,0.3)' }}>
          <span style={{ flex: 1, fontSize: 12, color: '#fbbf24' }}>
            Reset my players to {formationList.find(f => f.id === pendingMyFormId)?.label}?
          </span>
          <button
            onClick={() => { applyMyFormation(pendingMyFormId); setPendingMyFormId(null) }}
            style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 5, background: 'rgba(220,150,50,0.2)', color: '#fbbf24', border: '1px solid rgba(220,150,50,0.4)', cursor: 'pointer' }}
          >Reset</button>
          <button
            onClick={() => setPendingMyFormId(null)}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'none', color: '#9ca3af', border: '1px solid #374151', cursor: 'pointer' }}
          >Keep current</button>
        </div>
      )}

      {/* Opponent formation change confirmation bar */}
      {pendingOppFormId && (
        <div style={{ height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: '#0d1a0d', borderBottom: '1px solid rgba(220,150,50,0.3)' }}>
          <span style={{ flex: 1, fontSize: 12, color: '#fbbf24' }}>
            Reset opponent positions to {formationList.find(f => f.id === pendingOppFormId)?.label}?
          </span>
          <button
            onClick={() => { applyOppFormation(pendingOppFormId); setPendingOppFormId(null) }}
            style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 5, background: 'rgba(220,150,50,0.2)', color: '#fbbf24', border: '1px solid rgba(220,150,50,0.4)', cursor: 'pointer' }}
          >Reset</button>
          <button
            onClick={() => setPendingOppFormId(null)}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'none', color: '#9ca3af', border: '1px solid #374151', cursor: 'pointer' }}
          >Keep current</button>
        </div>
      )}

      {/* ══ Toolbar ══ */}
      <div style={{
        height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
        gap: 6, padding: '0 10px',
        background: '#0d1117', borderBottom: '1px solid #1f2937',
      }}>
        {/* Arrow color swatches */}
        <div style={{ display: 'flex', gap: 4 }}>
          {Object.entries(ARROW_COLORS).map(([name, hex]) => (
            <button key={name} onClick={() => setDrawColor(name)} title={name}
              style={{
                width: 20, height: 20, borderRadius: '50%', background: hex,
                border: drawColor === name ? '2px solid #fff' : '2px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', flexShrink: 0,
              }}
            />
          ))}
        </div>

        {selectedArrowId && (
          <button onClick={handleDeleteArrow}
            style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 11, background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', cursor: 'pointer' }}>
            🗑 {isMobile ? '' : 'Del arrow'}
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Undo / Redo */}
        <button
          onClick={undo}
          disabled={history.length === 0}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          style={{
            height: 28, padding: '0 10px', borderRadius: 6,
            background: 'none',
            border: '1px solid rgba(255,255,255,0.15)',
            color: history.length === 0 ? 'rgba(255,255,255,0.35)' : '#fff',
            cursor: history.length === 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 14 4 9 9 4" />
            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
          </svg>
        </button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          aria-label="Redo"
          title="Redo (Ctrl+Y)"
          style={{
            height: 28, padding: '0 10px', borderRadius: 6,
            background: 'none',
            border: '1px solid rgba(255,255,255,0.15)',
            color: future.length === 0 ? 'rgba(255,255,255,0.35)' : '#fff',
            cursor: future.length === 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 14 20 9 15 4" />
            <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
          </svg>
        </button>

        {/* Utility buttons */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowLoadQMenu(s => !s)} title="Load a quarter lineup onto field"
            style={{ height: isMobile ? 36 : 28, padding: isMobile ? '0 14px' : '0 8px', borderRadius: 6, fontSize: isMobile ? 14 : 11, fontWeight: isMobile ? 600 : 400, background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid #374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {isMobile ? '↺Q' : '↺ Load Q'}
          </button>
          {showLoadQMenu && (
            <>
              <div onClick={() => setShowLoadQMenu(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, padding: 4, display: 'flex', gap: 4, zIndex: 50,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {[1, 2, 3, 4].map(q => (
                  <button key={q}
                    onClick={() => { handleLoadQuarter(q); setShowLoadQMenu(false) }}
                    style={{
                      height: 26, minWidth: 30, padding: '0 8px', borderRadius: 5,
                      fontSize: 11, fontWeight: 600,
                      background: 'rgba(255,255,255,0.06)',
                      color: '#d1d5db',
                      border: '1px solid #374151',
                      cursor: 'pointer',
                    }}
                  >
                    Q{q}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button onClick={handleClearArrows} title="Clear all arrows"
          style={{ height: isMobile ? 36 : 28, padding: isMobile ? '0 12px' : '0 10px', borderRadius: 6, fontSize: isMobile ? 13 : 11, fontWeight: 600, background: '#7f1d1d', color: '#fff', border: '1px solid #991b1b', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={isMobile ? 18 : 14} height={isMobile ? 18 : 14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3">
            <line x1="5" y1="19" x2="17" y2="7" />
            <polyline points="10 7 17 7 17 14" strokeDasharray="0" />
            <line x1="18" y1="18" x2="23" y2="23" strokeDasharray="0" strokeWidth="2.6" />
            <line x1="23" y1="18" x2="18" y2="23" strokeDasharray="0" strokeWidth="2.6" />
          </svg>
          {!isMobile && 'Arrows'}
        </button>
        <button onClick={handleResetPositions} title="Reset all players to bench"
          style={{ height: isMobile ? 36 : 28, padding: isMobile ? '0 12px' : '0 10px', borderRadius: 6, fontSize: isMobile ? 13 : 11, fontWeight: 600, background: '#581c87', color: '#fff', border: '1px solid #6b21a8', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={isMobile ? 18 : 14} height={isMobile ? 18 : 14} viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="6" stroke="none" />
            <line x1="18" y1="18" x2="23" y2="23" />
            <line x1="23" y1="18" x2="18" y2="23" />
          </svg>
          {!isMobile && 'Reset'}
        </button>
      </div>

      {/* ══ Opponent bench strip (top) ══ */}
      <div style={{
        height: benchH, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 10px', gap: 8,
        background: `${oppColor}10`,
        borderBottom: `1px solid ${oppColor}20`,
        overflowX: 'auto', overflowY: 'hidden',
      }}>
        {/* Opp formation dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}>Formation</span>
          <select
            value={oppFormationId || ''}
            onChange={e => handleOppFormationChange(e.target.value)}
            style={benchSelectStyle}
          >
            <option value="">Add full team</option>
            {formationList.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        {oppBenchPlayers.map(p => (
          <div key={p.id} style={{ flexShrink: 0, cursor: 'grab', touchAction: 'none' }}
            onPointerDown={e => onPlayerPointerDown(e, 'opp', p.id)}
          >
            <PlayerCircle p={p} isOpp color={oppColor} textColor={oppTextColor} size={circleSize} onPointerDown={null} />
          </div>
        ))}
        {oppBenchPlayers.length === 0 && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>all on field</span>
        )}
      </div>

      {/* ══ Field wrapper ══ */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: theme.fieldBg }}>

      <div
        ref={fieldRef}
        style={{
          aspectRatio: '68 / 105',
          width: `min(100%, calc((100dvh - 160px) * 68 / 105))`,
          height: 'auto',
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
          flexShrink: 0,
          cursor: interaction?.type === 'dragging' ? 'grabbing' : 'crosshair',
        }}
        onPointerDown={onFieldPointerDown}
        onPointerCancel={() => setInteraction(null)}
      >
        <SketchFieldSVG />

        <div style={{ position: 'absolute', top: 0,     left: 0, right: 0, height: '25%', background: theme.fieldZoneFwd, pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, height: '25%', background: theme.fieldZoneMid, pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '25%', background: theme.fieldZoneDef, pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, height: '25%', background: theme.fieldZoneGk,  pointerEvents: 'none', zIndex: 1 }} />

        <div style={{ position: 'absolute', top: 6,    left: 0, right: 0, textAlign: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.fieldLabel, pointerEvents: 'none', zIndex: 2 }}>OPPONENT</div>
        <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.fieldLabel, pointerEvents: 'none', zIndex: 2 }}>OUR GOAL</div>

        {/* Arrow SVG layer */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 5, overflow: 'visible', pointerEvents: 'none' }}>
          <defs>
            {Object.entries(ARROW_COLORS).map(([name, hex]) => (
              <marker key={name} id={`ah-${name}`} viewBox="0 0 10 10" refX="4" refY="5" markerWidth="3" markerHeight="3" orient="auto" markerUnits="strokeWidth">
                <path d="M2 1L8 5L2 9" fill="none" stroke={hex} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            ))}
          </defs>
          {arrows.map(a => (
            <polyline key={a.id}
              points={(a.points || []).map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={ARROW_COLORS[a.color] || '#fff'}
              strokeWidth={selectedArrowId === a.id ? '1.5' : '1'}
              strokeDasharray="6,3"
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={`url(#ah-${a.color || 'white'})`}
              opacity={selectedArrowId === a.id ? 1 : 0.8}
              filter={selectedArrowId === a.id ? 'drop-shadow(0 0 3px #fbbf24)' : undefined}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={() => setSelectedArrowId(prev => prev === a.id ? null : a.id)}
            />
          ))}
          {interaction?.type === 'drawing' && interaction.points.length > 1 && (
            <polyline
              points={interaction.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={ARROW_COLORS[interaction.color] || '#fff'}
              strokeWidth="1"
              strokeDasharray="6,3"
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={`url(#ah-${interaction.color || 'white'})`}
              opacity="0.7"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>

        {/* On-field players (the one being dragged is hidden — shown as a ghost) */}
        {[
          ...myPlayers.filter(p => p.onField).map(p   => ({ p, playerType: 'my'  })),
          ...oppPlayers.filter(p => p.onField).map(p  => ({ p, playerType: 'opp' })),
        ].filter(({ p, playerType }) => !(playerType === dragType && p.id === dragId)).map(({ p, playerType }) => (
          <div
            key={`${playerType}-${p.id}`}
            style={{
              position:    'absolute',
              left:        `${p.x}%`,
              top:         `${p.y}%`,
              transform:   'translate(-50%, -50%)',
              zIndex:      10,
              cursor:      interaction?.playerId === p.id ? 'grabbing' : 'grab',
              touchAction: 'none',
            }}
            onPointerDown={e => onPlayerPointerDown(e, playerType, p.id)}
          >
            <PlayerCircle
              p={p}
              isOpp={playerType === 'opp'}
              color={playerType === 'opp' ? oppColor : myColor}
              textColor={playerType === 'opp' ? oppTextColor : myTextColor}
              size={circleSize}
              isSelected={false}
              onPointerDown={null}
            />
          </div>
        ))}
      </div>
      </div>

      {/* ══ My team bench strip (bottom) ══ */}
      <div style={{
        height: benchH, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 10px', gap: 8,
        background: `${myColor}0d`,
        borderTop: `1px solid ${myColor}20`,
        overflowX: 'auto', overflowY: 'hidden',
      }}>
        {/* My formation dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}>Formation</span>
          <select
            value={myFormationId || ''}
            onChange={e => handleMyFormationChange(e.target.value)}
            style={benchSelectStyle}
          >
            <option value="">Add full team</option>
            {formationList.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        {myBenchPlayers.map(p => (
          <div key={p.id} style={{ flexShrink: 0, cursor: 'grab', touchAction: 'none' }}
            onPointerDown={e => onPlayerPointerDown(e, 'my', p.id)}
          >
            <PlayerCircle p={p} color={myColor} textColor={myTextColor} size={circleSize} onPointerDown={null} />
          </div>
        ))}
        {myBenchPlayers.length === 0 && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>all on field</span>
        )}
      </div>
    </div>
    </SketchErrorBoundary>
  )
}
