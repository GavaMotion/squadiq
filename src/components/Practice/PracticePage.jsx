import { useState, useEffect, useRef, useMemo } from 'react'
import html2canvas from 'html2canvas'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../contexts/AppContext'
import {
  DRILLS, CATEGORY_META, CATEGORY_ORDER, PHASE_META,
  DIVISIONS_ORDER, matchesDivision,
} from '../../lib/drills'
import PlanTabs from '../GameDay/PlanTabs'
import DrillDetailPanel from './DrillDetailPanel'
import CustomDrillForm from './CustomDrillForm'
import { PracticeSkeleton } from '../UI/Skeleton'

// ── Tag border colors (per design spec) ──────────────────────────
const TAG_COLORS = {
  'warm-up':   '#EF9F27',
  dribbling:   '#185FA5',
  passing:     '#1D9E75',
  shooting:    '#E24B4A',
  defending:   '#534AB7',
  teamwork:    '#639922',
  'cool-down': '#888780',
}
function tagColor(cat) { return TAG_COLORS[cat] || '#6b7280' }

// ── AI plan generation ────────────────────────────────────────────
const FOCUS_CAT_IDS = ['dribbling', 'passing', 'shooting', 'defending', 'teamwork']
const PRESETS = [45, 60, 75, 90]

function generatePlan(totalMins, selectedCategories, teamDivision) {
  const usedIds   = new Set()
  const divFilter = d => matchesDivision(d, teamDivision || 'all')
  const catFilter = d => selectedCategories.length === 0 || selectedCategories.includes(d.category)
  function pickOne(primary, fallback) {
    const pool = DRILLS.filter(d => !usedIds.has(d.id) && primary.every(f => f(d)))
    if (pool.length) { const c = pool[Math.floor(Math.random() * pool.length)]; usedIds.add(c.id); return c }
    const fb = DRILLS.filter(d => !usedIds.has(d.id) && fallback.every(f => f(d)))
    if (!fb.length) return null
    const c = fb[Math.floor(Math.random() * fb.length)]; usedIds.add(c.id); return c
  }
  let used = 0; const plan = []
  const warmup = pickOne([d => d.phase === 'warm-up', catFilter, divFilter], [d => d.phase === 'warm-up', divFilter])
  if (warmup) { plan.push(warmup); used += warmup.duration }
  const game = pickOne([d => d.phase === 'small-sided-game', catFilter, divFilter], [d => d.phase === 'small-sided-game', divFilter])
  let budget = totalMins - used - (game ? game.duration : 0)
  let safety = 0
  while (budget > 0 && safety < 20) {
    safety++
    const next = pickOne(
      [d => d.phase === 'skill-work', catFilter, divFilter, d => d.duration <= budget],
      [d => d.phase === 'skill-work', divFilter, d => d.duration <= budget]
    )
    if (!next) break
    plan.push(next); used += next.duration; budget -= next.duration
  }
  let exceeds = false
  if (!plan.some(d => d.phase === 'skill-work')) {
    const forced = pickOne([d => d.phase === 'skill-work', catFilter, divFilter], [d => d.phase === 'skill-work', divFilter])
    if (forced) { plan.push(forced); used += forced.duration; exceeds = true }
  }
  if (game) { plan.push(game); used += game.duration }
  return { plan, usedMinutes: used, exceeds }
}

// ── Star icon ─────────────────────────────────────────────────────
function StarIcon({ filled, size = 14 }) {
  return filled ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#EF9F27" stroke="#EF9F27" strokeWidth="1.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

// ── AI Suggester panel ────────────────────────────────────────────
function SuggesterPanel({ teamDivision, onGenerate, onClose }) {
  const [preset, setPreset]       = useState(null)
  const [customVal, setCustomVal] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [focusCats, setFocusCats] = useState([])
  const [error, setError]         = useState('')
  const effectiveMins = useCustom ? (parseInt(customVal) || 0) : (preset ?? 0)
  const canGenerate   = effectiveMins >= 10

  function toggleCat(id) {
    setError('')
    setFocusCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }
  function handleGenerate() {
    if (!canGenerate) return
    const { plan, usedMinutes, exceeds } = generatePlan(effectiveMins, focusCats, teamDivision)
    if (!plan.length) { setError('No drills found — try a different selection.'); return }
    const focusLbl = focusCats.length ? focusCats.map(id => CATEGORY_META[id]?.label || id).join(' & ') : 'All Skills'
    const gap      = Math.abs(usedMinutes - effectiveMins)
    const note     = exceeds ? `Suggested — ${usedMinutes}m (slightly over) · ${focusLbl}`
      : gap <= 5 ? `Suggested — ${usedMinutes}m · ${focusLbl}`
      : `Suggested — ${usedMinutes}/${effectiveMins}m filled · ${focusLbl}`
    onGenerate(plan, note)
  }
  return (
    <div style={{ background: '#0d1117', borderBottom: '1px solid #1f2937', padding: '10px 12px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, flexShrink: 0 }}>Duration</span>
        {PRESETS.map(p => (
          <button key={p} onClick={() => { setPreset(p); setUseCustom(false); setCustomVal('') }}
            style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: !useCustom && preset === p ? 'var(--team-primary, #1a5c2e)' : '#1f2937',
              color:      !useCustom && preset === p ? '#fff' : '#9ca3af' }}>
            {p}m
          </button>
        ))}
        <input type="number" min="10" max="180" placeholder="other" value={customVal}
          onChange={e => { setCustomVal(e.target.value); setUseCustom(true); setPreset(null) }}
          onFocus={() => { setUseCustom(true); setPreset(null) }}
          style={{ width: 52, padding: '3px 6px', borderRadius: 6, fontSize: 11,
            background: useCustom ? 'rgba(26,92,46,0.15)' : '#1f2937',
            border: useCustom ? '1px solid var(--team-primary, #1a5c2e)' : '1px solid #374151',
            color: '#fff', outline: 'none' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, flexShrink: 0 }}>Focus</span>
        {FOCUS_CAT_IDS.map(id => {
          const active = focusCats.includes(id)
          const color  = CATEGORY_META[id]?.color || '#6b7280'
          return (
            <button key={id} onClick={() => toggleCat(id)}
              style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: active ? color + '33' : '#1f2937', color: active ? color : '#9ca3af',
                border: `1px solid ${active ? color : '#374151'}` }}>
              {CATEGORY_META[id]?.label}
            </button>
          )
        })}
      </div>
      {error && (
        <div style={{ marginBottom: 8, padding: '5px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', fontSize: 11, color: '#fca5a5' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={handleGenerate} disabled={!canGenerate}
          style={{ flex: 1, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none',
            background: canGenerate ? 'linear-gradient(135deg, var(--team-primary, #1a5c2e), #6366f1)' : '#374151',
            color: '#fff', cursor: canGenerate ? 'pointer' : 'not-allowed' }}>
          {canGenerate ? `Generate ${effectiveMins}m Plan` : 'Select Duration'}
        </button>
        <button onClick={onClose}
          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'transparent', color: '#9ca3af', border: '1px solid #374151', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── New plan modal ────────────────────────────────────────────────
function NewPlanModal({ onSave, onCancel }) {
  const defaultName = (() => { const d = new Date(); return `Practice — ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` })()
  const [name, setName] = useState(defaultName)
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onCancel}>
      <div className="rounded-2xl p-5 w-full max-w-sm shadow-2xl mx-4 mb-4 sm:mb-0"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-purple)' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-bold text-base mb-1">New Practice Plan</h3>
        <p className="text-gray-500 text-xs mb-4">Give this plan a name.</p>
        <form onSubmit={e => { e.preventDefault(); const t = name.trim(); if (t) onSave(t) }}>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full text-sm rounded-lg px-3 py-2.5 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-green-700 transition mb-4"
            autoFocus onFocus={e => e.target.select()} />
          <div className="flex gap-2">
            <button type="submit" disabled={!name.trim()} className="flex-1 text-sm font-semibold py-2.5 rounded-xl text-white transition"
              style={{ background: name.trim() ? 'var(--team-primary, #1a5c2e)' : '#374151', cursor: name.trim() ? 'pointer' : 'not-allowed' }}>
              Create
            </button>
            <button type="button" onClick={onCancel}
              className="flex-1 text-sm py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Drill tag ─────────────────────────────────────────────────────
function DrillTag({ drill, planDrillId, isPlan, isFavorite, onInfo, onFavorite, onRemove, onPointerDown, isDragging }) {
  const cat      = drill.category || drill.skill_category || ''
  const color    = tagColor(cat)
  const catMeta  = CATEGORY_META[cat] || { label: cat || 'Drill' }
  const name     = drill.name || drill.drill_name || ''
  const duration = drill.duration || drill.duration_minutes || 0

  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        width: '100%', minHeight: 52, boxSizing: 'border-box',
        borderRadius: 10, background: 'rgba(255,255,255,0.06)',
        border: `2px solid ${isDragging ? 'transparent' : color}`,
        padding: '8px 10px',
        display: 'flex', flexDirection: 'column', gap: 4,
        cursor: 'grab', touchAction: 'none', userSelect: 'none',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      {/* Line 1: name only — full width */}
      <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', width: '100%', lineHeight: 1.2 }}>
        {name}
      </div>
      {/* Line 2: dot + category · duration + icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ color, fontSize: 10, fontWeight: 500, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {catMeta.label} · {duration}m
        </span>
        <span
          onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
          onClick={e => { e.stopPropagation(); onInfo?.() }}
          style={{ fontSize: 28, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', lineHeight: 1, padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          ⓘ
        </span>
        <span
          onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
          onClick={e => { e.stopPropagation(); onFavorite?.() }}
          style={{ fontSize: 28, color: isFavorite ? '#EF9F27' : 'rgba(255,255,255,0.3)', cursor: 'pointer', lineHeight: 1, padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {isFavorite ? '★' : '☆'}
        </span>
        {isPlan && onRemove && (
          <span
            onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
            onClick={e => { e.stopPropagation(); onRemove() }}
            style={{ fontSize: 20, color: 'rgba(255,255,255,0.35)', cursor: 'pointer', lineHeight: 1, padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            ✕
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function PracticePage() {
  const {
    team, teamIdRef, dataLoaded,
    practicePlans: plans, setPracticePlans: setPlans,
    practiceActivePlanId: activePlanId, setPracticeActivePlanId: setActivePlanId,
    allPlanDrills, setAllPlanDrills,
    customDrills, addCustomDrill, updateCustomDrill, deleteCustomDrill,
    favoriteDrillNames, toggleFavorite,
  } = useApp()

  const loading = !dataLoaded

  // ── Plan management ──
  const [showNewPlanModal, setShowNewPlanModal] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [planNote, setPlanNote] = useState('')

  // ── Drag ──
  const [dragState, setDragState] = useState(null)
  const [overPlan, setOverPlan]   = useState(false)
  const ghostRef = useRef(null)

  // ── UI ──
  const [isWide, setIsWide]         = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)
  const [showSuggester, setShowSuggester] = useState(false)
  const [detailState, setDetailState]     = useState(null) // { drill, source, index, list }
  const [formDrill, setFormDrill]         = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [isExporting,    setIsExporting]    = useState(false)

  // ── Library filters ──
  const [filterCat, setFilterCat]   = useState('all')
  const [filterDiv, setFilterDiv]   = useState(() => team?.division || 'all')
  const [filterFavs, setFilterFavs] = useState(false)
  const [searchText, setSearchText] = useState('')

  // ── Refs ──
  const activePlanRef   = useRef(activePlanId)
  const reorderTimerRef = useRef(null)
  const planAreaRef     = useRef(null)
  const libraryAreaRef  = useRef(null)
  const isOverPlanRef   = useRef(false)
  const swipeStartX     = useRef(null)

  useEffect(() => { activePlanRef.current = activePlanId }, [activePlanId])
  useEffect(() => {
    const h = () => setIsWide(window.innerWidth >= 768)
    window.addEventListener('resize', h, { passive: true })
    return () => window.removeEventListener('resize', h)
  }, [])
  useEffect(() => { if (team?.division) setFilterDiv(team.division) }, [team?.division])

  useEffect(() => {
    console.log('Practice screen mounted / activePlanId changed:', activePlanId)
    console.log('allPlanDrills:', allPlanDrills)
  }, [activePlanId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const planDrills = (allPlanDrills && activePlanId) ? (allPlanDrills[activePlanId] || []) : []
  const totalMins  = useMemo(() => (planDrills || []).reduce((s, d) => s + (d?.duration_minutes || 0), 0), [planDrills])
  const totalLabel = totalMins >= 60
    ? `${Math.floor(totalMins / 60)}h${totalMins % 60 > 0 ? ` ${totalMins % 60}m` : ''}`
    : `${totalMins} min`

  const allDrills = useMemo(() => [...(DRILLS || []), ...(customDrills || [])], [customDrills])
  const visibleDrills = useMemo(() => (allDrills || []).filter(d => {
    if (!d) return false
    if (filterFavs && !favoriteDrillNames.has(d.name)) return false
    if (filterCat !== 'all' && d.category !== filterCat) return false
    if (!matchesDivision(d, filterDiv)) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      if (!d.name?.toLowerCase().includes(q) && !(CATEGORY_META[d.category]?.label || '').toLowerCase().includes(q)) return false
    }
    return true
  }), [allDrills, filterFavs, favoriteDrillNames, filterCat, filterDiv, searchText])

  const isMobile = !isWide

  // ── Native drag & drop ──
  function onDrillPointerDown(e, drill, source, planDrillId = null) {
    e.stopPropagation()
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    setDragState({
      drill, source, planDrillId,
      offsetX:  e.clientX - rect.left - rect.width  / 2,
      offsetY:  e.clientY - rect.top  - rect.height / 2,
      currentX: e.clientX,
      currentY: e.clientY,
    })
  }

  useEffect(() => {
    if (!dragState) return
    function onMove(e) {
      setDragState(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null)
    }
    function onUp(e) {
      console.log('=== POINTER UP FIRED ===')
      console.log('dragState at up:', dragState)
      if (ghostRef.current) ghostRef.current.style.display = 'none'
      handleDrillDrop(e, dragState)
      setDragState(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    console.log('Drag listeners attached')
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      console.log('Drag listeners removed')
    }
  }, [dragState]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDrillDrop(e, drag) {
    console.log('Drop fired:', e.clientX, e.clientY)
    console.log('activePlanId:', activePlanId)

    let isOverLibrary = false
    if (libraryAreaRef.current) {
      const rect = libraryAreaRef.current.getBoundingClientRect()
      isOverLibrary = (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom
      )
    }
    console.log('isOverLibrary:', isOverLibrary)

    if (isOverLibrary && drag.source === 'library') {
      console.log('Dropped back in library — ignoring')
      isOverPlanRef.current = false
      return
    }

    const currentPlanDrills = allPlanDrills[activePlanId] || []
    const newDrill = {
      id: crypto.randomUUID(),
      plan_id: activePlanId,
      drill_name: drag.drill.name || drag.drill.drill_name,
      drill_description: drag.drill.description || drag.drill.drill_description || null,
      skill_category: drag.drill.category || drag.drill.skill_category,
      duration_minutes: drag.drill.duration || drag.drill.duration_minutes,
      sort_order: currentPlanDrills.length,
      is_custom: drag.drill.isCustom || drag.drill.is_custom || false,
    }
    console.log('Adding drill:', newDrill.drill_name)
    setAllPlanDrills(prev => ({
      ...prev,
      [activePlanId]: [...(prev[activePlanId] || []), newDrill],
    }))
    // Save to Supabase (skip temp/local plan IDs)
    if (activePlanId && !String(activePlanId).startsWith('local-') && !String(activePlanId).startsWith('temp-')) {
      supabase.from('practice_plan_drills').insert({
        plan_id: newDrill.plan_id, drill_name: newDrill.drill_name,
        drill_description: newDrill.drill_description,
        skill_category: newDrill.skill_category, duration_minutes: newDrill.duration_minutes,
        sort_order: newDrill.sort_order, is_custom: newDrill.is_custom,
      }).then(({ error }) => { if (error) console.error('Supabase save error:', error) })
    }
    isOverPlanRef.current = false
  }

  // ── Plan mutations ──
  async function addDrillToPlan(drill) {
    const planId = activePlanRef.current
    if (!planId || String(planId).startsWith('local-')) return
    const tempId   = `temp-${Date.now()}`
    const existing = allPlanDrills[planId] || []
    const newEntry = {
      id: tempId, plan_id: planId,
      drill_name: drill.name, drill_description: null,
      skill_category: drill.category, duration_minutes: drill.duration,
      sort_order: existing.length, is_custom: drill.isCustom || false,
    }
    setAllPlanDrills(prev => ({ ...prev, [planId]: [...(prev[planId] || []), newEntry] }))
    setSaving(true)
    try {
      const { data } = await supabase.from('practice_plan_drills').insert({
        plan_id: planId, drill_name: drill.name, drill_description: null,
        skill_category: drill.category, duration_minutes: drill.duration,
        sort_order: existing.length, is_custom: drill.isCustom || false,
      }).select().single()
      if (data) setAllPlanDrills(prev => ({
        ...prev, [planId]: (prev[planId] || []).map(d => d.id === tempId ? data : d),
      }))
    } catch { /* silent */ } finally { setSaving(false) }
  }

  async function handleRemoveDrill(drillId) {
    const planId = activePlanRef.current
    setAllPlanDrills(prev => ({ ...prev, [planId]: (prev[planId] || []).filter(d => d.id !== drillId) }))
    if (!String(drillId).startsWith('temp-')) {
      supabase.from('practice_plan_drills').delete().eq('id', drillId)
    }
  }

  function reorderDrills(fromId, toId) {
    const planId = activePlanRef.current
    setAllPlanDrills(prev => {
      const drills  = [...(prev[planId] || [])]
      const fromIdx = drills.findIndex(d => d.id === fromId)
      const toIdx   = drills.findIndex(d => d.id === toId)
      if (fromIdx < 0 || toIdx < 0) return prev
      const [moved] = drills.splice(fromIdx, 1)
      drills.splice(toIdx, 0, moved)
      clearTimeout(reorderTimerRef.current)
      reorderTimerRef.current = setTimeout(() => {
        const real = drills.filter(d => !String(d.id).startsWith('temp-'))
        Promise.all(real.map((d, i) => supabase.from('practice_plan_drills').update({ sort_order: i }).eq('id', d.id)))
      }, 500)
      return { ...prev, [planId]: drills }
    })
  }

  // ── Plan CRUD ──
  function switchPlan(planId) {
    if (planId === activePlanRef.current) return
    setActivePlanId(planId)
    activePlanRef.current = planId
    setPlanNote('')
    try { localStorage.setItem(`practice-active-${teamIdRef.current}`, planId) } catch {}
  }

  async function handleCreatePlan(name) {
    setShowNewPlanModal(false)
    const tempId = `local-new-${Date.now()}`
    setPlans(prev => [...prev, { id: tempId, name }])
    setActivePlanId(tempId); activePlanRef.current = tempId
    setAllPlanDrills(prev => ({ ...prev, [tempId]: [] }))
    try {
      const { data } = await supabase.from('practice_plans').insert({ team_id: teamIdRef.current, name }).select().single()
      if (data) {
        setPlans(prev => prev.map(p => p.id === tempId ? data : p))
        setActivePlanId(cur => cur === tempId ? data.id : cur)
        if (activePlanRef.current === tempId) activePlanRef.current = data.id
        try { localStorage.setItem(`practice-active-${teamIdRef.current}`, data.id) } catch {}
        setAllPlanDrills(prev => { const n = { ...prev }; n[data.id] = n[tempId] || []; delete n[tempId]; return n })
      }
    } catch { /* silent */ }
  }

  function handleRenamePlan(planId, newName) {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, name: newName } : p))
    if (!String(planId).startsWith('local-')) supabase.from('practice_plans').update({ name: newName }).eq('id', planId)
  }

  async function handleDeletePlan(planId) {
    const remaining = plans.filter(p => p.id !== planId)
    setAllPlanDrills(prev => { const n = { ...prev }; delete n[planId]; return n })
    if (remaining.length === 0) {
      const tempId = `local-new-${Date.now()}`
      setPlans([{ id: tempId, name: 'Practice 1' }])
      setActivePlanId(tempId); activePlanRef.current = tempId
      setAllPlanDrills(prev => ({ ...prev, [tempId]: [] }))
      try {
        const { data } = await supabase.from('practice_plans').insert({ team_id: teamIdRef.current, name: 'Practice 1' }).select().single()
        if (data) {
          setPlans([data]); setActivePlanId(data.id); activePlanRef.current = data.id
          try { localStorage.setItem(`practice-active-${teamIdRef.current}`, data.id) } catch {}
          setAllPlanDrills(prev => { const n = { ...prev }; n[data.id] = n[tempId] || []; delete n[tempId]; return n })
        }
      } catch { /* silent */ }
      if (!String(planId).startsWith('local-')) supabase.from('practice_plans').delete().eq('id', planId)
      return
    }
    setPlans(prev => prev.filter(p => p.id !== planId))
    if (planId === activePlanRef.current) {
      const next = remaining[0]; setActivePlanId(next.id); activePlanRef.current = next.id
      try { localStorage.setItem(`practice-active-${teamIdRef.current}`, next.id) } catch {}
    }
    if (!String(planId).startsWith('local-')) supabase.from('practice_plans').delete().eq('id', planId)
  }

  async function handleDuplicatePlan(planId) {
    const orig    = plans.find(p => p.id === planId)
    const dupName = `Copy of ${orig?.name || 'Plan'}`
    const tempId  = `local-dup-${Date.now()}`
    setPlans(prev => [...prev, { id: tempId, name: dupName }])
    setActivePlanId(tempId); activePlanRef.current = tempId
    setAllPlanDrills(prev => ({ ...prev, [tempId]: [] }))
    let sourceDrills = allPlanDrills[planId] || []
    if (!sourceDrills.length && !String(planId).startsWith('local-')) {
      const { data } = await supabase.from('practice_plan_drills').select('*').eq('plan_id', planId).order('sort_order')
      sourceDrills = data || []
    }
    const { data: newPlan } = await supabase.from('practice_plans').insert({ team_id: teamIdRef.current, name: dupName }).select().single()
    if (!newPlan) return
    setPlans(prev => prev.map(p => p.id === tempId ? newPlan : p))
    setActivePlanId(cur => cur === tempId ? newPlan.id : cur)
    if (activePlanRef.current === tempId) activePlanRef.current = newPlan.id
    try { localStorage.setItem(`practice-active-${teamIdRef.current}`, newPlan.id) } catch {}
    let copied = []
    if (sourceDrills.length) {
      const toInsert = sourceDrills.map((d, i) => ({
        plan_id: newPlan.id, drill_name: d.drill_name, drill_description: d.drill_description,
        skill_category: d.skill_category, duration_minutes: d.duration_minutes,
        sort_order: i, is_custom: d.is_custom || false,
      }))
      const { data: inserted } = await supabase.from('practice_plan_drills').insert(toInsert).select()
      if (inserted) copied = inserted.sort((a, b) => a.sort_order - b.sort_order)
    }
    setAllPlanDrills(prev => { const n = { ...prev }; n[newPlan.id] = copied; delete n[tempId]; return n })
  }

  async function handleSetGeneratedPlan(generatedDrills, note) {
    const planId = activePlanRef.current
    if (!planId || !generatedDrills.length) return
    const drillsToSave = generatedDrills.map((d, i) => ({
      id: crypto.randomUUID(), plan_id: planId,
      drill_name: d.name, drill_description: d.description || null,
      skill_category: d.category, duration_minutes: d.duration,
      sort_order: i, is_custom: false,
    }))
    setAllPlanDrills(prev => ({ ...prev, [planId]: drillsToSave }))
    setPlanNote(note)
    setShowSuggester(false)
    if (String(planId).startsWith('local-')) return
    setSaving(true)
    try {
      await supabase.from('practice_plan_drills').delete().eq('plan_id', planId)
      await supabase.from('practice_plan_drills').insert(drillsToSave.map(({ id: _id, ...rest }) => rest))
    } catch { /* silent */ } finally { setSaving(false) }
  }

  function openDetailDrill(drillOrRow, source) {
    let drill = drillOrRow
    if (source === 'plan') {
      const found = DRILLS.find(d => d.name === drillOrRow.drill_name) || customDrills.find(d => d.name === drillOrRow.drill_name)
      drill = found || {
        id: drillOrRow.id, name: drillOrRow.drill_name, description: drillOrRow.drill_description || '',
        category: drillOrRow.skill_category, duration: drillOrRow.duration_minutes,
        phase: 'skill-work', coachingPoints: [], variations: [],
      }
    }
    const drillName = drill.name || drill.drill_name || ''
    let index = allDrills.findIndex(d => (d.name || d.drill_name || '') === drillName)
    if (index < 0) index = 0
    const normalizedDrill = { ...drill, name: drillName, drill_name: drillName }
    setDetailState({ drill: normalizedDrill, source, index, list: allDrills })
  }

  function addDrillFromDetail(drill) {
    const currentPlanDrills = allPlanDrills[activePlanId] || []
    const newDrill = {
      id: crypto.randomUUID(),
      plan_id: activePlanId,
      drill_name: drill.name || drill.drill_name,
      drill_description: drill.description || drill.drill_description || null,
      skill_category: drill.category || drill.skill_category,
      duration_minutes: drill.duration || drill.duration_minutes,
      sort_order: currentPlanDrills.length,
      is_custom: drill.isCustom || drill.is_custom || false,
    }
    setAllPlanDrills(prev => ({
      ...prev,
      [activePlanId]: [...(prev[activePlanId] || []), newDrill],
    }))
    if (activePlanId && !String(activePlanId).startsWith('local-') && !String(activePlanId).startsWith('temp-')) {
      supabase.from('practice_plan_drills').insert({
        plan_id: newDrill.plan_id, drill_name: newDrill.drill_name,
        drill_description: newDrill.drill_description,
        skill_category: newDrill.skill_category, duration_minutes: newDrill.duration_minutes,
        sort_order: newDrill.sort_order, is_custom: newDrill.is_custom,
      }).then(({ error }) => { if (error) console.error('Supabase save error:', error) })
    }
  }

  function goToNextDrill() {
    if (!detailState) return
    const nextIndex = detailState.index + 1
    if (nextIndex >= detailState.list.length) return
    const nextDrill = detailState.list[nextIndex]
    const drillName = nextDrill.name || nextDrill.drill_name || ''
    setDetailState(prev => ({
      ...prev,
      drill: { ...nextDrill, name: drillName, drill_name: drillName },
      index: nextIndex,
    }))
  }

  function goToPrevDrill() {
    if (!detailState) return
    const prevIndex = detailState.index - 1
    if (prevIndex < 0) return
    const prevDrill = detailState.list[prevIndex]
    const drillName = prevDrill.name || prevDrill.drill_name || ''
    setDetailState(prev => ({
      ...prev,
      drill: { ...prevDrill, name: drillName, drill_name: drillName },
      index: prevIndex,
    }))
  }

  function onDetailPointerDown(e) { swipeStartX.current = e.clientX }
  function onDetailPointerUp(e) {
    if (swipeStartX.current === null) return
    const dx = e.clientX - swipeStartX.current
    swipeStartX.current = null
    if (Math.abs(dx) < 50) return
    if (dx < 0) goToNextDrill()
    else goToPrevDrill()
  }

  // ── Share/export ──
  async function sharePracticePlan(format) {
    setShowShareSheet(false)
    setIsExporting(true)
    try {
      const el = document.getElementById('practice-export')
      el.style.left = '0'
      el.style.position = 'absolute'
      const canvas = await html2canvas(el, { backgroundColor: '#0d0d1a', scale: 2, useCORS: true, allowTaint: false, windowWidth: 800 })
      el.style.left = '-9999px'
      el.style.position = 'fixed'
      const activePlan = plans.find(p => p.id === activePlanId)
      const fileName = activePlan?.name || 'practice'
      if (format === 'image') {
        canvas.toBlob(async (blob) => {
          const file = new File([blob], `${fileName}.png`, { type: 'image/png' })
          if (navigator.share && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ title: fileName, files: [file] })
          } else {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `${fileName}.png`; a.click()
            URL.revokeObjectURL(url)
          }
        }, 'image/png')
      }
      if (format === 'pdf') {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
        const pdfBlob = pdf.output('blob')
        const file = new File([pdfBlob], `${fileName}.pdf`, { type: 'application/pdf' })
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: fileName, files: [file] })
        } else {
          pdf.save(`${fileName}.pdf`)
        }
      }
    } catch (err) { console.error('Export error:', err) }
    finally { setIsExporting(false) }
  }

  // ── Render guards ──
  if (loading) return <PracticeSkeleton />
  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 text-center" style={{ background: '#0d1117' }}>
        <p className="text-gray-400 text-lg">No team set up yet.</p>
      </div>
    )
  }

  const ghostW = isMobile ? 160 : 180
  const ghostH = isMobile ? 56  : 64

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#0d1117', overflow: 'hidden' }}>

      {/* Plan tabs */}
      <PlanTabs
        plans={plans} activePlanId={activePlanId} saving={saving}
        onSelect={switchPlan} onCreate={() => setShowNewPlanModal(true)}
        onDuplicate={handleDuplicatePlan} onDelete={handleDeletePlan} onRename={handleRenamePlan}
      />

      {/* Split content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isWide ? 'row' : 'column', overflow: 'hidden' }}>

        {/* ── LEFT: Plan area (60%) ── */}
        <div style={{ flex: isWide ? '0 0 60%' : 1, minHeight: isMobile ? '40%' : 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: isWide ? '1px solid #1f2937' : 'none', borderBottom: isMobile ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>

            {/* Plan header */}
            <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, background: '#111827', borderBottom: '1px solid #1f2937' }}>
              {isMobile && <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>MY PLAN</span>}
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>Total: {totalLabel}</span>
              {planNote && (
                <span style={{ flex: 1, fontSize: 11, color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {planNote}
                </span>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowSuggester(s => !s)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: showSuggester ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
                  color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)', cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Plan
              </button>
              <button onClick={() => setShowShareSheet(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                  background: 'none', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                Share
              </button>
            </div>

            {/* AI Suggester panel */}
            {showSuggester && (
              <SuggesterPanel
                teamDivision={team.division}
                onGenerate={handleSetGeneratedPlan}
                onClose={() => setShowSuggester(false)}
              />
            )}

            {/* Drop zone */}
            <div
              ref={planAreaRef}
              data-drop="plan"
              onPointerEnter={() => { isOverPlanRef.current = true; if (dragState) setOverPlan(true) }}
              onPointerLeave={() => { isOverPlanRef.current = false; setOverPlan(false) }}
              style={{
                flex: 1, minHeight: 200, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                touchAction: dragState ? 'none' : 'pan-y',
                padding: planDrills.length === 0 ? '12px' : '10px',
                background: overPlan && dragState ? 'rgba(0,200,83,0.08)' : 'transparent',
                border: overPlan && dragState ? '1px solid rgba(0,200,83,0.3)' : '1px solid transparent',
                transition: 'background 0.15s, border 0.15s',
              }}
            >
              {planDrills.length === 0 ? (
                <div data-drop="plan" style={{ height: '100%', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 12 }}>
                  <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 13, textAlign: 'center', padding: '0 16px' }}>
                    Drag drills here to build your plan
                  </p>
                </div>
              ) : (
                <div data-drop="plan" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, alignContent: 'start' }}>
                  {planDrills.map(d => {
                    const libDrill = DRILLS.find(ld => ld.name === d.drill_name) || customDrills.find(ld => ld.name === d.drill_name)
                    const drillForTag = {
                      name: d.drill_name, category: d.skill_category,
                      duration: d.duration_minutes, phase: libDrill?.phase || 'skill-work',
                      is_custom: d.is_custom,
                    }
                    return (
                      <div key={d.id} data-plan-drill-id={d.id}>
                        <DrillTag
                          drill={drillForTag}
                          planDrillId={d.id}
                          isPlan
                          isFavorite={favoriteDrillNames.has(d.drill_name)}
                          onInfo={() => openDetailDrill(d, 'plan')}
                          onFavorite={() => toggleFavorite(d.drill_name)}
                          onRemove={() => handleRemoveDrill(d.id)}
                          onPointerDown={e => onDrillPointerDown(e, drillForTag, 'plan', d.id)}
                          isDragging={dragState?.source === 'plan' && dragState?.planDrillId === d.id}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
        </div>

        {/* ── RIGHT: Library area (40%) ── */}
        <div ref={libraryAreaRef} style={{ flex: 1, minHeight: isMobile ? '40%' : 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d1117', minWidth: 0 }}>

            {/* Library filters */}
            <div style={{ flexShrink: 0, padding: '8px 10px', background: '#111827', borderBottom: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {isMobile && <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>DRILL LIBRARY</span>}
              {/* Row 1: search + age + favs + add drill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="search" placeholder="Search drills…" value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: 6, fontSize: 12,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', outline: 'none' }} />
                <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)}
                  style={{ height: 28, padding: '0 4px', fontSize: 11, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', cursor: 'pointer', outline: 'none', flexShrink: 0 }}>
                  <option value="all">All ages</option>
                  {DIVISIONS_ORDER.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button onClick={() => setFilterFavs(f => !f)}
                  style={{ height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                    background: filterFavs ? 'rgba(239,159,39,0.2)' : 'rgba(255,255,255,0.06)',
                    border: filterFavs ? '1px solid #EF9F27' : '1px solid rgba(255,255,255,0.15)' }}>
                  <StarIcon filled={filterFavs} size={14} />
                </button>
                <button onClick={() => setFormDrill('new')}
                  style={{ height: 28, padding: '0 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#9ca3af', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  + My drill
                </button>
              </div>
              {/* Row 2: category pills */}
              <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {[{ id: 'all', label: 'All' }, ...CATEGORY_ORDER.map(c => ({ id: c, label: CATEGORY_META[c]?.label || c }))].map(({ id, label }) => {
                  const active = filterCat === id
                  const color  = id === 'all' ? '#fff' : tagColor(id)
                  return (
                    <button key={id} onClick={() => setFilterCat(id === filterCat && id !== 'all' ? 'all' : id)}
                      style={{ flexShrink: 0, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: active ? (id === 'all' ? 'rgba(255,255,255,0.15)' : color + '33') : 'transparent',
                        color:      active ? color : '#6b7280',
                        border:     `1px solid ${active ? (id === 'all' ? 'rgba(255,255,255,0.3)' : color) : '#374151'}` }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom drill form */}
            {formDrill && (
              <CustomDrillForm
                initial={formDrill === 'new' ? null : formDrill}
                onSaved={() => setFormDrill(null)}
                onCancel={() => setFormDrill(null)}
              />
            )}

            {/* Confirm delete */}
            {confirmDeleteId && (
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#1a0a0a', borderBottom: '1px solid #3b1515' }}>
                <span style={{ flex: 1, fontSize: 12, color: '#f87171' }}>Delete this custom drill?</span>
                <button onClick={async () => {
                  try { await supabase.from('custom_drills').delete().eq('id', confirmDeleteId); deleteCustomDrill(confirmDeleteId) } catch {}
                  setConfirmDeleteId(null)
                }} style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 5, background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', cursor: 'pointer' }}>
                  Delete
                </button>
                <button onClick={() => setConfirmDeleteId(null)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'none', color: '#9ca3af', border: '1px solid #374151', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            )}

            {/* Drill list */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: '8px 10px', touchAction: dragState ? 'none' : 'pan-y' }}>
              {visibleDrills.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No drills match filters</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, alignContent: 'start' }}>
                  {visibleDrills.map(drill => (
                    <DrillTag
                      key={drill.id}
                      drill={drill}
                      isFavorite={favoriteDrillNames.has(drill.name)}
                      onInfo={() => openDetailDrill(drill, 'library')}
                      onFavorite={() => toggleFavorite(drill.name)}
                      onPointerDown={e => onDrillPointerDown(e, drill, 'library')}
                      isDragging={dragState?.source === 'library' && dragState?.drill?.id === drill.id}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Ghost tag during drag */}
      {dragState && (
        <div
          ref={ghostRef}
          style={{
            position: 'fixed',
            left:     dragState.currentX - dragState.offsetX - ghostW / 2,
            top:      dragState.currentY - dragState.offsetY - ghostH / 2,
            width:    ghostW, height: ghostH,
            pointerEvents: 'none', zIndex: 9999,
            opacity: 0.88, transform: 'scale(1.05) rotate(1.5deg)',
            borderRadius: 12, padding: '7px 10px', boxSizing: 'border-box',
            background: 'rgba(30,40,30,0.95)',
            border: `2px solid ${tagColor(dragState.drill.category || dragState.drill.skill_category)}`,
            boxShadow: '0 12px 40px rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}
        >
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dragState.drill.name || dragState.drill.drill_name}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
            <span style={{ color: tagColor(dragState.drill.category || dragState.drill.skill_category), fontWeight: 600 }}>
              {CATEGORY_META[dragState.drill.category || dragState.drill.skill_category]?.label}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>
              {dragState.drill.duration || dragState.drill.duration_minutes}m
            </span>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewPlanModal && (
        <NewPlanModal onSave={handleCreatePlan} onCancel={() => setShowNewPlanModal(false)} />
      )}

      {/* Share action sheet */}
      {showShareSheet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowShareSheet(false)}>
          <div style={{ background: '#1a1a2e', border: '1px solid rgba(0,200,83,0.25)', borderRadius: '16px 16px 0 0', padding: '20px 20px 32px', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Share Practice Plan</div>
            <button onClick={() => sharePracticePlan('image')} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(0,200,83,0.12)', border: '1px solid rgba(0,200,83,0.3)', color: '#00c853', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              📷 Save as image
            </button>
            <button onClick={() => sharePracticePlan('pdf')} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              📄 Export as PDF
            </button>
            <button onClick={() => setShowShareSheet(false)} style={{ padding: '10px', borderRadius: 10, background: 'none', border: '1px solid #374151', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hidden practice export layout */}
      {(() => {
        const activePlan = plans.find(p => p.id === activePlanId)
        return (
          <div id="practice-export" style={{ position: 'fixed', left: '-9999px', top: 0, width: 800, background: '#0d0d1a', padding: 32, fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: team?.color_primary || '#00c853',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: '#fff',
                }}>
                  {team?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{team?.name}</div>
                  <div style={{ color: '#00c853', fontSize: 12 }}>{activePlan?.name}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{new Date().toLocaleDateString()}</div>
                  <div style={{ color: '#00c853', fontSize: 13, fontWeight: 600 }}>Total: {totalMins} min</div>
                </div>
              </div>
            </div>
            {/* Drill list */}
            {planDrills.map((drill, index) => {
              const categoryColor  = tagColor(drill.skill_category)
              const drillName      = drill.drill_name || drill.name
              const description    = drill.drill_description || drill.description
              const coachingPoints = drill.coaching_points || []
              const variations     = drill.variations || []
              const videoUrl       = drill.video_url
              return (
                <div key={drill.id} style={{ marginBottom: 20, padding: '16px 18px', background: '#13131f', border: `1px solid ${categoryColor}40`, borderLeft: `4px solid ${categoryColor}`, borderRadius: 10, pageBreakInside: 'avoid' }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: categoryColor + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', color: categoryColor, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {index + 1}
                    </span>
                    <span style={{ color: '#fff', fontSize: 15, fontWeight: 700, flex: 1 }}>{drillName}</span>
                    <span style={{ fontSize: 10, color: categoryColor, fontWeight: 600, background: categoryColor + '20', padding: '2px 8px', borderRadius: 12 }}>
                      {drill.skill_category}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginLeft: 8 }}>{drill.duration_minutes} min</span>
                  </div>
                  {/* Description */}
                  {description && (
                    <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 1.7, marginBottom: 10 }}>{description}</div>
                  )}
                  {/* Coaching points */}
                  {coachingPoints.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ color: categoryColor, fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coaching points</div>
                      {coachingPoints.map((point, i) => (
                        <div key={i} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 4, paddingLeft: 12 }}>· {point}</div>
                      ))}
                    </div>
                  )}
                  {/* Variations */}
                  {variations.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Variations</div>
                      {variations.map((v, i) => (
                        <div key={i} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4, paddingLeft: 12 }}>· {v}</div>
                      ))}
                    </div>
                  )}
                  {/* Video link */}
                  {videoUrl && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ color: '#185FA5', fontSize: 11 }}>Watch drill video</span>
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ marginTop: 24, color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'center' }}>Created with CoachPad Tactix</div>
          </div>
        )
      })()}

      {/* Export loading overlay */}
      {isExporting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, flexDirection: 'column', gap: 12 }}>
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#00c853', borderTopColor: 'transparent' }} />
          <div style={{ color: '#fff', fontSize: 14 }}>Generating export…</div>
        </div>
      )}

      {/* Detail panel */}
      {detailState && (() => {
        const isInPlan = (allPlanDrills[activePlanId] || []).some(d =>
          (d.drill_name || d.name) === (detailState.drill.name || detailState.drill.drill_name)
        )
        return (
          <div
            onPointerDown={onDetailPointerDown}
            onPointerUp={onDetailPointerUp}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, touchAction: 'pan-y' }}
          >
            <DrillDetailPanel
              drill={detailState.drill}
              source={detailState.source}
              teamId={teamIdRef.current}
              onClose={() => setDetailState(null)}
              onAddToPlan={() => addDrillFromDetail(detailState.drill)}
              isInPlan={isInPlan}
              onEdit={detailState.drill.isCustom ? d => { setDetailState(null); setFormDrill(d) } : undefined}
              canPrev={detailState.index > 0}
              canNext={detailState.index < detailState.list.length - 1}
              onPrev={goToPrevDrill}
              onNext={goToNextDrill}
              navLabel={`${detailState.index + 1} of ${detailState.list.length}`}
            />
          </div>
        )
      })()}
    </div>
  )
}
