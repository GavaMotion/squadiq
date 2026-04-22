import { useState, useEffect, useRef } from 'react'
import theme from '../../theme'

// ── Single tab ────────────────────────────────────────────────────
function PlanTab({ plan, isActive, isSaving, compact, onSelect, onDuplicate, onRename, onDelete, tabRef }) {
  const [menuOpen, setMenuOpen]   = useState(false)
  const [editing, setEditing]     = useState(false)
  const [editName, setEditName]   = useState(plan.name)
  const menuRef  = useRef(null)
  const inputRef = useRef(null)

  // Sync editName when plan.name changes externally
  useEffect(() => {
    if (!editing) setEditName(plan.name)
  }, [plan.name, editing])

  // Focus + select all on entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select()
  }, [editing])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function onOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [menuOpen])

  function startEdit() { setEditName(plan.name); setEditing(true); setMenuOpen(false) }
  function commitEdit() {
    const t = editName.trim()
    if (t && t !== plan.name) onRename(plan.id, t)
    setEditing(false)
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { setEditing(false); setEditName(plan.name) }
  }

  return (
    <div
      ref={tabRef}
      style={{
        position:    'relative',
        display:     'flex',
        alignItems:  'stretch',
        flexShrink:  0,
        maxWidth:    200,
        minWidth:    72,
        borderRight: '1px solid #1f2937',
      }}
    >
      {/* ── Tab name — button (idle) or input (editing) ── */}
      {editing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          style={{
            flex:         1,
            minWidth:     0,
            padding:      '0 6px 0 10px',
            fontSize:     12,
            fontWeight:   600,
            color:        '#e5e7eb',
            background:   '#1f2937',
            border:       'none',
            borderBottom: '2px solid var(--color-green, #00c853)',
            outline:      'none',
          }}
        />
      ) : (
        <button
          onClick={() => onSelect(plan.id)}
          onDoubleClick={startEdit}
          style={{
            flex:         1,
            minWidth:     0,
            padding:      '0 4px 0 10px',
            textAlign:    'left',
            fontSize:     compact ? 11 : 12,
            fontWeight:   isActive ? 600 : 400,
            color:        isActive ? '#e5e7eb' : '#9ca3af',
            background:   isActive ? 'var(--bg-secondary)' : 'transparent',
            borderBottom: isActive ? `2px solid ${theme.brandGreen}` : '2px solid transparent',
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            cursor:       'pointer',
            transition:   'color 0.12s, border-color 0.12s, background 0.12s',
          }}
          title={`${plan.name} (double-click to rename)`}
        >
          {plan.name}
          {isActive && isSaving && (
            <span style={{ color: 'var(--color-green, #00c853)', marginLeft: 4, fontSize: 9 }}>●</span>
          )}
        </button>
      )}

      {/* ── ✕ delete button — always visible ── */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(plan.id, plan.name) }}
        aria-label={`Delete plan "${plan.name}"`}
        style={{
          width:      18,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color:      '#4b5563',
          background: isActive ? 'var(--bg-secondary)' : 'transparent',
          flexShrink: 0,
          fontSize:   11,
          cursor:     'pointer',
          transition: 'color 0.1s',
          paddingRight: 2,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
        onMouseLeave={e => (e.currentTarget.style.color = '#4b5563')}
        title={`Delete "${plan.name}"`}
      >
        ✕
      </button>

      {/* ── Three-dot menu (Rename + Duplicate only) ── */}
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
          style={{
            width:      22,
            height:     '100%',
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color:      menuOpen ? '#9ca3af' : '#4b5563',
            cursor:     'pointer',
            fontSize:   13,
            background: isActive ? 'var(--bg-secondary)' : 'transparent',
          }}
          title="Plan options"
        >
          ···
        </button>

        {menuOpen && (
          <div style={{
            position:  'absolute',
            top:       '100%',
            left:      0,
            zIndex:    100,
            background:'var(--bg-panel)',
            border:    '1px solid var(--border-subtle)',
            borderRadius: 8,
            minWidth:  140,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            overflow:  'hidden',
          }}>
            {[
              { label: 'Rename',    action: startEdit },
              { label: 'Duplicate', action: () => { onDuplicate(plan.id); setMenuOpen(false) } },
            ].map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                style={{ display:'block', width:'100%', padding:'8px 14px', textAlign:'left', fontSize:13, color:'#d1d5db', background:'none', cursor:'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#374151')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────
/**
 * Props:
 *   plans        { id, name }[]
 *   activePlanId string | null
 *   saving       bool
 *   onSelect     (planId) => void
 *   onCreate     () => void
 *   onDuplicate  (planId) => void
 *   onDelete     (planId) => void
 *   onRename     (planId, newName) => void
 */
export default function PlanTabs({
  plans, activePlanId, saving, compact,
  onSelect, onCreate, onDuplicate, onDelete, onRename,
}) {
  const tabRefs = useRef({})

  // Scroll active tab into view on switch
  useEffect(() => {
    tabRefs.current[activePlanId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activePlanId])

  return (
    <div style={{ flexShrink: 0 }}>
      {/* ── Tab row ── */}
      <div
        style={{
          display:    'flex',
          alignItems: 'stretch',
          height:     compact ? 32 : 38,
          background: 'var(--bg-primary)',
          borderBottom: '1px solid #1f2937',
          overflowX:  'auto',
          overflowY:  'hidden',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {plans.map(plan => (
          <PlanTab
            key={plan.id}
            plan={plan}
            isActive={plan.id === activePlanId}
            isSaving={saving}
            compact={compact}
            onSelect={onSelect}
            onDuplicate={onDuplicate}
            onRename={onRename}
            onDelete={onDelete}
            tabRef={el => { tabRefs.current[plan.id] = el }}
          />
        ))}

        {/* New plan (+) button */}
        <button
          onClick={onCreate}
          aria-label="Add new plan"
          style={{
            flexShrink: 0,
            width:      38,
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color:      '#6b7280',
            cursor:     'pointer',
            fontSize:   20,
            fontWeight: 300,
            borderLeft: plans.length > 0 ? '1px solid #1f2937' : 'none',
            transition: 'color 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#e5e7eb')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          title="New game plan"
        >
          +
        </button>
      </div>
    </div>
  )
}
