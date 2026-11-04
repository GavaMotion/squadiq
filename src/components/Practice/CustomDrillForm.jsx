import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../contexts/AppContext'
import { CATEGORY_META, CATEGORY_ORDER, DIVISIONS_ORDER } from '../../lib/drills'
import { youTubeId } from '../../lib/youtube'

const PHASE_OPTIONS = [
  { value: 'warm-up',          label: 'Warm-Up' },
  { value: 'skill-work',       label: 'Skill Work' },
  { value: 'small-sided-game', label: 'Small-Sided Game' },
]

function isValidUrl(str) {
  try { new URL(str); return true } catch { return false }
}

const getYouTubeId = youTubeId

// ── Dynamic list field (coaching points / variations) ─────────────
function DynamicList({ items, onChange, placeholder }) {
  const [input, setInput] = useState('')

  function add() {
    const v = input.trim()
    if (!v) return
    onChange([...items, v])
    setInput('')
  }

  function remove(idx) {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ flex: 1, fontSize: 12, color: '#d1d5db', background: '#1f2937', borderRadius: 6, padding: '5px 8px', lineHeight: 1.4 }}>
            {item}
          </span>
          <button
            type="button"
            onClick={() => remove(idx)}
            style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Remove"
          >×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 5 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={add}
          style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 6, background: 'var(--team-primary, #1a5c2e)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >+</button>
      </div>
    </div>
  )
}

const inputStyle = {
  flex: 1,
  background: '#1f2937',
  border: '1px solid #374151',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  color: '#fff',
  outline: 'none',
  width: '100%',
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#9ca3af',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

// ── Main form ─────────────────────────────────────────────────────
/**
 * Props:
 *   initial   object|null  — drill to edit (null = create new)
 *   onSaved   fn(dbRow)    — called with the saved DB row
 *   onCancel  fn
 */
export default function CustomDrillForm({ initial, onSaved, onCancel }) {
  const { userId, addCustomDrill, updateCustomDrill } = useApp()

  const [name,        setName]        = useState(initial?.name        || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [category,    setCategory]    = useState(initial?.category    || 'dribbling')
  const [minDiv,      setMinDiv]      = useState(initial?.minDivision || '8U')
  const [duration,    setDuration]    = useState(initial?.duration    ?? '')
  const [phase,       setPhase]       = useState(initial?.phase       || 'skill-work')
  const [points,      setPoints]      = useState(initial?.coachingPoints || [])
  const [variations,  setVariations]  = useState(initial?.variations  || [])
  const [videoUrl,    setVideoUrl]    = useState(initial?.videoUrl    || '')
  const [imageUrl,    setImageUrl]    = useState(initial?.imageUrl    || null)

  const [imageFile,   setImageFile]   = useState(null)
  const [imagePreview, setImagePreview] = useState(initial?.imageUrl || null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const fileRef = useRef(null)

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setImageUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const videoIsYouTube = videoUrl && getYouTubeId(videoUrl)
  const videoIsValid   = !videoUrl || isValidUrl(videoUrl)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!name.trim())        return setError('Name is required.')
    if (!description.trim()) return setError('Description is required.')
    if (!duration || isNaN(Number(duration)) || Number(duration) < 1)
                             return setError('Duration must be a positive number.')
    if (videoUrl && !isValidUrl(videoUrl)) return setError('Video URL is not valid.')

    setSaving(true)
    try {
      let finalImageUrl = imageUrl

      // Upload new image if selected
      if (imageFile) {
        const ext = imageFile.name.split('.').pop().toLowerCase()
        const path = `${userId}/${crypto.randomUUID()}.${ext}`
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('drill-images').upload(path, imageFile, { upsert: false })
        if (uploadErr) throw new Error('Image upload failed — please check your file is a JPG, PNG or WebP under 5MB')
        const { data: { publicUrl } } = supabase.storage
          .from('drill-images').getPublicUrl(uploadData.path)
        finalImageUrl = publicUrl
      }

      const payload = {
        user_id:          userId,
        name:             name.trim(),
        description:      description.trim(),
        skill_category:   category,
        min_age_division: minDiv,
        duration_minutes: Number(duration),
        phase,
        coaching_points:  points,
        variations,
        image_url:        finalImageUrl || null,
        video_url:        videoUrl.trim() || null,
        is_custom:        true,
      }

      if (initial?.id) {
        // Update
        const { data, error: err } = await supabase
          .from('custom_drills').update(payload).eq('id', initial.id).select().single()
        if (err) throw err
        updateCustomDrill(initial.id, data)
        onSaved(data)
      } else {
        // Insert
        const { data, error: err } = await supabase
          .from('custom_drills').insert(payload).select().single()
        if (err) throw err
        addCustomDrill(data)
        onSaved(data)
      }
    } catch (err) {
      setError(err.message || 'Failed to save drill.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: '14px 14px 20px',
        background: '#0a0d14',
        borderBottom: '1px solid #1f2937',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
          {initial ? 'Edit Drill' : 'Add My Drill'}
        </span>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
        >×</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Name */}
        <div>
          <label style={labelStyle}>Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Box Passing Drill"
            style={inputStyle}
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description *</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="How the drill works..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
          />
        </div>

        {/* Category + Phase row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelStyle}>Category *</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
              {CATEGORY_ORDER.map(k => (
                <option key={k} value={k}>{CATEGORY_META[k]?.label || k}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Phase *</label>
            <select value={phase} onChange={e => setPhase(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
              {PHASE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Division + Duration row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelStyle}>Min Division *</label>
            <select value={minDiv} onChange={e => setMinDiv(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
              {DIVISIONS_ORDER.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Duration (min) *</label>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="e.g. 10"
              min={1}
              max={120}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Coaching Points */}
        <div>
          <label style={labelStyle}>Coaching Points</label>
          <DynamicList
            items={points}
            onChange={setPoints}
            placeholder="Add a coaching point, press Enter or +"
          />
        </div>

        {/* Variations */}
        <div>
          <label style={labelStyle}>Variations <span style={{ color: '#4b5563', fontWeight: 400 }}>(optional)</span></label>
          <DynamicList
            items={variations}
            onChange={setVariations}
            placeholder="Add a variation, press Enter or +"
          />
        </div>

        {/* Image upload */}
        <div>
          <label style={labelStyle}>Drill Image <span style={{ color: '#4b5563', fontWeight: 400 }}>(optional)</span></label>
          {imagePreview ? (
            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
              <img src={imagePreview} alt="Drill" style={{ width: '100%', display: 'block', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }} />
              <button
                type="button"
                onClick={clearImage}
                style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
                  cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%', padding: '10px', borderRadius: 8,
                border: '1.5px dashed #374151', background: 'transparent',
                color: '#6b7280', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Upload image (JPG / PNG)
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Video URL */}
        <div>
          <label style={labelStyle}>Video Link <span style={{ color: '#4b5563', fontWeight: 400 }}>(optional)</span></label>
          <input
            type="text"
            value={videoUrl}
            onChange={e => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/... or any URL"
            style={{ ...inputStyle, borderColor: videoUrl && !videoIsValid ? '#ef4444' : '#374151' }}
          />
          {/* YouTube thumbnail preview */}
          {videoIsYouTube && (
            <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
              <img
                src={`https://img.youtube.com/vi/${getYouTubeId(videoUrl)}/mqdefault.jpg`}
                alt="YouTube thumbnail"
                style={{ width: '100%', display: 'block', borderRadius: 8 }}
              />
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.3)',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="white"><polygon points="3,1 11,6 3,11" /></svg>
                </div>
              </div>
            </div>
          )}
          {videoUrl && !videoIsValid && (
            <p style={{ color: '#f87171', fontSize: 10, marginTop: 3 }}>Not a valid URL</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '7px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', fontSize: 11, color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {/* Submit row */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1, padding: '9px', borderRadius: 8, fontSize: 12,
              fontWeight: 700, color: '#fff', border: 'none',
              background: saving ? '#374151' : 'linear-gradient(135deg, var(--team-primary, #1a5c2e), color-mix(in srgb, var(--team-primary, #1a5c2e) 80%, #000))',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add to Library'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'transparent', border: '1px solid #374151', color: '#9ca3af', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>

      </form>
    </div>
  )
}
