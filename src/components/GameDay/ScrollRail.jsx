import { useEffect, useRef, useState } from 'react'

/**
 * A drag rail for scrolling a pane that cannot be scrolled by swiping it.
 *
 * The player tags take the gesture the instant they are touched — that is
 * what makes dragging a substitution feel immediate — which leaves nothing to
 * swipe when the bench is taller than its pane. So the scrolling lives in its
 * own strip beside the tags: wide enough for a thumb, with a visible position
 * marker so it reads as a scrollbar rather than decoration.
 *
 * Renders nothing when everything already fits.
 *
 * Props:
 *   targetRef  ref to the scrolling element
 *   accent     colour of the thumb
 *   width      px (default 30)
 */
export default function ScrollRail({ targetRef, accent = 'rgba(255,255,255,0.35)', width = 30 }) {
  const [m, setM]  = useState({ visible: 0, at: 0 })  // fraction visible, fraction scrolled
  const railRef    = useRef(null)
  const dragRef    = useRef(null)

  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    const read = () => {
      const total = el.scrollHeight || 1
      const max   = Math.max(1, total - el.clientHeight)
      setM({ visible: Math.min(1, el.clientHeight / total), at: Math.min(1, el.scrollTop / max) })
    }
    read()
    el.addEventListener('scroll', read, { passive: true })
    // The bench grows and shrinks as players move on and off the field.
    const ro = new ResizeObserver(read)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => { el.removeEventListener('scroll', read); ro.disconnect() }
  }, [targetRef])

  if (m.visible >= 1) return null

  const railH  = railRef.current?.clientHeight || 0
  const thumbH = Math.max(44, railH * m.visible)
  const thumbY = (railH - thumbH) * m.at

  function onPointerDown(e) {
    const el = targetRef.current
    if (!el) return
    e.preventDefault()
    // Capture keeps the drag alive if the finger slides off the rail. It can
    // throw if the pointer is already gone, which must not lose the drag.
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* no live pointer */ }
    dragRef.current = { y: e.clientY, top: el.scrollTop, travel: Math.max(1, railH - thumbH) }
  }

  function onPointerMove(e) {
    const d = dragRef.current
    const el = targetRef.current
    if (!d || !el) return
    // Map rail travel onto scroll travel so the thumb keeps up with the finger.
    const scrollable = Math.max(1, el.scrollHeight - el.clientHeight)
    el.scrollTop = d.top + (e.clientY - d.y) * (scrollable / d.travel)
  }

  function onPointerUp(e) {
    dragRef.current = null
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch { /* already gone */ }
  }

  return (
    <div
      ref={railRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-hidden="true"
      style={{
        width, flexShrink: 0, position: 'relative',
        background: 'rgba(255,255,255,0.03)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        touchAction: 'none',
        cursor: 'grab',
      }}
    >
      {/* Thumb */}
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        top: thumbY, height: thumbH, width: 8, borderRadius: 999,
        background: accent, opacity: 0.75,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Grip dots — says "drag me" rather than "here is a scrollbar" */}
        <span style={{
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 3, height: 3, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)',
            }} />
          ))}
        </span>
      </div>
    </div>
  )
}
