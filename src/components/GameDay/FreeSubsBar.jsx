import { useState } from 'react'
import theme from '../../theme'
import ModeSwitch from './ModeSwitch'
import { fmtMs, gameMs, isRunning, totalMs } from '../../lib/freeSubs'

/**
 * Free Subs control bar — replaces the Q1–Q4 tabs while the plan is in
 * free-subs mode. Owns the game clock and the game length.
 *
 * Props:
 *   freeSubs      free-subs state object
 *   now           Date.now() from the parent's ticker (so the clock repaints)
 *   isMobile      bool
 *   onStart / onPause / onEnd / onReset   () => void
 *   onLengthChange (minutes) => void
 *   onExitMode     () => void   switch this plan back to quarters
 */
export default function FreeSubsBar({
  freeSubs, now, isMobile,
  onStart, onPause, onEnd, onReset, onLengthChange, onExitMode, onResumeGame,
}) {
  const [editingLength, setEditingLength] = useState(false)
  const [draftLength,   setDraftLength]   = useState(String(freeSubs?.gameLengthMin ?? 50))

  const running  = isRunning(freeSubs)
  const elapsed  = gameMs(freeSubs, now)
  const total    = totalMs(freeSubs)
  const progress = Math.min(100, (elapsed / total) * 100)
  const over     = elapsed > total

  function commitLength() {
    const n = Math.round(Number(draftLength))
    setEditingLength(false)
    if (Number.isFinite(n) && n >= 1 && n <= 200) onLengthChange(n)
    else setDraftLength(String(freeSubs?.gameLengthMin ?? 50))
  }

  const btn = {
    fontSize:     12,
    fontWeight:   600,
    padding:      isMobile ? '7px 10px' : '7px 12px',
    borderRadius: 8,
    cursor:       'pointer',
    fontFamily:   'inherit',
    flexShrink:   0,
  }
  const ghostBtn = {
    ...btn,
    background: 'rgba(255,255,255,0.06)',
    border:     '1px solid rgba(255,255,255,0.12)',
    color:      'rgba(255,255,255,0.6)',
  }

  return (
    <div style={{ flexShrink: 0, background: theme.freePanelBg, borderBottom: `1px solid ${theme.freeAccentDim}` }}>
      <div
        className="flex items-center px-3"
        style={{ height: 48, gap: isMobile ? 6 : 8, minWidth: 0 }}
      >
        {/* Which rules this plan is under — and one tap to the other set */}
        <ModeSwitch mode="free" onChange={onExitMode} compact={isMobile} />

        {/* Clock-running dot */}
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: running ? theme.freeAccentBright : 'rgba(255,255,255,0.25)',
          boxShadow:  running ? `0 0 8px ${theme.freeAccentBright}` : 'none',
        }} />

        {/* Clock */}
        <span style={{
          fontSize: isMobile ? 20 : 22, fontWeight: 700, lineHeight: 1, flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
          color: over ? theme.freeAccentBright : '#ffffff',
          textShadow: running ? `0 0 18px ${theme.freeAccentGlow}` : 'none',
        }}>
          {fmtMs(elapsed)}
        </span>

        {/* Game length — click to edit. Hidden on the phone once the game is
            running, where the row needs the room for the controls. */}
        {isMobile && freeSubs?.kickedOff && !editingLength ? null : editingLength ? (
          <input
            autoFocus
            value={draftLength}
            onChange={e => setDraftLength(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={commitLength}
            onKeyDown={e => { if (e.key === 'Enter') commitLength(); if (e.key === 'Escape') setEditingLength(false) }}
            style={{
              width: 52, flexShrink: 0, fontSize: 12, fontFamily: 'inherit',
              padding: '5px 6px', borderRadius: 6, textAlign: 'center',
              background: 'rgba(0,0,0,0.4)', color: '#fff',
              border: `1px solid ${theme.freeAccent}`, outline: 'none',
            }}
          />
        ) : (
          <button
            onClick={() => { setDraftLength(String(freeSubs?.gameLengthMin ?? 50)); setEditingLength(true) }}
            title="Game length — defaults to this division's regulation game"
            style={{
              ...btn, padding: '4px 8px', fontWeight: 500,
              background: 'transparent', border: '1px solid transparent',
              color: 'rgba(255,255,255,0.4)', fontSize: 12,
            }}
          >
            / {freeSubs?.gameLengthMin ?? 50} min
          </button>
        )}

        <div style={{ flex: 1, minWidth: 0 }} />

        {/* Controls */}
        {freeSubs?.ended ? (
          <>
            {!isMobile && (
              <span style={{ fontSize: 11, color: theme.freeAccentBright, fontWeight: 600, flexShrink: 0 }}>
                Final
              </span>
            )}
            {/* Ending by accident should cost one tap to fix, not a whole game */}
            <button
              onClick={onResumeGame}
              title="Undo End — the clock comes back where it stopped"
              style={{
                ...btn,
                background: 'transparent',
                border:     `1px solid ${theme.freeAccent}`,
                color:      theme.freeAccentBright,
                fontWeight: 700,
              }}
            >
              ↩ Resume game
            </button>
            <button onClick={onReset} style={ghostBtn}>Reset</button>
          </>
        ) : (
          <>
            <button
              onClick={running ? onPause : onStart}
              style={{
                ...btn,
                background: running ? 'rgba(255,255,255,0.08)' : theme.freeAccent,
                border:     running ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${theme.freeAccent}`,
                color:      running ? '#ffffff' : '#04222a',
                fontWeight: 700,
                boxShadow:  running ? 'none' : `0 3px 14px ${theme.freeAccentGlow}`,
              }}
            >
              {running ? 'Pause' : freeSubs?.kickedOff ? 'Resume' : 'Kick off'}
            </button>
            {freeSubs?.kickedOff && (
              <button onClick={onEnd} style={ghostBtn}>End</button>
            )}
          </>
        )}

      </div>

      {/* Game progress hairline */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}>
        <div style={{
          height: '100%',
          width:  `${progress}%`,
          background: theme.freeBarFill,
          transition: 'width 0.9s linear',
        }} />
      </div>
    </div>
  )
}
