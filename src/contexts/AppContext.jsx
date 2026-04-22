import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getDefaultFormation, getFormationById } from '../lib/formations'

// ── Game Day helpers — exported so GameDayPage can import them ───
export function emptyPlan(formation) {
  return Object.fromEntries(formation.slots.map(s => [s.id, null]))
}
export function validatePlan(saved, formation, validIds) {
  const base = emptyPlan(formation)
  for (const [slotId, pid] of Object.entries(saved || {})) {
    if (slotId in base && pid && validIds.has(pid)) base[slotId] = pid
  }
  return base
}

function makeQuarterState(formation, slots) {
  return { formationId: formation.id, formation, slots }
}

// Build the JSONB payload saved to quarter_data column
export function planStateToQuarterData(state) {
  const qd = {}
  for (const q of [1, 2, 3, 4]) {
    const qs = state.quarters[q]
    qd[q] = { formationId: qs.formationId, slots: qs.slots }
  }
  // Store per-quarter OUT sets
  qd.out_q = {}
  for (const q of [1, 2, 3, 4]) {
    qd.out_q[q] = [...(state.outQIds?.[q] || new Set())]
  }
  return qd
}

export function buildBlankPlanState(formation) {
  const slots = emptyPlan(formation)
  return {
    quarters: {
      1: makeQuarterState(formation, { ...slots }),
      2: makeQuarterState(formation, { ...slots }),
      3: makeQuarterState(formation, { ...slots }),
      4: makeQuarterState(formation, { ...slots }),
    },
    outAllIds: new Set(),
    outQIds:   { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() },
  }
}

export function buildPlanState(plan, validIds, teamDivision) {
  const defaultForm = getFormationById(plan.formation_id) || getDefaultFormation(teamDivision || '')
  const qd          = plan.quarter_data || {}
  const hasNew      = Object.keys(qd).length > 0

  // outAllIds — stored in absent_players for DB compat
  const outAllIds = new Set((plan.absent_players || []).filter(id => validIds.has(id)))

  // outQIds — stored in quarter_data.out_q
  const rawOutQ = qd.out_q || {}
  const outQIds = {}
  for (const q of [1, 2, 3, 4]) {
    outQIds[q] = new Set((rawOutQ[q] || rawOutQ[String(q)] || []).filter(id => validIds.has(id)))
  }

  const quarters = {}
  for (const q of [1, 2, 3, 4]) {
    if (hasNew) {
      const qdq  = qd[q] || qd[String(q)] || {}
      const form = getFormationById(qdq.formationId) || defaultForm
      quarters[q] = makeQuarterState(form, validatePlan(qdq.slots, form, validIds))
    } else {
      const qp = plan.quarter_plans || {}
      quarters[q] = makeQuarterState(
        defaultForm,
        qp[q] ? validatePlan(qp[q], defaultForm, validIds) : emptyPlan(defaultForm)
      )
    }
  }

  return { quarters, outAllIds, outQIds }
}

// ── CSS custom properties for team branding ───────────────────────
function hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return '26,92,46'
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r},${g},${b}`
}

export function applyTeamCSSVars(teamData) {
  const primary   = teamData?.color_primary   || '#1a5c2e'
  const secondary = teamData?.color_secondary || null
  const accent    = teamData?.color_accent    || null
  const rgb = hexToRgb(primary)
  document.documentElement.style.setProperty('--team-primary',    primary)
  document.documentElement.style.setProperty('--team-primary-rgb', rgb)
  document.documentElement.style.setProperty('--team-secondary',  secondary || primary)
  document.documentElement.style.setProperty('--team-accent',     accent    || primary)
  // Opacity aliases for backgrounds
  document.documentElement.style.setProperty('--team-primary-20', `rgba(${rgb},0.20)`)
  document.documentElement.style.setProperty('--team-primary-12', `rgba(${rgb},0.12)`)
}

// ── localStorage cache helpers ────────────────────────────────────
function cacheData(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })) } catch { /* storage full */ }
}
function getCachedData(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw).data
  } catch { return null }
}
export function getCachedAge(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const mins = Math.round((Date.now() - JSON.parse(raw).ts) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
    const hrs = Math.round(mins / 60)
    return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  } catch { return null }
}

// ── Context ──────────────────────────────────────────────────────
const AppContext = createContext(null)

export function AppProvider({ userId, children }) {
  // ── All teams for this user ───────────────────────────────────
  const [teams,        setTeams]        = useState([])
  const [activeTeamId, setActiveTeamId] = useState(null)

  // ── Favorites (per user, not per team) ───────────────────────
  const [favoriteDrillNames, setFavoriteDrillNames] = useState(new Set())

  // ── Custom drills (per user) ──────────────────────────────────
  const [customDrills, setCustomDrills] = useState([])

  // ── Active team's data ────────────────────────────────────────
  const [team, setTeam] = useState(null)
  const [players,     setPlayers]     = useState([])
  const [playerCount, setPlayerCount] = useState(0)

  // Load-state flags
  const [dataLoaded, setDataLoaded] = useState(false)
  const [loadError,  setLoadError]  = useState('')

  // Stable refs shared across screens
  const teamRef           = useRef(null)
  const teamIdRef         = useRef(null)
  const validIdsRef       = useRef(new Set())
  const pendingChangesRef = useRef([])

  // Load pending changes from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pending_changes')
      if (raw) pendingChangesRef.current = JSON.parse(raw)
    } catch { pendingChangesRef.current = [] }
  }, [])

  // ── Game Day persistent state ─────────────────────────────────
  const [gdPlans,        setGdPlans]        = useState([])
  const [gdActivePlanId, setGdActivePlanId] = useState(null)
  const [gdPlanStates,   setGdPlanStates]   = useState({})

  // ── Practice persistent state ─────────────────────────────────
  const [practicePlans,        setPracticePlans]        = useState([])
  const [practiceActivePlanId, setPracticeActivePlanId] = useState(null)
  const [allPlanDrills,        setAllPlanDrills]        = useState({})

  // ── Load all data for one team ────────────────────────────────
  const loadTeamData = useCallback(async (teamData) => {
    setDataLoaded(false)
    setLoadError('')

    try {
      setTeam(teamData)
      teamRef.current   = teamData
      teamIdRef.current = teamData.id
      applyTeamCSSVars(teamData)

      // ── Players ─────────────────────────────────────────────
      const { data: playersData, error: playersErr } = await supabase
        .from('players').select('*').eq('team_id', teamData.id).order('jersey_number')
      let allPlayers = playersData || []
      if (!playersErr) {
        cacheData(`cache_players_${teamData.id}`, allPlayers)
      } else {
        allPlayers = getCachedData(`cache_players_${teamData.id}`) || []
      }
      setPlayers(allPlayers)
      setPlayerCount(allPlayers.length)
      const vids = new Set(allPlayers.map(p => p.id))
      validIdsRef.current = vids

      // ── Game Day plans ───────────────────────────────────────
      let gdAllPlans = []
      try {
        const { data: saved, error: err } = await supabase
          .from('saved_game_plans').select('*')
          .eq('team_id', teamData.id).order('created_at', { ascending: true })
        if (!err) {
          gdAllPlans = saved || []
          if (gdAllPlans.length > 0) cacheData(`cache_gameplans_${teamData.id}`, gdAllPlans)
        } else {
          gdAllPlans = getCachedData(`cache_gameplans_${teamData.id}`) || []
        }
      } catch {
        gdAllPlans = getCachedData(`cache_gameplans_${teamData.id}`) || []
      }

      if (gdAllPlans.length === 0) {
        const baseForm = getDefaultFormation(teamData.division)
        const blankState = buildBlankPlanState(baseForm)
        try {
          const { data: newPlan } = await supabase
            .from('saved_game_plans')
            .insert({
              team_id: teamData.id, name: 'Game Plan 1',
              formation_id: baseForm.id,
              quarter_data: planStateToQuarterData(blankState),
              absent_players: [],
            })
            .select().single()
          if (newPlan) gdAllPlans = [newPlan]
        } catch { /* silent */ }
      }
      if (gdAllPlans.length === 0) {
        const baseForm = getDefaultFormation(teamData.division)
        const blankState = buildBlankPlanState(baseForm)
        gdAllPlans = [{
          id: 'local-plan-1', name: 'Game Plan 1',
          formation_id: baseForm.id,
          quarter_data: planStateToQuarterData(blankState),
          absent_players: [],
        }]
      }

      setGdPlans(gdAllPlans)
      const gdStates = {}
      for (const plan of gdAllPlans) {
        gdStates[plan.id] = buildPlanState(plan, vids, teamData.division)
      }
      setGdPlanStates(gdStates)

      const gdStoredId = (() => {
        try { return localStorage.getItem(`gameday-active-${teamData.id}`) } catch { return null }
      })()
      const gdActive = gdAllPlans.find(p => p.id === gdStoredId) || gdAllPlans[0]
      setGdActivePlanId(gdActive.id)
      try { localStorage.setItem(`gameday-active-${teamData.id}`, gdActive.id) } catch { /* silent */ }

      // ── Practice plans ───────────────────────────────────────
      let allPracticePlans = []
      try {
        const { data: saved, error: err } = await supabase
          .from('practice_plans').select('*')
          .eq('team_id', teamData.id).order('created_at', { ascending: true })
        if (!err) {
          allPracticePlans = saved || []
          if (allPracticePlans.length > 0) cacheData(`cache_practiceplans_${teamData.id}`, allPracticePlans)
        } else {
          allPracticePlans = getCachedData(`cache_practiceplans_${teamData.id}`) || []
        }
      } catch {
        allPracticePlans = getCachedData(`cache_practiceplans_${teamData.id}`) || []
      }

      if (allPracticePlans.length === 0) {
        try {
          const { data: newPlan } = await supabase
            .from('practice_plans')
            .insert({ team_id: teamData.id, name: 'Practice 1' })
            .select().single()
          if (newPlan) allPracticePlans = [newPlan]
        } catch { /* silent */ }
      }
      if (allPracticePlans.length === 0) {
        allPracticePlans = [{ id: 'local-plan-1', name: 'Practice 1' }]
      }

      setPracticePlans(allPracticePlans)

      const practiceStoredId = (() => {
        try { return localStorage.getItem(`practice-active-${teamData.id}`) } catch { return null }
      })()
      const practiceActive = allPracticePlans.find(p => p.id === practiceStoredId) || allPracticePlans[0]
      setPracticeActivePlanId(practiceActive.id)
      try { localStorage.setItem(`practice-active-${teamData.id}`, practiceActive.id) } catch { /* silent */ }

      // Load practice drills for all plans in one query
      const practicePlanIds = allPracticePlans
        .map(p => p.id).filter(id => !String(id).startsWith('local-'))
      const grouped = {}
      allPracticePlans.forEach(p => { grouped[p.id] = [] })
      if (practicePlanIds.length > 0) {
        const { data: allDrills, error: drillsErr } = await supabase
          .from('practice_plan_drills').select('*')
          .in('plan_id', practicePlanIds).order('sort_order', { ascending: true })
        if (!drillsErr) {
          const drills = allDrills || []
          drills.forEach(d => {
            if (!grouped[d.plan_id]) grouped[d.plan_id] = []
            grouped[d.plan_id].push(d)
          })
          cacheData(`cache_practicedrills_${teamData.id}`, drills)
        } else {
          const cached = getCachedData(`cache_practicedrills_${teamData.id}`) || []
          cached.forEach(d => {
            if (!grouped[d.plan_id]) grouped[d.plan_id] = []
            grouped[d.plan_id].push(d)
          })
        }
      }
      setAllPlanDrills(grouped)

    } catch (err) {
      console.error('[AppContext] loadTeamData error:', err)
      setLoadError(err.message || 'Failed to load data')
    } finally {
      setDataLoaded(true)
    }
  }, [])

  // ── Initial load: fetch all teams, then load active team's data ─
  useEffect(() => {
    if (!userId) return

    async function loadTeams() {
      try {
        const { data: allTeams } = await supabase
          .from('teams')
          .select('id, name, division, color_primary, color_secondary, color_accent, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })

        if (!allTeams || allTeams.length === 0) {
          setTeams([])
          setDataLoaded(true)
          return
        }

        cacheData(`cache_teams_${userId}`, allTeams)
        setTeams(allTeams)

        const storedId = (() => {
          try { return localStorage.getItem(`active-team-${userId}`) } catch { return null }
        })()
        const activeTeam = allTeams.find(t => t.id === storedId) || allTeams[0]
        setActiveTeamId(activeTeam.id)
        try { localStorage.setItem(`active-team-${userId}`, activeTeam.id) } catch { /* silent */ }

        await loadTeamData(activeTeam)
      } catch (err) {
        console.error('[AppContext] loadTeams error:', err)
        const cachedTeams = getCachedData(`cache_teams_${userId}`)
        if (cachedTeams && cachedTeams.length > 0) {
          setTeams(cachedTeams)
          const storedId = (() => { try { return localStorage.getItem(`active-team-${userId}`) } catch { return null } })()
          const activeTeam = cachedTeams.find(t => t.id === storedId) || cachedTeams[0]
          setActiveTeamId(activeTeam.id)
          await loadTeamData(activeTeam)
        } else {
          setLoadError(err.message || 'Failed to load teams')
          setDataLoaded(true)
        }
      }
    }

    loadTeams()
  }, [userId, loadTeamData])

  // ── Normalize a DB custom drill row into library-drill shape ─
  function normalizeCustomDrill(db) {
    return {
      id:             db.id,
      name:           db.name,
      description:    db.description,
      category:       db.skill_category,
      minDivision:    db.min_age_division,
      duration:       db.duration_minutes,
      phase:          db.phase,
      coachingPoints: db.coaching_points  || [],
      variations:     db.variations        || [],
      imageUrl:       db.image_url        || null,
      videoUrl:       db.video_url        || null,
      isCustom:       true,
    }
  }

  // ── Load favorites + custom drills once per user session ─────
  useEffect(() => {
    if (!userId) return
    async function loadUserData() {
      // Favorites
      try {
        const { data } = await supabase
          .from('drill_favorites').select('drill_name').eq('user_id', userId)
        setFavoriteDrillNames(new Set((data || []).map(r => r.drill_name)))
      } catch { /* table may not exist yet */ }

      // Custom drills
      try {
        const { data } = await supabase
          .from('custom_drills').select('*').eq('user_id', userId)
          .order('created_at', { ascending: false })
        setCustomDrills((data || []).map(normalizeCustomDrill))
      } catch { /* table may not exist yet */ }
    }
    loadUserData()
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Custom drill CRUD ─────────────────────────────────────────
  function addCustomDrill(dbRow) {
    setCustomDrills(prev => [normalizeCustomDrill(dbRow), ...prev])
  }
  function updateCustomDrill(id, dbRow) {
    setCustomDrills(prev => prev.map(d => d.id === id ? normalizeCustomDrill(dbRow) : d))
  }
  function deleteCustomDrill(id) {
    setCustomDrills(prev => prev.filter(d => d.id !== id))
  }

  // ── Toggle a drill favorite (optimistic update) ───────────────
  async function toggleFavorite(drillName) {
    if (favoriteDrillNames.has(drillName)) {
      setFavoriteDrillNames(prev => { const n = new Set(prev); n.delete(drillName); return n })
      try {
        await supabase.from('drill_favorites')
          .delete().eq('user_id', userId).eq('drill_name', drillName)
      } catch { /* silent */ }
    } else {
      setFavoriteDrillNames(prev => new Set([...prev, drillName]))
      try {
        await supabase.from('drill_favorites')
          .insert({ user_id: userId, drill_name: drillName })
      } catch { /* silent */ }
    }
  }

  // ── Switch active team ────────────────────────────────────────
  async function switchTeam(teamId) {
    const teamData = teams.find(t => t.id === teamId)
    if (!teamData || teamId === activeTeamId) return
    setActiveTeamId(teamId)
    try { localStorage.setItem(`active-team-${userId}`, teamId) } catch { /* silent */ }
    await loadTeamData(teamData)
  }

  // ── Create a new team and switch to it ────────────────────────
  async function createTeam(name, division, branding = {}) {
    const { data, error } = await supabase
      .from('teams')
      .insert({
        user_id:         userId,
        name:            name.trim(),
        division,
        color_primary:   branding.colorPrimary   || null,
        color_secondary: branding.colorSecondary || null,
        color_accent:    branding.colorAccent    || null,
      })
      .select().single()
    if (error) throw error

    setTeams(prev => [...prev, data])
    setActiveTeamId(data.id)
    try { localStorage.setItem(`active-team-${userId}`, data.id) } catch { /* silent */ }
    await loadTeamData(data)
    return data
  }

  // ── Delete a team (cascade handled by Supabase) ───────────────
  async function deleteTeam(teamId) {
    await supabase.from('teams').delete().eq('id', teamId)
    const remaining = teams.filter(t => t.id !== teamId)
    setTeams(remaining)
    if (teamId !== activeTeamId) return   // deleted a non-active team — nothing else to do

    if (remaining.length > 0) {
      const next = remaining[0]
      setActiveTeamId(next.id)
      try { localStorage.setItem(`active-team-${userId}`, next.id) } catch { /* silent */ }
      await loadTeamData(next)
    } else {
      // No teams left — clear everything
      applyTeamCSSVars(null)
      setActiveTeamId(null)
      setTeam(null)
      teamRef.current   = null
      teamIdRef.current = null
      setPlayers([])
      setPlayerCount(0)
      validIdsRef.current = new Set()
      setGdPlans([])
      setGdActivePlanId(null)
      setGdPlanStates({})
      setPracticePlans([])
      setPracticeActivePlanId(null)
      setAllPlanDrills({})
      setDataLoaded(true)
    }
  }

  // ── Offline queue ─────────────────────────────────────────────
  function queueChange(table, operation, data, matchField, matchValue) {
    if (operation === 'update' && matchField && matchValue !== undefined) {
      pendingChangesRef.current = pendingChangesRef.current.filter(
        c => !(c.table === table && c.operation === 'update' && c.matchField === matchField && c.matchValue === matchValue)
      )
    }
    pendingChangesRef.current.push({ id: crypto.randomUUID(), table, operation, data, matchField, matchValue })
    try { localStorage.setItem('pending_changes', JSON.stringify(pendingChangesRef.current)) } catch { /* full */ }
  }

  async function saveWithOfflineSupport(table, operation, data, matchField, matchValue) {
    if (!navigator.onLine) {
      queueChange(table, operation, data, matchField, matchValue)
      return { ok: true, queued: true }
    }
    try {
      let error
      const q = supabase.from(table)
      if (operation === 'update')      ({ error } = await q.update(data).eq(matchField, matchValue))
      else if (operation === 'insert') ({ error } = await q.insert(data))
      else if (operation === 'upsert') ({ error } = await q.upsert(data))
      if (error) throw error
      return { ok: true, queued: false }
    } catch {
      return { ok: false, queued: false }
    }
  }

  async function syncPendingChanges() {
    const changes = [...pendingChangesRef.current]
    if (changes.length === 0) return { synced: 0, failed: 0 }
    let synced = 0, failed = 0
    for (const change of changes) {
      try {
        let error
        const q = supabase.from(change.table)
        if (change.operation === 'update')      ({ error } = await q.update(change.data).eq(change.matchField, change.matchValue))
        else if (change.operation === 'insert') ({ error } = await q.insert(change.data))
        else if (change.operation === 'upsert') ({ error } = await q.upsert(change.data))
        if (error) throw error
        synced++
        pendingChangesRef.current = pendingChangesRef.current.filter(c => c.id !== change.id)
      } catch { failed++ }
    }
    try { localStorage.setItem('pending_changes', JSON.stringify(pendingChangesRef.current)) } catch { /* full */ }
    return { synced, failed }
  }

  // ── Refresh players after roster changes ──────────────────────
  async function refreshPlayers() {
    if (!teamIdRef.current) return
    const { data } = await supabase
      .from('players').select('*').eq('team_id', teamIdRef.current).order('jersey_number')
    const allPlayers = data || []
    setPlayers(allPlayers)
    setPlayerCount(allPlayers.length)
    validIdsRef.current = new Set(allPlayers.map(p => p.id))
  }

  // ── When team branding is edited in-place (MyTeamPage save) ──
  function updateTeamBranding(updatedTeam) {
    setTeam(updatedTeam)
    teamRef.current = updatedTeam
    applyTeamCSSVars(updatedTeam)
    setTeams(prev => prev.map(t => t.id === updatedTeam.id ? updatedTeam : t))
  }

  // ── Context value ─────────────────────────────────────────────
  const value = {
    // Auth
    userId,

    // Teams
    teams,        setTeams,
    activeTeamId,
    switchTeam,
    createTeam,
    deleteTeam,
    updateTeamBranding,

    // Favorites
    favoriteDrillNames,
    toggleFavorite,

    // Custom drills
    customDrills,
    addCustomDrill,
    updateCustomDrill,
    deleteCustomDrill,

    // Active team
    team,        setTeam,
    players,     setPlayers,
    playerCount, setPlayerCount,
    teamRef,
    teamIdRef,
    validIdsRef,
    dataLoaded,
    loadError,
    refreshPlayers,
    saveWithOfflineSupport,
    syncPendingChanges,

    // Game Day
    gdPlans,        setGdPlans,
    gdActivePlanId, setGdActivePlanId,
    gdPlanStates,   setGdPlanStates,

    // Practice
    practicePlans,        setPracticePlans,
    practiceActivePlanId, setPracticeActivePlanId,
    allPlanDrills,        setAllPlanDrills,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
