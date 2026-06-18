import { useState, useEffect, useRef } from 'react'
import { CATEGORY_META, PHASE_META } from '../../lib/drills'
import DrillLinks from './DrillLinks'

// ── SVG field diagrams ────────────────────────────────────────────
function Cone({ x, y, size = 7, color = '#f59e0b' }) {
  return (
    <polygon
      points={`${x},${y - size} ${x - size * 0.8},${y + size * 0.4} ${x + size * 0.8},${y + size * 0.4}`}
      fill={color}
    />
  )
}

function Player({ cx, cy, r = 9, color = '#4ade80', label }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.9} />
      {label && (
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 8, fill: '#fff', fontWeight: 700, pointerEvents: 'none' }}>
          {label}
        </text>
      )}
    </g>
  )
}

function Ball({ cx, cy }) {
  return <circle cx={cx} cy={cy} r={4} fill="#fff" opacity={0.85} />
}

function Arrow({ x1, y1, x2, y2, dashed = true, color = '#6ee7b7' }) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const ux = dx / len, uy = dy / len
  const ax = x2 - ux * 10, ay = y2 - uy * 10
  return (
    <g>
      <line x1={x1} y1={y1} x2={ax} y2={ay}
        stroke={color} strokeWidth={1.5}
        strokeDasharray={dashed ? '5,3' : undefined}
        markerEnd="url(#arrowhead)" />
    </g>
  )
}

function FieldBoundary({ x, y, w, h }) {
  return <rect x={x} y={y} width={w} height={h} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} rx={2} />
}

// ── Individual diagrams ───────────────────────────────────────────
const DIAGRAMS = {
  compass: () => (
    <svg viewBox="0 0 300 180" width="100%" style={{ display: 'block', borderRadius: 8 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6ee7b7" />
        </marker>
      </defs>
      <rect width="300" height="180" fill="#1a2e1a" rx="8" />
      <FieldBoundary x={20} y={15} w={260} h={150} />
      {/* Dashed arrows */}
      <Arrow x1={150} y1={87} x2={150} y2={35} />
      <Arrow x1={150} y1={93} x2={150} y2={145} />
      <Arrow x1={147} y1={90} x2={55} y2={90} />
      <Arrow x1={153} y1={90} x2={245} y2={90} />
      {/* Cones */}
      <Cone x={150} y={28} />
      <Cone x={150} y={152} />
      <Cone x={45}  y={90} />
      <Cone x={255} y={90} />
      {/* Labels */}
      <text x={150} y={18} textAnchor="middle" style={{ fill: '#9ca3af', fontSize: 10 }}>N</text>
      <text x={150} y={172} textAnchor="middle" style={{ fill: '#9ca3af', fontSize: 10 }}>S</text>
      <text x={31}  y={94} textAnchor="middle" style={{ fill: '#9ca3af', fontSize: 10 }}>W</text>
      <text x={270} y={94} textAnchor="middle" style={{ fill: '#9ca3af', fontSize: 10 }}>E</text>
      {/* Center player with ball */}
      <Player cx={150} cy={90} />
      <Ball cx={163} cy={83} />
    </svg>
  ),

  race: () => (
    <svg viewBox="0 0 300 180" width="100%" style={{ display: 'block', borderRadius: 8 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6ee7b7" />
        </marker>
      </defs>
      <rect width="300" height="180" fill="#1a2e1a" rx="8" />
      {/* Lane 1 */}
      <FieldBoundary x={20} y={20} w={120} h={140} />
      <Cone x={45}  y={50} /><Cone x={115} y={70} /><Cone x={45}  y={90} /><Cone x={115} y={110} /><Cone x={45}  y={130} />
      <Player cx={45} cy={152} color="#4ade80" />
      <Ball cx={57} cy={148} />
      <Arrow x1={55} y1={148} x2={115} y2={40} dashed={true} />
      {/* Lane 2 */}
      <FieldBoundary x={160} y={20} w={120} h={140} />
      <Cone x={185} y={50} /><Cone x={255} y={70} /><Cone x={185} y={90} /><Cone x={255} y={110} /><Cone x={185} y={130} />
      <Player cx={185} cy={152} color="#60a5fa" />
      <Ball cx={197} cy={148} />
      <Arrow x1={195} y1={148} x2={255} y2={40} dashed={true} />
      <text x={150} y={173} textAnchor="middle" style={{ fill: '#6b7280', fontSize: 9 }}>Race to end, back to start</text>
    </svg>
  ),

  cage: () => (
    <svg viewBox="0 0 300 180" width="100%" style={{ display: 'block', borderRadius: 8 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#f87171" />
        </marker>
      </defs>
      <rect width="300" height="180" fill="#1a2e1a" rx="8" />
      {/* Cage boundary */}
      <rect x={90} y={40} width={120} height={100} fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth={2} strokeDasharray="6,3" rx={2} />
      <text x={150} y={32} textAnchor="middle" style={{ fill: '#6366f1', fontSize: 9 }}>10 × 10 yds</text>
      {/* Player inside */}
      <Player cx={150} cy={90} color="#4ade80" label="A" />
      <Ball cx={163} cy={84} />
      {/* Outside defenders */}
      <Player cx={55} cy={90} color="#f87171" label="D" />
      <Player cx={245} cy={90} color="#f87171" label="D" />
      <Player cx={150} cy={158} color="#f87171" label="D" />
      {/* Pressure arrows */}
      <Arrow x1={68} y1={90} x2={88} y2={90} color="#f87171" dashed={false} />
      <Arrow x1={232} y1={90} x2={212} y2={90} color="#f87171" dashed={false} />
      <Arrow x1={150} y1={147} x2={150} y2={142} color="#f87171" dashed={false} />
    </svg>
  ),

  rondo: () => (
    <svg viewBox="0 0 300 180" width="100%" style={{ display: 'block', borderRadius: 8 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6ee7b7" />
        </marker>
      </defs>
      <rect width="300" height="180" fill="#1a2e1a" rx="8" />
      {/* Outer circle guide */}
      <circle cx={150} cy={90} r={70} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="4,4" />
      {/* Outer players (6) at clock positions */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const r = 70, rad = (deg - 90) * Math.PI / 180
        const cx = 150 + r * Math.cos(rad), cy = 90 + r * Math.sin(rad)
        return <Player key={i} cx={cx} cy={cy} color="#4ade80" />
      })}
      {/* Defenders in center */}
      <Player cx={135} cy={85} color="#f87171" label="D" />
      <Player cx={165} cy={95} color="#f87171" label="D" />
      {/* Pass arrow */}
      <Arrow x1={80} y1={55} x2={220} y2={55} />
      <Ball cx={82} cy={52} />
    </svg>
  ),

  'passing-gates': () => (
    <svg viewBox="0 0 300 180" width="100%" style={{ display: 'block', borderRadius: 8 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6ee7b7" />
        </marker>
      </defs>
      <rect width="300" height="180" fill="#1a2e1a" rx="8" />
      <FieldBoundary x={15} y={15} w={270} h={150} />
      {/* Scattered gates (pairs of cones) */}
      <Cone x={65}  y={45} /><Cone x={85}  y={45} />
      <Cone x={140} y={75} /><Cone x={160} y={75} />
      <Cone x={200} y={40} /><Cone x={220} y={40} />
      <Cone x={55}  y={130} /><Cone x={75}  y={130} />
      <Cone x={200} y={120} /><Cone x={220} y={120} />
      {/* Players and pass arrow */}
      <Player cx={45} cy={80} color="#4ade80" />
      <Ball cx={57} cy={76} />
      <Arrow x1={60} y1={76} x2={135} y2={76} />
      <Player cx={175} cy={76} color="#60a5fa" />
      <text x={150} y={170} textAnchor="middle" style={{ fill: '#6b7280', fontSize: 9 }}>Pass through any gate to score</text>
    </svg>
  ),

  'four-corners': () => (
    <svg viewBox="0 0 300 180" width="100%" style={{ display: 'block', borderRadius: 8 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6ee7b7" />
        </marker>
      </defs>
      <rect width="300" height="180" fill="#1a2e1a" rx="8" />
      <FieldBoundary x={30} y={20} w={240} h={140} />
      {/* Corner groups */}
      <Player cx={45}  cy={35}  color="#60a5fa" /><Player cx={58}  cy={35}  color="#60a5fa" />
      <Player cx={242} cy={35}  color="#60a5fa" /><Player cx={255} cy={35}  color="#60a5fa" />
      <Player cx={45}  cy={148} color="#60a5fa" /><Player cx={58}  cy={148} color="#60a5fa" />
      <Player cx={242} cy={148} color="#60a5fa" /><Player cx={255} cy={148} color="#60a5fa" />
      {/* Middle players */}
      <Player cx={130} cy={75}  color="#4ade80" />
      <Player cx={170} cy={75}  color="#4ade80" />
      <Player cx={130} cy={105} color="#4ade80" />
      <Player cx={170} cy={105} color="#4ade80" />
      {/* Pass arrows */}
      <Arrow x1={60}  y1={37}  x2={122} y2={74} />
      <Arrow x1={140} y1={74}  x2={60}  y2={37} dashed={false} color="rgba(110,231,183,0.4)" />
    </svg>
  ),

  'two-lines': () => (
    <svg viewBox="0 0 300 180" width="100%" style={{ display: 'block', borderRadius: 8 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6ee7b7" />
        </marker>
      </defs>
      <rect width="300" height="180" fill="#1a2e1a" rx="8" />
      {/* Line A */}
      <text x={50} y={22} textAnchor="middle" style={{ fill: '#6b7280', fontSize: 9 }}>Line A</text>
      <Player cx={50} cy={60}  color="#4ade80" />
      <Player cx={50} cy={85}  color="#4ade80" />
      <Player cx={50} cy={110} color="#4ade80" />
      <Player cx={50} cy={135} color="#4ade80" />
      <Ball cx={62} cy={57} />
      {/* Line B */}
      <text x={250} y={22} textAnchor="middle" style={{ fill: '#6b7280', fontSize: 9 }}>Line B</text>
      <Player cx={250} cy={60}  color="#60a5fa" />
      <Player cx={250} cy={85}  color="#60a5fa" />
      <Player cx={250} cy={110} color="#60a5fa" />
      <Player cx={250} cy={135} color="#60a5fa" />
      {/* Pass arrow */}
      <Arrow x1={65} y1={58} x2={238} y2={58} />
      {/* Player follows pass */}
      <Arrow x1={50} y1={72} x2={230} y2={72} color="rgba(110,231,183,0.4)" />
      <text x={150} y={90} textAnchor="middle" style={{ fill: '#6b7280', fontSize: 9 }}>Pass then follow</text>
    </svg>
  ),

  sharks: () => (
    <svg viewBox="0 0 300 180" width="100%" style={{ display: 'block', borderRadius: 8 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6ee7b7" />
        </marker>
      </defs>
      <rect width="300" height="180" fill="#1a2e1a" rx="8" />
      <FieldBoundary x={15} y={20} w={270} h={140} />
      {/* End line labels */}
      <text x={40}  y={16} textAnchor="middle" style={{ fill: '#4ade80', fontSize: 8 }}>START</text>
      <text x={265} y={16} textAnchor="middle" style={{ fill: '#4ade80', fontSize: 8 }}>END</text>
      {/* Minnows on left */}
      <Player cx={40} cy={60}  color="#4ade80" /><Ball cx={52} cy={57} />
      <Player cx={40} cy={90}  color="#4ade80" /><Ball cx={52} cy={87} />
      <Player cx={40} cy={120} color="#4ade80" /><Ball cx={52} cy={117} />
      {/* Sharks in middle */}
      <Player cx={150} cy={60}  color="#f87171" label="S" />
      <Player cx={150} cy={105} color="#f87171" label="S" />
      <Player cx={130} cy={140} color="#f87171" label="S" />
      <Player cx={175} cy={140} color="#f87171" label="S" />
      {/* Run arrows */}
      <Arrow x1={55} y1={58}  x2={270} y2={58} />
      <Arrow x1={55} y1={90}  x2={270} y2={90} />
      <Arrow x1={55} y1={120} x2={270} y2={120} />
    </svg>
  ),

  '1v1-goal': () => (
    <svg viewBox="0 0 300 180" width="100%" style={{ display: 'block', borderRadius: 8 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6ee7b7" />
        </marker>
      </defs>
      <rect width="300" height="180" fill="#1a2e1a" rx="8" />
      <FieldBoundary x={15} y={15} w={270} h={150} />
      {/* Goal */}
      <rect x={255} y={70} width={8} height={40} fill="none" stroke="white" strokeWidth={2} />
      <line x1={263} y1={70} x2={275} y2={70} stroke="white" strokeWidth={2} />
      <line x1={263} y1={110} x2={275} y2={110} stroke="white" strokeWidth={2} />
      <text x={270} y={90} textAnchor="middle" style={{ fill: '#6b7280', fontSize: 8 }}>GK</text>
      {/* Defender */}
      <Player cx={195} cy={90} color="#f87171" label="D" />
      {/* Attacker with ball */}
      <Player cx={90} cy={90} color="#4ade80" label="A" />
      <Ball cx={104} cy={86} />
      {/* Run arrow */}
      <Arrow x1={103} y1={86} x2={250} y2={80} />
      <text x={150} y={170} textAnchor="middle" style={{ fill: '#6b7280', fontSize: 9 }}>Beat defender, shoot early</text>
    </svg>
  ),

  'grid-dribble': () => (
    <svg viewBox="0 0 300 180" width="100%" style={{ display: 'block', borderRadius: 8 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6ee7b7" />
        </marker>
      </defs>
      <rect width="300" height="180" fill="#1a2e1a" rx="8" />
      <FieldBoundary x={15} y={15} w={270} h={150} />
      {/* Players scattered */}
      <Player cx={55}  cy={50}  color="#4ade80" /><Ball cx={67}  cy={46} />
      <Player cx={120} cy={45}  color="#4ade80" /><Ball cx={132} cy={41} />
      <Player cx={200} cy={55}  color="#4ade80" /><Ball cx={212} cy={51} />
      <Player cx={250} cy={90}  color="#4ade80" /><Ball cx={262} cy={86} />
      <Player cx={55}  cy={130} color="#4ade80" /><Ball cx={67}  cy={126} />
      <Player cx={140} cy={120} color="#4ade80" /><Ball cx={152} cy={116} />
      <Player cx={210} cy={140} color="#4ade80" /><Ball cx={222} cy={136} />
      <Player cx={90}  cy={90}  color="#4ade80" /><Ball cx={102} cy={86} />
      {/* Movement arrows */}
      <Arrow x1={68}  y1={48} x2={108} y2={48} />
      <Arrow x1={213} y1={53} x2={240} y2={83} />
      <Arrow x1={103} y1={88} x2={128} y2={115} />
    </svg>
  ),
}

// ── Main panel ────────────────────────────────────────────────────
/**
 * Props:
 *   drill      object   — library drill object (normalized)
 *   source     string   — 'library' | 'plan'
 *   teamId     string   — for DrillLinks component
 *   onClose    fn
 *   onAddToPlan fn|null — called with drill when "Add to Plan" clicked
 *   onEdit     fn|null  — called with drill when edit button clicked (custom drills only)
 */
export default function DrillDetailPanel({ drill, source, teamId, onClose, onAddToPlan, isInPlan, onEdit, onPrev, onNext, canPrev, canNext, navLabel }) {
  const panelRef = useRef(null)
  const [addedConfirmation, setAddedConfirmation] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)

  useEffect(() => { setAddedConfirmation(false); setVideoOpen(false) }, [drill.name, drill.id])

  // Escape closes; arrow keys navigate
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && canPrev) onPrev?.()
      if (e.key === 'ArrowRight' && canNext) onNext?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, canPrev, canNext, onPrev, onNext])

  // Prevent body scroll while panel is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const catMeta   = CATEGORY_META[drill.category] || { label: drill.category, color: '#6b7280' }
  const phaseMeta = PHASE_META[drill.phase]       || { label: drill.phase,    color: '#6b7280' }
  const DiagramComp = drill.diagram ? DIAGRAMS[drill.diagram] : null

  const isYT = url => /youtube\.com|youtu\.be/.test(url)
  const isIG = url => /instagram\.com/.test(url)
  const ytThumb = url => {
    const m = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([\w-]+)/)
    return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null
  }
  // Build a URL suitable for embedding inside an in-app player (no external title bar shown)
  const embedUrl = url => {
    const m = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([\w-]+)/)
    if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0`
    return url
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 200,
        }}
      />

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        style={{
          position:   'fixed',
          top:        0,
          right:      0,
          bottom:     0,
          width:      '100%',
          maxWidth:   420,
          background: '#111827',
          zIndex:     201,
          display:    'flex',
          flexDirection: 'column',
          boxShadow:  '-8px 0 32px rgba(0,0,0,0.6)',
          overflowY:  'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* ── Sticky header ── */}
        <div style={{
          position:     'sticky',
          top:          0,
          zIndex:       10,
          background:   '#111827',
          borderBottom: '1px solid #1f2937',
          padding:      '14px 16px 12px',
          flexShrink:   0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
                  {drill.name}
                </h2>
                {drill.isCustom && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                    border: '1px solid rgba(245,158,11,0.3)', flexShrink: 0,
                  }}>MY DRILL</span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  background: catMeta.color + '22', color: catMeta.color,
                }}>{catMeta.label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  background: phaseMeta.color + '22', color: phaseMeta.color,
                }}>{phaseMeta.label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  background: '#1f2937', color: '#9ca3af',
                }}>{drill.minDivision}+</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  background: '#1f2937', color: '#9ca3af',
                }}>{drill.duration} min</span>
                {drill.players && (
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 999,
                    background: '#1f2937', color: '#6b7280',
                  }}>{drill.players} players</span>
                )}
              </div>
            </div>
            {/* Edit button for custom drills */}
            {drill.isCustom && onEdit && (
              <button
                onClick={() => onEdit(drill)}
                style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
                  background: '#1f2937', border: 'none', color: '#9ca3af',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#374151'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1f2937'; e.currentTarget.style.color = '#9ca3af' }}
                title="Edit drill"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                flexShrink: 0, height: 36, padding: '0 16px', borderRadius: 999,
                background: '#7c3aed', border: 'none', color: '#fff',
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#6d28d9' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#7c3aed' }}
              title="Back"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>
          </div>
          {/* ── Nav row (arrows + position) ── */}
          {navLabel && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span
                onClick={() => canPrev && onPrev?.()}
                style={{ fontSize: 28, lineHeight: 1, padding: '0 4px', userSelect: 'none', color: canPrev ? 'rgba(255,255,255,0.5)' : 'transparent', cursor: canPrev ? 'pointer' : 'default' }}
              >‹</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{navLabel}</span>
              <span
                onClick={() => canNext && onNext?.()}
                style={{ fontSize: 28, lineHeight: 1, padding: '0 4px', userSelect: 'none', color: canNext ? 'rgba(255,255,255,0.5)' : 'transparent', cursor: canNext ? 'pointer' : 'default' }}
              >›</span>
            </div>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Custom drill image */}
          {drill.imageUrl && (
            <div style={{ borderRadius: 10, overflow: 'hidden' }}>
              <img
                src={drill.imageUrl}
                alt={drill.name}
                style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'cover' }}
              />
            </div>
          )}

          {/* Diagram */}
          {DiagramComp && (
            <div>
              <DiagramComp />
            </div>
          )}

          {/* Video link */}
          {drill.videoUrl && (() => {
            const ytId = drill.videoUrl.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([\w-]+)/)?.[1]
            if (ytId) {
              return (
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 10, overflow: 'hidden', textDecoration: 'none', position: 'relative' }}
                >
                  <img
                    src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                    alt="YouTube thumbnail"
                    style={{ width: '100%', display: 'block' }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.3)',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'rgba(255,0,0,0.9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 12 12" fill="white">
                        <polygon points="3,1 11,6 3,11" />
                      </svg>
                    </div>
                  </div>
                </button>
              )
            }
            return (
              <button
                type="button"
                onClick={() => setVideoOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer',
                  padding: '10px 14px', borderRadius: 10,
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--team-primary, #1a5c2e) 13%, transparent), #6366f122)',
                  border: '1px solid #6366f144', textDecoration: 'none',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--team-primary, #1a5c2e), #6366f1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                    <polygon points="3,1 11,6 3,11" />
                  </svg>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Watch video</div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>Watch drill video</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#6b7280" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              </button>
            )
          })()}

          {/* In-app video player overlay — keeps playback inside the app so no external site title is shown */}
          {videoOpen && (
            <div
              onClick={() => setVideoOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0,0,0,0.92)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setVideoOpen(false)}
                aria-label="Close video"
                style={{
                  position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: 16,
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
                  fontSize: 22, lineHeight: '40px', cursor: 'pointer',
                }}
              >
                ✕
              </button>
              <div
                onClick={e => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 900, aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', background: '#000' }}
              >
                <iframe
                  src={embedUrl(drill.videoUrl)}
                  title="Drill video"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <SectionLabel>How it works</SectionLabel>
            <p style={{ color: '#d1d5db', fontSize: 13, lineHeight: 1.65, margin: 0 }}>
              {drill.description}
            </p>
            {drill.equipment?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                {drill.equipment.map(eq => (
                  <span key={eq} style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 999,
                    background: '#1f2937', color: '#6b7280', border: '1px solid #374151',
                  }}>{eq}</span>
                ))}
              </div>
            )}
          </div>

          {/* Coaching Points */}
          {drill.coachingPoints?.length > 0 && (
            <div>
              <SectionLabel>Coaching points</SectionLabel>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {drill.coachingPoints.map((pt, i) => (
                  <li key={i} style={{ color: '#d1d5db', fontSize: 13, lineHeight: 1.5 }}>{pt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Variations */}
          {drill.variations?.length > 0 && (
            <div>
              <SectionLabel>Variations</SectionLabel>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {drill.variations.map((v, i) => (
                  <li key={i} style={{ color: '#9ca3af', fontSize: 12, lineHeight: 1.5 }}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Saved links */}
          <div>
            <SectionLabel>Video &amp; links</SectionLabel>
            <DrillLinks teamId={teamId} drillName={drill.name} color={catMeta.color} />
          </div>

        </div>

        {/* ── Sticky footer: Add to Plan ── */}
        {onAddToPlan && (
          <div style={{
            position:   'sticky',
            bottom:     0,
            background: '#111827',
            borderTop:  '1px solid #1f2937',
            padding:    '12px 16px',
            flexShrink: 0,
          }}>
            <button
              onClick={() => {
                onAddToPlan()
                setAddedConfirmation(true)
                setTimeout(() => setAddedConfirmation(false), 1500)
              }}
              style={{
                width: '100%', padding: '10px', borderRadius: 10, fontSize: 13,
                fontWeight: 700, color: '#fff', border: 'none', cursor: 'pointer',
                background: addedConfirmation
                  ? 'linear-gradient(135deg, #16a34a, #15803d)'
                  : 'linear-gradient(135deg, var(--team-primary, #1a5c2e), color-mix(in srgb, var(--team-primary, #1a5c2e) 80%, #000))',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {addedConfirmation ? '✓ Added!' : isInPlan ? '+ Add again' : '+ Add to Plan'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#4b5563',
      marginBottom: 8,
    }}>{children}</div>
  )
}
