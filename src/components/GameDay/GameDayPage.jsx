import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import html2canvas from 'html2canvas'
import theme from '../../theme'
import { supabase } from '../../lib/supabase'
import { useApp, emptyPlan, buildBlankPlanState, planStateToQuarterData } from '../../contexts/AppContext'
import { useToast } from '../UI/Toast'
import {
  FORMATIONS_BY_DIVISION,
  getDefaultFormation,
  getFormationById,
} from '../../lib/formations'
import GameField from './GameField'
import FormationPicker from './FormationPicker'
import SavePlanModal from './SavePlanModal'
import PlayerTagGrid from './PlayerTagGrid'
import OutPanel from './OutPanel'
import PlanTabs from './PlanTabs'
import { LineupSkeleton } from '../UI/Skeleton'
import { generateAILineup } from '../../lib/aiLineup'

// ─── Pure local helpers ────────────────────────────────────────────
function blankQuarterData(formation) {
  const slots = emptyPlan(formation)
  const qd = {}
  for (const q of [1, 2, 3, 4]) qd[q] = { formationId: formation.id, slots: { ...slots } }
  return qd
}

// ─── Main component ───────────────────────────────────────────────
export default function GameDayPage() {
  const {
    team, players,
    teamRef, teamIdRef,
    dataLoaded, loadError,
    gdPlans:        plans,        setGdPlans:        setPlans,
    gdActivePlanId: activePlanId, setGdActivePlanId: setActivePlanId,
    gdPlanStates:   planStates,   setGdPlanStates:   setPlanStates,
    saveWithOfflineSupport,
  } = useApp()
  const { addToast } = useToast()

  const loading = !dataLoaded
  const error   = loadError

  const [showNewPlanModal, setShowNewPlanModal] = useState(false)
  const [viewedQuarter,   setViewedQuarterRaw] = useState(1)
  const [saving,          setSaving]           = useState(false)
  const [dragState,       setDragState]        = useState(null)
  const [hoverSlotId,     setHoverSlotId]      = useState(null)
  const [hoverDrop,       setHoverDrop]        = useState(null)
  const [toast,           setToast]            = useState(null)
  const [isWide,          setIsWide]           = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768
  )
  const [showShareSheet,  setShowShareSheet]  = useState(false)
  const [isExporting,     setIsExporting]     = useState(false)
  const [shakingPlayerId, setShakingPlayerId] = useState(null)
  const [deleteConfirm,   setDeleteConfirm]   = useState(null)
  const [showAILineup,     setShowAILineup]     = useState(false)
  const [aiQuarterMode,    setAIQuarterMode]    = useState('All 4')
  const [aiAbsentAll,      setAiAbsentAll]      = useState(new Set())
  const [aiAbsentQuarters, setAiAbsentQuarters] = useState({})

  function openAILineup() {
    setAiAbsentAll(new Set())
    setAiAbsentQuarters({})
    setShowAILineup(true)
  }

  const activePlanRef    = useRef(activePlanId)
  const planStatesRef    = useRef(planStates)
  const saveTimersRef    = useRef({})
  const dragRef          = useRef(null)
  const ghostRef         = useRef(null)
  const viewedQuarterRef = useRef(1)
  const handleDropRef    = useRef(null)
  const triggerShakeRef  = useRef(null)

  useEffect(() => { planStatesRef.current = planStates }, [planStates])
  useEffect(() => { viewedQuarterRef.current = viewedQuarter }, [viewedQuarter])
  // Keep activePlanRef in sync with context — ref is initialized at mount when
  // activePlanId is still null, so without this sync all scheduleSave() calls
  // read null and return early, meaning the plan is never written to Supabase.
  useEffect(() => { if (activePlanId) activePlanRef.current = activePlanId }, [activePlanId])

  // Auto-save whenever planStates changes (debounced via scheduleSave)
  useEffect(() => {
    if (activePlanId && !String(activePlanId).startsWith('local-')) {
      scheduleSave(activePlanId)
    }
  }, [planStates]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      const planId = activePlanRef.current
      if (planId && saveTimersRef.current[planId]) {
        clearTimeout(saveTimersRef.current[planId])
        doSavePlan(planId)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onResize() { setIsWide(window.innerWidth >= 768) }
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Window-level drag handlers (set up once, use refs) ──────────
  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current) return
      if (ghostRef.current) {
        const { ghostW, ghostH } = dragRef.current
        ghostRef.current.style.transform =
          `translate(${e.clientX - ghostW / 2}px, ${e.clientY - ghostH / 2}px)`
      }
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const slotEl = el?.closest('[data-slot-id]')
      if (slotEl) {
        setHoverSlotId(slotEl.dataset.slotId)
        setHoverDrop(null)
      } else {
        setHoverSlotId(null)
        const dropEl = el?.closest('[data-drop]')
        setHoverDrop(dropEl ? dropEl.dataset.drop : null)
      }
    }

    function onUp(e) {
      const ds = dragRef.current
      if (!ds) return

      // Hide ghost so elementFromPoint looks through it
      if (ghostRef.current) ghostRef.current.style.display = 'none'

      const el = document.elementFromPoint(e.clientX, e.clientY)
      const slotEl = el?.closest('[data-slot-id]')
      let dropTarget = null
      if (slotEl) {
        dropTarget = { type: 'slot', slotId: slotEl.dataset.slotId }
      } else {
        const dropEl = el?.closest('[data-drop]')
        if (dropEl) dropTarget = { type: dropEl.dataset.drop }
      }

      setDragState(null)
      dragRef.current = null
      setHoverSlotId(null)
      setHoverDrop(null)

      if (dropTarget) handleDropRef.current?.(ds, dropTarget)
      else            triggerShakeRef.current?.(ds.playerId)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-quarter state derivation ──────────────────────────────
  const activePlanState = planStates[activePlanId] || null
  const quarters        = activePlanState?.quarters || null
  const activeQState    = quarters?.[viewedQuarter]  || null
  const formation       = activeQState?.formation    || null
  const formationId     = activeQState?.formationId  || null
  const slots           = activeQState?.slots         || {}
  const outAllIds              = activePlanState?.outAllIds              || new Set()
  const outQIds                = activePlanState?.outQIds                || { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() }
  const outOfPositionByQuarter = activePlanState?.outOfPositionByQuarter || {}

  const playerMap     = useMemo(() => Object.fromEntries((players || []).map(p => [p.id, p])), [players])
  const formationList = team ? (FORMATIONS_BY_DIVISION[team.division] || []) : []

  useEffect(() => {
    console.log(`FIELD SLOTS Q${viewedQuarter}:`, JSON.stringify(slots), '| formation slots:', formation?.slots?.map(s => s.id))
  }, [slots, viewedQuarter]) // eslint-disable-line react-hooks/exhaustive-deps

  const quarterPlansForList = useMemo(() => ({
    1: quarters?.[1]?.slots || {},
    2: quarters?.[2]?.slots || {},
    3: quarters?.[3]?.slots || {},
    4: quarters?.[4]?.slots || {},
  }), [quarters])

  // ── Quarter switch — auto-copy prev if empty ─────────────────
  function setViewedQuarter(q) {
    setViewedQuarterRaw(q)
    if (q > 1 && quarters) {
      const curr = quarters[q]
      const prev = quarters[q - 1]
      const currEmpty   = !Object.values(curr?.slots || {}).some(Boolean)
      const prevHasData =  Object.values(prev?.slots || {}).some(Boolean)
      if (currEmpty && prevHasData) {
        updateActivePlanState(state => {
          const prevQ = state.quarters[q - 1]
          if (!prevQ) return state
          return {
            ...state,
            quarters: { ...state.quarters, [q]: { ...prevQ, slots: { ...prevQ.slots } } },
          }
        })
        scheduleSave()
      }
    }
  }

  // ─── Mutate active plan state ─────────────────────────────────
  function updateActivePlanState(updater) {
    const planId = activePlanRef.current
    if (!planId) return
    setPlanStates(prev => ({
      ...prev,
      [planId]: updater(prev[planId] || buildBlankPlanState(
        getFormationById(prev[planId]?.quarters?.[1]?.formationId)
          || getDefaultFormation(teamRef.current?.division || '')
      )),
    }))
  }

  // ─── Schedule debounced save ──────────────────────────────────
  function scheduleSave(planId) {
    const id = planId || activePlanRef.current
    if (!id) return
    clearTimeout(saveTimersRef.current[id])
    saveTimersRef.current[id] = setTimeout(() => doSavePlan(id), 1200)
  }

  // ─── Persist plan to Supabase ─────────────────────────────────
  const doSavePlan = useCallback(async (planId) => {
    if (!planId || String(planId).startsWith('local-')) return
    const state = planStatesRef.current[planId]
    if (!state) return
    const plan = plans.find(p => p.id === planId)
    const formationId = plan?.formation_id || state?.formationId || getDefaultFormation(teamRef.current?.division || '')?.id
    const planData = {
      id:             planId,
      team_id:        teamIdRef.current,
      quarter_data:   planStateToQuarterData(state),
      absent_players: [...(state.outAllIds || new Set())],
      formation_id:   formationId,
      updated_at:     new Date().toISOString(),
    }
    setSaving(true)
    try {
      const { ok, queued } = await saveWithOfflineSupport('saved_game_plans', 'upsert', planData, 'id', planId)
      if (queued)     addToast('Offline — changes will sync when reconnected', 'warning', 2000)
      else if (!ok)   throw new Error('save failed')
      // No toast on successful save — it saves silently
    } catch {
      addToast('Could not save game plan — changes may be lost', 'error')
    } finally {
      setSaving(false)
    }
  }, [plans, addToast, saveWithOfflineSupport, teamIdRef, teamRef])

  // ─── Switch plan ──────────────────────────────────────────────
  function switchPlan(planId) {
    if (planId === activePlanRef.current) return
    const prevId = activePlanRef.current
    if (prevId && saveTimersRef.current[prevId]) {
      clearTimeout(saveTimersRef.current[prevId])
      doSavePlan(prevId)
    }
    setActivePlanId(planId)
    activePlanRef.current = planId
    setViewedQuarterRaw(1)
    try { localStorage.setItem(`gameday-active-${teamIdRef.current}`, planId) } catch {}
  }

  // ─── Create plan ──────────────────────────────────────────────
  async function handleCreatePlan(name) {
    setShowNewPlanModal(false)
    const prevId = activePlanRef.current
    if (prevId) { clearTimeout(saveTimersRef.current[prevId]); doSavePlan(prevId) }

    const df        = getDefaultFormation(teamRef.current?.division || '')
    const tempId    = `local-new-${Date.now()}`
    const blankState = buildBlankPlanState(df)

    setPlans(prev => [...prev, { id: tempId, name, formation_id: df.id, quarter_data: {}, absent_players: [] }])
    setPlanStates(prev => ({ ...prev, [tempId]: blankState }))
    setActivePlanId(tempId)
    activePlanRef.current = tempId
    setViewedQuarterRaw(1)
    try { localStorage.setItem(`gameday-active-${teamIdRef.current}`, tempId) } catch {}

    const { data } = await supabase
      .from('saved_game_plans')
      .insert({
        team_id: teamIdRef.current, name,
        formation_id: df.id,
        quarter_data: planStateToQuarterData(blankState),
        absent_players: [],
      })
      .select().single()

    if (data) {
      setPlans(prev => prev.map(p => p.id === tempId ? data : p))
      setPlanStates(prev => {
        const s = prev[tempId]
        const next = { ...prev, [data.id]: s }
        delete next[tempId]
        return next
      })
      setActivePlanId(cur => cur === tempId ? data.id : cur)
      if (activePlanRef.current === tempId) activePlanRef.current = data.id
      try { localStorage.setItem(`gameday-active-${teamIdRef.current}`, data.id) } catch {}
    }
  }

  // ─── Duplicate plan ───────────────────────────────────────────
  async function handleDuplicatePlan(planId) {
    const prevId = activePlanRef.current
    if (prevId) { clearTimeout(saveTimersRef.current[prevId]); doSavePlan(prevId) }

    const orig     = plans.find(p => p.id === planId)
    const srcState = planStatesRef.current[planId]
    const dupName  = `Copy of ${orig?.name || 'Plan'}`
    const tempId   = `local-dup-${Date.now()}`
    const df       = getDefaultFormation(teamRef.current?.division || '')

    const dupState = srcState
      ? {
          ...srcState,
          outAllIds: new Set(srcState.outAllIds),
          outQIds:   {
            1: new Set(srcState.outQIds?.[1]),
            2: new Set(srcState.outQIds?.[2]),
            3: new Set(srcState.outQIds?.[3]),
            4: new Set(srcState.outQIds?.[4]),
          },
        }
      : buildBlankPlanState(df)

    setPlans(prev => [...prev, { id: tempId, name: dupName }])
    setPlanStates(prev => ({ ...prev, [tempId]: dupState }))
    setActivePlanId(tempId)
    activePlanRef.current = tempId
    setViewedQuarterRaw(1)

    const { data } = await supabase
      .from('saved_game_plans')
      .insert({
        team_id: teamIdRef.current,
        name: dupName,
        formation_id: dupState.quarters?.[1]?.formationId || df.id,
        quarter_data: planStateToQuarterData(dupState),
        absent_players: [...(dupState.outAllIds || new Set())],
      })
      .select().single()

    if (data) {
      setPlans(prev => prev.map(p => p.id === tempId ? data : p))
      setPlanStates(prev => {
        const s = prev[tempId]
        const next = { ...prev, [data.id]: s }
        delete next[tempId]
        return next
      })
      setActivePlanId(cur => cur === tempId ? data.id : cur)
      if (activePlanRef.current === tempId) activePlanRef.current = data.id
      try { localStorage.setItem(`gameday-active-${teamIdRef.current}`, data.id) } catch {}
      addToast('Plan duplicated', 'success', 1500)
    }
  }

  // ─── Rename plan ──────────────────────────────────────────────
  function handleRenamePlan(planId, newName) {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, name: newName } : p))
    if (!String(planId).startsWith('local-')) {
      supabase.from('saved_game_plans')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', planId)
    }
  }

  // ─── Delete plan ──────────────────────────────────────────────
  async function handleDeletePlan(planId) {
    clearTimeout(saveTimersRef.current[planId])
    const remaining = plans.filter(p => p.id !== planId)

    if (remaining.length === 0) {
      const df      = getDefaultFormation(teamRef.current?.division || '')
      const tempId  = `local-new-${Date.now()}`
      const blank   = buildBlankPlanState(df)

      setPlans([{ id: tempId, name: 'Game Plan 1' }])
      setPlanStates({ [tempId]: blank })
      setActivePlanId(tempId)
      activePlanRef.current = tempId
      setViewedQuarterRaw(1)

      try {
        const { data } = await supabase.from('saved_game_plans')
          .insert({
            team_id: teamIdRef.current, name: 'Game Plan 1',
            formation_id: df.id,
            quarter_data: planStateToQuarterData(blank),
            absent_players: [],
          })
          .select().single()
        if (data) {
          setPlans([data])
          setPlanStates(prev => {
            const s = prev[tempId]
            return { [data.id]: s }
          })
          setActivePlanId(data.id)
          activePlanRef.current = data.id
          try { localStorage.setItem(`gameday-active-${teamIdRef.current}`, data.id) } catch {}
        }
      } catch {}

      if (!String(planId).startsWith('local-')) {
        supabase.from('saved_game_plans').delete().eq('id', planId)
      }
      addToast('Plan deleted', 'success', 2000)
      return
    }

    setPlans(prev => prev.filter(p => p.id !== planId))
    setPlanStates(prev => { const next = { ...prev }; delete next[planId]; return next })

    if (planId === activePlanRef.current) {
      const next = remaining[0]
      setActivePlanId(next.id)
      activePlanRef.current = next.id
      setViewedQuarterRaw(1)
      try { localStorage.setItem(`gameday-active-${teamIdRef.current}`, next.id) } catch {}
    }
    if (!String(planId).startsWith('local-')) {
      supabase.from('saved_game_plans').delete().eq('id', planId)
    }
    addToast('Plan deleted', 'success', 2000)
  }

  // ─── Formation change ─────────────────────────────────────────
  function migrateQuarterPlan(oldPlan, oldSlots, newSlots) {
    const pool = {}
    for (const [slotId, playerId] of Object.entries(oldPlan)) {
      if (!playerId) continue
      const oldSlot = oldSlots.find(s => s.id === slotId)
      if (!oldSlot) continue
      if (!pool[oldSlot.label]) pool[oldSlot.label] = []
      pool[oldSlot.label].push(playerId)
    }
    const newPlan = {}
    for (const slot of newSlots) {
      const bucket = pool[slot.label]
      newPlan[slot.id] = (bucket && bucket.length) ? bucket.shift() : null
    }
    return newPlan
  }

  function handleFormationChange(newId) {
    const newForm = getFormationById(newId)
    if (!newForm) return
    let displaced = 0
    updateActivePlanState(state => {
      const qState   = state.quarters[viewedQuarter]
      const oldSlots = qState?.formation?.slots || []
      const oldPlan  = qState?.slots || {}
      const oldPlayers = new Set(Object.values(oldPlan).filter(Boolean))
      const migrated   = migrateQuarterPlan(oldPlan, oldSlots, newForm.slots)
      const newPlayers = new Set(Object.values(migrated).filter(Boolean))
      displaced = [...oldPlayers].filter(id => !newPlayers.has(id)).length
      return {
        ...state,
        quarters: {
          ...state.quarters,
          [viewedQuarter]: { formationId: newId, formation: newForm, slots: migrated },
        },
      }
    })
    if (displaced > 0) {
      setToast(`Formation updated — ${displaced} player${displaced > 1 ? 's' : ''} moved to bench`)
      setTimeout(() => setToast(null), 3500)
    }
    scheduleSave()
  }

  // ─── Field clear ─────────────────────────────────────────────
  function handleClearQuarter() {
    updateActivePlanState(state => {
      const qState = state.quarters[viewedQuarter]
      if (!qState) return state
      return {
        ...state,
        quarters: {
          ...state.quarters,
          [viewedQuarter]: { ...qState, slots: emptyPlan(qState.formation) },
        },
      }
    })
    scheduleSave()
  }

  // ─── OUT handlers ─────────────────────────────────────────────
  function handleOutAll(playerId) {
    updateActivePlanState(state => {
      const newOutAll = new Set(state.outAllIds)
      const newOutQ   = { 1: new Set(state.outQIds[1]), 2: new Set(state.outQIds[2]), 3: new Set(state.outQIds[3]), 4: new Set(state.outQIds[4]) }
      const newQuarters = {}
      for (const q of [1, 2, 3, 4]) {
        const qState = state.quarters[q]
        const newSlots = { ...qState.slots }
        for (const [sid, pid] of Object.entries(newSlots)) {
          if (pid === playerId) newSlots[sid] = null
        }
        newQuarters[q] = { ...qState, slots: newSlots }
        newOutQ[q].delete(playerId)
      }
      newOutAll.add(playerId)
      return { ...state, outAllIds: newOutAll, outQIds: newOutQ, quarters: newQuarters }
    })
    scheduleSave()
  }

  function handleOutQ(playerId, quarter) {
    updateActivePlanState(state => {
      const newOutAll = new Set(state.outAllIds)
      newOutAll.delete(playerId)
      const newOutQ = { 1: new Set(state.outQIds[1]), 2: new Set(state.outQIds[2]), 3: new Set(state.outQIds[3]), 4: new Set(state.outQIds[4]) }
      const qState   = state.quarters[quarter]
      const newSlots = { ...qState.slots }
      for (const [sid, pid] of Object.entries(newSlots)) {
        if (pid === playerId) newSlots[sid] = null
      }
      newOutQ[quarter].add(playerId)
      return {
        ...state,
        outAllIds: newOutAll,
        outQIds:   newOutQ,
        quarters:  { ...state.quarters, [quarter]: { ...qState, slots: newSlots } },
      }
    })
    scheduleSave()
  }

  function handleUnOutAll(playerId) {
    updateActivePlanState(state => {
      const newOutAll = new Set(state.outAllIds)
      newOutAll.delete(playerId)
      return { ...state, outAllIds: newOutAll }
    })
    scheduleSave()
  }

  function handleUnOutQ(playerId, quarter) {
    updateActivePlanState(state => {
      const newOutQ = { 1: new Set(state.outQIds[1]), 2: new Set(state.outQIds[2]), 3: new Set(state.outQIds[3]), 4: new Set(state.outQIds[4]) }
      newOutQ[quarter].delete(playerId)
      return { ...state, outQIds: newOutQ }
    })
    scheduleSave()
  }

  // ─── Drag start ───────────────────────────────────────────────
  function onDragStart(e, playerId, fromSource, fromSlot = null) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const player = playerMap[playerId]
    const ds = {
      playerId, fromSource, fromSlot, player,
      currentX: e.clientX, currentY: e.clientY,
      ghostW: rect.width, ghostH: rect.height,
    }
    setDragState(ds)
    dragRef.current = ds
  }

  // ─── Drop handler (called from window pointerup via ref) ──────
  function handleDrop(ds, dropTarget) {
    const { playerId, fromSource, fromSlot } = ds
    const vq = viewedQuarterRef.current

    if (dropTarget.type === 'slot') {
      const toSlot = dropTarget.slotId
      updateActivePlanState(state => {
        const newOutAll = new Set(state.outAllIds)
        const newOutQ   = { 1: new Set(state.outQIds[1]), 2: new Set(state.outQIds[2]), 3: new Set(state.outQIds[3]), 4: new Set(state.outQIds[4]) }
        if (fromSource === 'outall') newOutAll.delete(playerId)
        if (fromSource === 'outq')   newOutQ[vq].delete(playerId)

        const qState    = state.quarters[vq]
        const plan      = { ...qState.slots }
        const displaced = plan[toSlot] || null
        if (fromSource === 'field' && fromSlot && fromSlot !== 'bench') {
          plan[fromSlot] = displaced
        } else {
          for (const [sid, pid] of Object.entries(plan)) {
            if (pid === playerId && sid !== toSlot) { plan[sid] = null; break }
          }
        }
        plan[toSlot] = playerId
        return {
          ...state,
          outAllIds: newOutAll,
          outQIds:   newOutQ,
          quarters:  { ...state.quarters, [vq]: { ...qState, slots: plan } },
        }
      })
      scheduleSave()
      return
    }

    if (dropTarget.type === 'bench') {
      if (fromSource === 'outall') {
        handleUnOutAll(playerId)
      } else if (fromSource === 'outq') {
        handleUnOutQ(playerId, vq)
      } else if (fromSource === 'field' && fromSlot) {
        updateActivePlanState(state => {
          const qState = state.quarters[vq]
          const plan   = { ...qState.slots }
          plan[fromSlot] = null
          return { ...state, quarters: { ...state.quarters, [vq]: { ...qState, slots: plan } } }
        })
        scheduleSave()
      }
      return
    }

    if (dropTarget.type === 'out-all') {
      handleOutAll(playerId)
      return
    }

    if (dropTarget.type === 'out-quarter') {
      handleOutQ(playerId, vq)
      return
    }
  }

  // Keep drop handler and shake trigger ref current every render
  handleDropRef.current = handleDrop
  triggerShakeRef.current = (playerId) => {
    setShakingPlayerId(playerId)
    setTimeout(() => setShakingPlayerId(null), 400)
  }

  // ─── Export helpers ───────────────────────────────────────────
  function getSlotPos(slotId, formation) {
    return formation?.slots?.find(s => s.id === slotId) || null
  }

  function getOutPlayersForQuarter(q) {
    return players.filter(p => outAllIds.has(p.id) || outQIds[q]?.has(p.id))
  }

  function getAtRiskPlayers() {
    return players.filter(p => {
      if (outAllIds.has(p.id)) return false
      let played = 0
      for (const q of [1, 2, 3, 4]) {
        const inField = Object.values(quarters?.[q]?.slots || {}).includes(p.id)
        if (inField) played++
      }
      return played > 0 && played < 3
    })
  }

  async function shareGameDay(format) {
    setShowShareSheet(false)
    setIsExporting(true)
    try {
      const el = document.getElementById('gameday-export')
      el.style.left = '0'
      el.style.position = 'absolute'
      const canvas = await html2canvas(el, { backgroundColor: '#0d0d1a', scale: 2, useCORS: true, allowTaint: false })
      el.style.left = '-9999px'
      el.style.position = 'fixed'
      const fileName = `${team?.name || 'team'}-gameday`
      if (format === 'image') {
        canvas.toBlob(async (blob) => {
          const file = new File([blob], `${fileName}.png`, { type: 'image/png' })
          if (navigator.share && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ title: `${team?.name} Game Plan`, files: [file] })
          } else {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `${fileName}.png`; a.click()
            URL.revokeObjectURL(url)
          }
        }, 'image/png')
      }
      if (format === 'pdf') {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
        const pdfBlob = pdf.output('blob')
        const file = new File([pdfBlob], `${fileName}.pdf`, { type: 'application/pdf' })
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: `${team?.name} Game Plan`, files: [file] })
        } else {
          pdf.save(`${fileName}.pdf`)
        }
      }
    } catch (err) { console.error('Export error:', err) }
    finally { setIsExporting(false) }
  }

  // ─── AI Lineup ───────────────────────────────────────────────
  function handleGenerateAILineup() {
    console.log('HANDLE GENERATE CALLED', { players: players?.length, formation })
    const currentFormation = formation || getFormationById(
      planStates[activePlanId]?.quarters?.[viewedQuarter]?.formationId
    )
    if (!currentFormation) {
      addToast('Please select a formation first', 'warning')
      return
    }

    const existingAbsent = new Set(planStates[activePlanId]?.outAllIds || [])
    const allAbsentIds   = new Set([...existingAbsent, ...aiAbsentAll])
    const quartersToGenerate = aiQuarterMode === 'All 4'
      ? [1, 2, 3, 4]
      : [parseInt(aiQuarterMode.replace('Q', '').replace(' only', ''))]

    const { lineup, warnings, outOfPosition } = generateAILineup({
      players,
      absentPlayerIds: allAbsentIds,
      absentQuarters:  aiAbsentQuarters,
      formation: currentFormation,
      quarters: quartersToGenerate,
    })

    console.log('LINEUP TO APPLY:', JSON.stringify(lineup))

    setPlanStates(prev => {
      const current = prev[activePlanId] || {}
      const updatedQuarters = { ...(current.quarters || {}) }
      for (const q of quartersToGenerate) {
        updatedQuarters[q] = { ...updatedQuarters[q], slots: lineup[q] || {} }
      }

      const outOfPositionByQuarter = quartersToGenerate.reduce((acc, q) => {
        acc[q] = new Set(
          outOfPosition.filter(o => o.quarter === q).map(o => o.playerId).filter(Boolean)
        )
        return acc
      }, {})

      const newState = {
        ...prev,
        [activePlanId]: {
          ...current,
          quarters: updatedQuarters,
          outAllIds: new Set([...existingAbsent, ...aiAbsentAll]),
          outQIds: {
            1: new Set(Object.entries(aiAbsentQuarters).filter(([, qs]) => qs.includes(1)).map(([id]) => id)),
            2: new Set(Object.entries(aiAbsentQuarters).filter(([, qs]) => qs.includes(2)).map(([id]) => id)),
            3: new Set(Object.entries(aiAbsentQuarters).filter(([, qs]) => qs.includes(3)).map(([id]) => id)),
            4: new Set(Object.entries(aiAbsentQuarters).filter(([, qs]) => qs.includes(4)).map(([id]) => id)),
          },
          outOfPositionByQuarter,
        },
      }
      console.log('NEW PLAN STATE Q slots:', JSON.stringify(
        Object.fromEntries(quartersToGenerate.map(q => [q, newState[activePlanId].quarters[q]?.slots]))
      ))
      return newState
    })

    setShowAILineup(false)

    if (outOfPosition.length > 0) {
      const uniqueNames = [...new Set(outOfPosition.map(o => `#${o.jerseyNumber} ${o.playerName.split(' ')[0]}`))]
      const msg = uniqueNames.length === 1
        ? `⚠ ${uniqueNames[0]} placed out of position`
        : `⚠ ${uniqueNames.length} players placed out of position`
      addToast(msg, 'warning', 5000)
    } else if (warnings.length > 0) {
      addToast(`⚠ ${warnings[0]}`, 'warning', 4000)
    } else {
      addToast(
        `✨ Lineup generated for ${quartersToGenerate.length === 4 ? 'all 4 quarters' : `Q${quartersToGenerate[0]}`}`,
        'success', 3000
      )
    }

    scheduleSave(activePlanId)
  }

  // ─── Render guards ────────────────────────────────────────────
  if (loading) return <LineupSkeleton />
  if (error) {
    return (
      <div className="flex items-center justify-center flex-1 px-6" style={{ background: '#0d1117' }}>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }
  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 text-center" style={{ background: '#0d1117' }}>
        <p className="text-gray-400 text-lg">No team set up yet.</p>
        <p className="text-gray-500 text-sm mt-1">Go to My Team to create your team first.</p>
      </div>
    )
  }

  const draggingPlayerId = dragState?.playerId || null

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0, overflow: 'clip', background: '#0d1117' }}>

      {/* ══ Row 1: Header ══ */}
      {isWide ? (
        <div
          className="flex items-center gap-2 px-3 border-b border-gray-800"
          style={{ height: 44, flexShrink: 0, background: 'var(--bg-secondary)' }}
        >
          <span className="text-white font-semibold text-sm truncate flex-1 min-w-0">{team.name}</span>
          <span className="text-gray-500 text-xs flex-shrink-0">{team.division}</span>
          <FormationPicker
            formations={formationList}
            selectedId={formationId}
            onChange={handleFormationChange}
          />
          {saving && <span className="text-green-700 text-xs flex-shrink-0" title="Saving…">●</span>}
          <button
            onClick={openAILineup}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8,
              background: 'linear-gradient(135deg, #7b3fa8, #00c853)', color: '#fff',
              border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 13, fontWeight: 600 }}
            aria-label="AI Lineup"
          >
            ✨ AI Lineup
          </button>
          <button
            onClick={() => setShowShareSheet(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
              background: 'none', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Share
          </button>
        </div>
      ) : (
        <div style={{
          height: 44, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 10px', gap: 8,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid #1f2937',
        }}>
          <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400, flexShrink: 0, letterSpacing: '-0.01em' }}>
            Squad<span style={{ fontWeight: 700, color: '#00c853' }}>IQ</span>
          </span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: team?.color_primary || 'var(--team-primary, #1a5c2e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff',
            }}>
              {team.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {team.name}
            </span>
          </div>
          <div style={{ flexShrink: 0 }}>
            <FormationPicker formations={formationList} selectedId={formationId} onChange={handleFormationChange} />
          </div>
          {saving && <span style={{ fontSize: 9, color: '#00c853', flexShrink: 0 }}>●</span>}
          <button
            onClick={openAILineup}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8,
              background: 'linear-gradient(135deg, #7b3fa8, #00c853)', color: '#fff',
              border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 12, fontWeight: 600 }}
            aria-label="AI Lineup"
          >
            ✨ AI
          </button>
          <button
            onClick={() => setShowShareSheet(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
              background: 'none', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Share
          </button>
        </div>
      )}

      {/* ══ Row 2: Plan tabs ══ */}
      <PlanTabs
        plans={plans}
        activePlanId={activePlanId}
        saving={saving}
        compact={!isWide}
        onSelect={switchPlan}
        onCreate={() => setShowNewPlanModal(true)}
        onDuplicate={handleDuplicatePlan}
        onDelete={(planId, planName) => setDeleteConfirm({ planId, planName, type: 'game' })}
        onRename={handleRenamePlan}
      />

      {/* ══ Row 3: Quarter tabs + field controls (desktop only) ══ */}
      {isWide && (
        <div
          className="flex items-stretch border-b border-gray-800"
          style={{ height: 48, flexShrink: 0, background: '#0d1117' }}
        >
          {[1, 2, 3, 4].map(q => (
            <button
              key={q}
              onClick={() => setViewedQuarter(q)}
              className="flex-1 flex flex-col items-center justify-center transition"
              style={{
                color:        q === viewedQuarter ? 'var(--color-green, #00c853)' : '#6b7280',
                borderBottom: q === viewedQuarter ? '2px solid var(--color-green, #00c853)' : '2px solid transparent',
                background:   q === viewedQuarter ? 'var(--bg-secondary)' : 'transparent',
                fontWeight:   q === viewedQuarter ? 700 : 500,
                fontSize:     14,
              }}
            >
              Q{q}
            </button>
          ))}
          <div style={{ width: 1, background: '#1f2937', flexShrink: 0, margin: '10px 0' }} />
          <div className="flex items-center gap-1 px-2 flex-shrink-0">
            <button
              onClick={handleClearQuarter}
              className="text-xs text-gray-500 hover:text-red-400 transition px-1.5 py-1 rounded hover:bg-red-900/20"
              title={`Clear Q${viewedQuarter}`}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ══ Content: field (left/top) + player list (right/bottom) ══ */}
      <div style={{
        flex:          1,
        minHeight:     0,
        display:       'flex',
        flexDirection: isWide ? 'row' : 'column',
        overflow:      'clip',
      }}>

        {/* ── Field pane ── */}
        <div style={{
          flex:           isWide ? '0 0 60%' : '0 0 55%',
          height:         isWide ? '100%' : undefined,
          display:        'flex',
          flexDirection:  'row',
          alignItems:     isWide ? 'center' : 'stretch',
          justifyContent: isWide ? 'center' : undefined,
          padding:        isWide ? '10px 0 10px 12px' : '0',
          boxSizing:      'border-box',
          flexShrink:     0,
          borderRight:    isWide ? '1px solid #1f2937' : 'none',
          overflow:       'hidden',
          position:       'relative',
        }}>
          {/* Vertical quarter strip — mobile only */}
          {!isWide && (
            <div style={{ width: 28, display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 2 }}>
              {[1, 2, 3, 4].map(q => {
                const active   = q === viewedQuarter
                const hasData  = Object.values(quarters?.[q]?.slots || {}).some(Boolean)
                return (
                  <button
                    key={q}
                    onClick={() => setViewedQuarter(q)}
                    style={{
                      flex:           1,
                      display:        'flex',
                      flexDirection:  'column',
                      alignItems:     'center',
                      justifyContent: 'center',
                      background:     active ? '#00c853' : 'rgba(0,0,0,0.55)',
                      color:          active ? '#fff' : 'rgba(255,255,255,0.5)',
                      fontSize:       12,
                      fontWeight:     700,
                      border:         'none',
                      cursor:         'pointer',
                      gap:            2,
                      transition:     'background 0.15s',
                      borderRight:    active ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    Q{q}
                    {hasData && !active && (
                      <span style={{ fontSize: 8, lineHeight: 1, opacity: 0.8 }}>✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Field diagram */}
          <div style={isWide ? {
            position:    'relative',
            height:      '100%',
            aspectRatio: '100 / 154',
            maxWidth:    '100%',
            borderRadius: 8,
            overflow:    'hidden',
            boxShadow:   '0 4px 32px rgba(0,0,0,0.6)',
          } : {
            position:  'relative',
            flex:      1,
            height:    '100%',
            overflow:  'hidden',
            boxShadow: '0 4px 32px rgba(0,0,0,0.6)',
          }}>
            {formation && (
              <GameField
                formation={formation}
                slotAssignments={slots}
                players={players}
                onDragStart={onDragStart}
                draggingPlayerId={draggingPlayerId}
                hoverSlotId={hoverSlotId}
                isDragging={draggingPlayerId !== null}
                outOfPositionPlayerIds={outOfPositionByQuarter[viewedQuarter] || new Set()}
              />
            )}
          </div>

          {/* OUT panel — flush right of field */}
          <OutPanel
            players={players}
            outAllIds={outAllIds}
            outQIds={outQIds}
            viewedQuarter={viewedQuarter}
            isMobile={!isWide}
            onDragStart={onDragStart}
            draggingPlayerId={draggingPlayerId}
            outAllIsOver={hoverDrop === 'out-all'}
            outQIsOver={hoverDrop === 'out-quarter'}
          />

        </div>

        {/* ── Right pane: player tag grid ── */}
        <div style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column',
        }}>
          <PlayerTagGrid
            players={players}
            quarterPlans={quarterPlansForList}
            viewedQuarter={viewedQuarter}
            outAllIds={outAllIds}
            outQIds={outQIds}
            isMobile={!isWide}
            onDragStart={onDragStart}
            draggingPlayerId={draggingPlayerId}
            shakingPlayerId={shakingPlayerId}
            benchIsOver={hoverDrop === 'bench'}
          />
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position:   'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30,30,50,0.95)', color: '#fff',
          padding:    '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          border:     '1px solid rgba(120,80,255,0.4)',
          boxShadow:  '0 4px 16px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap', zIndex: 999,
        }}>
          {toast}
        </div>
      )}

      {/* Floating drag ghost */}
      {dragState && (
        <div
          ref={ghostRef}
          style={{
            position:       'fixed',
            left:           0,
            top:            0,
            width:          dragState.ghostW,
            height:         dragState.ghostH,
            transform:      `translate(${dragState.currentX - dragState.ghostW / 2}px, ${dragState.currentY - dragState.ghostH / 2}px)`,
            pointerEvents:  'none',
            zIndex:         9999,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            3,
            borderRadius:   10,
            background:     '#0f2018',
            border:         '1.5px solid var(--team-primary, #1a5c2e)',
            boxShadow:      '0 8px 24px rgba(0,0,0,0.7)',
            userSelect:     'none',
          }}
        >
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1 }}>
            {dragState.player?.jersey_number}
          </span>
          <span style={{ color: '#86efac', fontSize: 10, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dragState.player?.name.split(' ')[0]}
          </span>
        </div>
      )}

      {showNewPlanModal && (
        <SavePlanModal
          onSave={handleCreatePlan}
          onCancel={() => setShowNewPlanModal(false)}
        />
      )}

      {/* Share action sheet */}
      {showShareSheet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowShareSheet(false)}>
          <div style={{ background: '#1a1a2e', border: '1px solid rgba(0,200,83,0.25)', borderRadius: '16px 16px 0 0', padding: '20px 20px 32px', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Share Lineup</div>
            <button onClick={() => shareGameDay('image')} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(0,200,83,0.12)', border: '1px solid rgba(0,200,83,0.3)', color: '#00c853', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              📷 Save as image
            </button>
            <button onClick={() => shareGameDay('pdf')} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              📄 Export as PDF
            </button>
            <button onClick={() => setShowShareSheet(false)} style={{ padding: '10px', borderRadius: 10, background: 'none', border: '1px solid #374151', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* AI Lineup modal — single screen */}
      {showAILineup && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 9999 }}
          onClick={() => setShowAILineup(false)}
        >
          <div
            style={{ background: '#1a1a2e', border: '1px solid rgba(123,63,168,0.3)',
              borderRadius: '20px 20px 0 0', padding: 20, width: '100%', maxWidth: 480,
              display: 'flex', flexDirection: 'column', gap: 14,
              maxHeight: '90dvh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>✨</span>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>AI Lineup Planner</div>
              </div>
              <button onClick={() => setShowAILineup(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>
                ✕
              </button>
            </div>

            {/* Quarter selector */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Plan which quarters?
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['All 4', 'Q1 only', 'Q2 only', 'Q3 only', 'Q4 only'].map(opt => (
                  <button key={opt} onClick={() => setAIQuarterMode(opt)} style={{
                    flex: 1, padding: '7px 2px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${aiQuarterMode === opt ? 'rgba(123,63,168,0.7)' : 'rgba(255,255,255,0.1)'}`,
                    background: aiQuarterMode === opt ? 'rgba(123,63,168,0.25)' : 'rgba(255,255,255,0.03)',
                    color: aiQuarterMode === opt ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Player availability */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Player Availability
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {players.map(player => {
                  const isAbsentAll = aiAbsentAll.has(player.id)
                  const absentQs   = aiAbsentQuarters[player.id] || []
                  return (
                    <div key={player.id} style={{
                      background: isAbsentAll ? 'rgba(220,50,50,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isAbsentAll ? 'rgba(220,50,50,0.25)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 10, padding: '8px 10px',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: isAbsentAll ? 'rgba(220,50,50,0.3)' : (team?.color_primary || '#00c853'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#fff',
                      }}>
                        {player.jersey_number}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: isAbsentAll ? 'rgba(255,255,255,0.3)' : '#fff',
                          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {player.name}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
                          {(player.positions || []).join(', ')}
                        </div>
                      </div>

                      {/* Per-quarter absence buttons — All 4 mode only */}
                      {!isAbsentAll && aiQuarterMode === 'All 4' && (
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[1, 2, 3, 4].map(q => {
                            const isOut = absentQs.includes(q)
                            return (
                              <button key={q} onClick={() => setAiAbsentQuarters(prev => {
                                const cur = prev[player.id] || []
                                return { ...prev, [player.id]: isOut ? cur.filter(x => x !== q) : [...cur, q] }
                              })} style={{
                                width: 22, height: 22, borderRadius: 4, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                                border: `1px solid ${isOut ? 'rgba(220,50,50,0.6)' : 'rgba(255,255,255,0.13)'}`,
                                background: isOut ? 'rgba(220,50,50,0.2)' : 'transparent',
                                color: isOut ? '#E24B4A' : 'rgba(255,255,255,0.35)',
                              }}>
                                Q{q}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Out all toggle */}
                      <button onClick={() => {
                        setAiAbsentAll(prev => {
                          const next = new Set(prev)
                          if (next.has(player.id)) {
                            next.delete(player.id)
                          } else {
                            next.add(player.id)
                            setAiAbsentQuarters(p => { const n = { ...p }; delete n[player.id]; return n })
                          }
                          return next
                        })
                      }} style={{
                        background: isAbsentAll ? 'rgba(220,50,50,0.25)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isAbsentAll ? 'rgba(220,50,50,0.45)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 6, padding: '3px 7px', flexShrink: 0,
                        color: isAbsentAll ? '#E24B4A' : 'rgba(255,255,255,0.35)',
                        fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        {isAbsentAll ? 'OUT' : 'Out?'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Absence summary */}
            {(aiAbsentAll.size > 0 || Object.values(aiAbsentQuarters).some(q => q.length > 0)) && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', flexShrink: 0 }}>
                {aiAbsentAll.size > 0 && `${aiAbsentAll.size} player(s) out all game`}
                {aiAbsentAll.size > 0 && Object.values(aiAbsentQuarters).some(q => q.length > 0) && ' · '}
                {Object.values(aiAbsentQuarters).filter(q => q.length > 0).length > 0 &&
                  `${Object.values(aiAbsentQuarters).filter(q => q.length > 0).length} player(s) with quarter restrictions`}
              </div>
            )}

            {/* Generate button */}
            <button onClick={() => { console.log('GENERATE BUTTON CLICKED'); handleGenerateAILineup() }} style={{
              background: 'linear-gradient(135deg, #7b3fa8, #00c853)', border: 'none',
              borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', width: '100%', flexShrink: 0,
            }}>
              ✨ Generate Lineup
            </button>
          </div>
        </div>
      )}

      {/* Hidden export layout */}
      {(() => {
        const activePlan = plans.find(p => p.id === activePlanId)
        const atRisk = getAtRiskPlayers()
        return (
          <div id="gameday-export" style={{ position: 'fixed', left: '-9999px', top: 0, width: 1200, background: '#0d0d1a', padding: 24, fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: team?.color_primary || '#00c853',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: '#fff',
              }}>
                {team?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{team?.name}</div>
                <div style={{ color: '#00c853', fontSize: 13 }}>{team?.division} Division — {activePlan?.name}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{new Date().toLocaleDateString()}</div>
            </div>
            {/* 4 quarters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[1, 2, 3, 4].map(q => {
                const qState     = quarters?.[q]
                const qFormation = qState?.formation
                const qSlots     = qState?.slots || {}
                const playingIds = new Set(Object.values(qSlots).filter(Boolean))
                const outQ       = outQIds[q] || new Set()
                const benchPlayers = players.filter(p =>
                  !playingIds.has(p.id) && !outAllIds.has(p.id) && !outQ.has(p.id)
                )
                const outPlayers = players.filter(p => outAllIds.has(p.id) || outQ.has(p.id))
                return (
                  <div key={q} style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 12 }}>
                    <div style={{ color: '#00c853', fontSize: 14, fontWeight: 700, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      Q{q} — {qFormation?.label || 'No formation'}
                    </div>
                    {/* Mini field */}
                    <div style={{ background: '#0a2e14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, height: 180, position: 'relative', marginBottom: 10, overflow: 'hidden' }}>
                      {Object.entries(qSlots).map(([slotId, playerId]) => {
                        if (!playerId) return null
                        const player = players.find(p => p.id === playerId)
                        const slot   = getSlotPos(slotId, qFormation)
                        if (!player || !slot) return null
                        return (
                          <div key={slotId} style={{ position: 'absolute', left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%, -50%)',
                            width: 28, height: 28, borderRadius: '50%', background: team?.color_primary || '#00c853',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 700, textAlign: 'center', lineHeight: 1.1, flexDirection: 'column' }}>
                            <div>{player.jersey_number}</div>
                            <div style={{ fontSize: 6 }}>{player.name?.split(' ')[0]}</div>
                          </div>
                        )
                      })}
                    </div>
                    {/* On field */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, color: '#00c853', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>On field</div>
                      {players.filter(p => playingIds.has(p.id)).map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#fff', marginBottom: 3 }}>
                          <span style={{ width: 18, height: 18, borderRadius: '50%', background: team?.color_primary || '#00c853', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, flexShrink: 0, color: '#fff' }}>
                            {p.jersey_number}
                          </span>
                          {p.name}
                        </div>
                      ))}
                    </div>
                    {/* Bench */}
                    {benchPlayers.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Bench</div>
                        {benchPlayers.map(p => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 3 }}>
                            <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, flexShrink: 0, color: 'rgba(255,255,255,0.5)' }}>
                              {p.jersey_number}
                            </span>
                            {p.name}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Out */}
                    {outPlayers.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: 9, color: 'rgba(220,50,50,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Out</div>
                        {outPlayers.map(p => (
                          <div key={p.id} style={{ fontSize: 11, color: 'rgba(220,50,50,0.6)', marginBottom: 3 }}>
                            {p.jersey_number} {p.name}
                            {outAllIds.has(p.id) && (
                              <span style={{ fontSize: 9, color: 'rgba(220,50,50,0.4)', marginLeft: 4 }}>(all quarters)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {/* AYSO warning */}
            {atRisk.length > 0 && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(133,79,11,0.2)', border: '1px solid rgba(239,159,39,0.3)', borderRadius: 8, fontSize: 12, color: '#EF9F27' }}>
                ⚠ Under 3 quarters: {atRisk.map(p => p.name).join(', ')}
              </div>
            )}
            <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'center' }}>Created with SquadIQ</div>
          </div>
        )
      })()}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 24,
        }}>
          <div style={{
            background: '#1a1a2e',
            border: '1px solid rgba(220,50,50,0.25)',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 340,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{
              width: 48, height: 48,
              borderRadius: '50%',
              background: 'rgba(220,50,50,0.1)',
              border: '1px solid rgba(220,50,50,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              🗑
            </div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
              Delete plan?
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>
                "{deleteConfirm.planName}"
              </span>
              {' '}will be permanently deleted including all quarter assignments and lineup data. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  padding: '12px',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Keep it
              </button>
              <button
                onClick={() => { handleDeletePlan(deleteConfirm.planId); setDeleteConfirm(null) }}
                style={{
                  flex: 1,
                  background: '#A32D2D',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export loading overlay */}
      {isExporting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, flexDirection: 'column', gap: 12 }}>
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#00c853', borderTopColor: 'transparent' }} />
          <div style={{ color: '#fff', fontSize: 14 }}>Generating export…</div>
        </div>
      )}
    </div>
  )
}
