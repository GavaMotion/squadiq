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
  onStart, onPause, onEnd, onReset, onLengthChange, onExitMode, onResumeGame, onKeepPlaying,
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

  // Phones can't fit switch + clock + length + buttons in one row, so they get
  // two: rules on top (like the Quarters mode row), the live clock below.
  const rowStyle = h => ({ height: h, gap: isMobile ? 6 : 8, minWidth: 0 })
  return (
    <div style={{ flexShrink: 0, background: theme.freePanelBg, borderBottom: `1px solid ${theme.freeAccentDim}` }}>
      {isMobile ? (
        <>
          <div className="flex items-center px-3" style={rowStyle(42)}>
        {/* Which rules this plan is under — and one tap to the other set */}
        <ModeSwitch mode="free" onChange={onExitMode} compact={isMobile} />

            <div style={{ flex: 1, minWidth: 0 }} />
        {/* Game length — tap to edit. Always shown, and styled as a button so
            coaches can see it's changeable (reviewers missed the faint text). */}
        {editingLength ? (
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
            title="Game length — tap to change"
            aria-label={`Game length ${freeSubs?.gameLengthMin ?? 50} minutes, tap to change`}
            style={{
              ...btn, padding: isMobile ? '0 7px' : '0 9px', minHeight: 30, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.8)', fontSize: 12, fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            / {freeSubs?.gameLengthMin ?? 50} min
          </button>
        )}

          </div>
          <div className="flex items-center px-3" style={rowStyle(46)}>
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
              aria-label={running ? 'Pause clock' : freeSubs?.kickedOff ? 'Resume clock' : 'Kick off — start the clock'}
              style={{
                ...btn, minHeight: 36, fontSize: 13, padding: isMobile ? '0 11px' : '0 14px',
                whiteSpace: 'nowrap',
                background: running ? 'rgba(255,255,255,0.08)' : theme.freeAccent,
                border:     running ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${theme.freeAccent}`,
                color:      running ? '#ffffff' : '#04222a',
                fontWeight: 700,
                boxShadow:  running ? 'none' : `0 3px 14px ${theme.freeAccentGlow}`,
              }}
            >
              {running ? '❚❚ Pause' : freeSubs?.autoStopped ? '▶ Keep playing' : freeSubs?.kickedOff ? '▶ Resume' : '▶ Kick off'}
            </button>
            {freeSubs?.kickedOff && (
              <button onClick={onEnd} aria-label="End game" style={{ ...ghostBtn, minHeight: 36, whiteSpace: 'nowrap' }}>■ End</button>
            )}
          </>
        )}

          </div>
        </>
      ) : (
        <div className="flex items-center px-3" style={rowStyle(48)}>
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

        {/* Game length — tap to edit. Always shown, and styled as a button so
            coaches can see it's changeable (reviewers missed the faint text). */}
        {editingLength ? (
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
            title="Game length — tap to change"
            aria-label={`Game length ${freeSubs?.gameLengthMin ?? 50} minutes, tap to change`}
            style={{
              ...btn, padding: isMobile ? '0 7px' : '0 9px', minHeight: 30, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.8)', fontSize: 12, fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
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
              aria-label={running ? 'Pause clock' : freeSubs?.kickedOff ? 'Resume clock' : 'Kick off — start the clock'}
              style={{
                ...btn, minHeight: 36, fontSize: 13, padding: isMobile ? '0 11px' : '0 14px',
                whiteSpace: 'nowrap',
                background: running ? 'rgba(255,255,255,0.08)' : theme.freeAccent,
                border:     running ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${theme.freeAccent}`,
                color:      running ? '#ffffff' : '#04222a',
                fontWeight: 700,
                boxShadow:  running ? 'none' : `0 3px 14px ${theme.freeAccentGlow}`,
              }}
            >
              {running ? '❚❚ Pause' : freeSubs?.autoStopped ? '▶ Keep playing' : freeSubs?.kickedOff ? '▶ Resume' : '▶ Kick off'}
            </button>
            {freeSubs?.kickedOff && (
              <button onClick={onEnd} aria-label="End game" style={{ ...ghostBtn, minHeight: 36, whiteSpace: 'nowrap' }}>■ End</button>
            )}
          </>
        )}

        </div>
      )}

      {/* The clock stopped itself at full time — say so, and offer the two
          things a coach does next. */}
      {freeSubs?.autoStopped && !freeSubs?.ended && !running && (
        <div role="status" className="flex items-center px-3" style={{
          gap: 8, minHeight: 44, flexWrap: 'wrap', padding: '6px 12px',
          background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, flex: '1 1 140px', minWidth: 0 }}>
            🏁 Full time — clock stopped at {freeSubs.gameLengthMin}:00
          </span>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, flex: '1 1 100%' }}>
            Extra time? Tap Keep playing. Otherwise tap End.
          </span>
        </div>
      )}

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
