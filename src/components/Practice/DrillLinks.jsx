import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../UI/Toast'

// ── YouTube thumbnail extractor ──────────────────────────────────
function ytThumb(url) {
  const m = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([\w-]+)/)
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null
}

function isYouTube(url) {
  return /youtube\.com|youtu\.be/.test(url)
}

function isInstagram(url) {
  return /instagram\.com/.test(url)
}

// ── Link pill / card ─────────────────────────────────────────────
function LinkItem({ link, onDelete }) {
  const thumb = isYouTube(link.url) ? ytThumb(link.url) : null
  const isIG  = isInstagram(link.url)

  return (
    <div
      className="group relative flex items-center gap-2 rounded-lg border border-gray-700 overflow-hidden cursor-pointer hover:border-gray-500 transition"
      style={{ background: '#1f2937', minWidth: 0 }}
      onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
    >
      {/* Thumbnail or icon */}
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className="flex-shrink-0 object-cover"
          style={{ width: 56, height: 40 }}
          onError={e => { e.target.style.display = 'none' }}
        />
      ) : isIG ? (
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}
        >
          {/* Instagram icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="white" strokeWidth="2" fill="none" />
            <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" fill="none" />
            <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
          </svg>
        </div>
      ) : (
        <div
          className="flex-shrink-0 flex items-center justify-center text-gray-400"
          style={{ width: 40, height: 40 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
      )}

      {/* Label */}
      <span className="text-xs text-gray-300 truncate flex-1 pr-7 py-1" style={{ minWidth: 0 }}>
        {link.label || new URL(link.url).hostname.replace('www.', '')}
      </span>

      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(link.id) }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-red-900/80 flex items-center justify-center text-red-300 hover:bg-red-700 transition"
        title="Remove link"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
          <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ── Add link form ────────────────────────────────────────────────
function AddLinkForm({ onAdd, onCancel, color }) {
  const [url, setUrl]     = useState('')
  const [label, setLabel] = useState('')
  const [err, setErr]     = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) { setErr('URL is required'); return }
    try { new URL(trimmed) } catch { setErr('Enter a valid URL (include https://)'); return }
    onAdd(trimmed, label.trim())
    setUrl('')
    setLabel('')
    setErr('')
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2">
      <input
        type="url"
        placeholder="https://youtube.com/watch?v=..."
        value={url}
        onChange={e => { setUrl(e.target.value); setErr('') }}
        className="text-xs rounded-lg px-3 py-2 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 transition"
        autoFocus
      />
      <input
        type="text"
        placeholder="Label (optional) — e.g. YouTube drill demo"
        value={label}
        onChange={e => setLabel(e.target.value)}
        className="text-xs rounded-lg px-3 py-2 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 transition"
      />
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition"
          style={{ background: color }}
        >
          Add Link
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Main DrillLinks component ────────────────────────────────────
/**
 * Shows saved links for a drill and allows adding/deleting them.
 * Props:
 *   teamId    string  — the team's UUID
 *   drillName string  — the drill's display name
 *   color     string  — accent color from the category
 */
export default function DrillLinks({ teamId, drillName, color }) {
  const [links, setLinks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const { addToast }          = useToast()

  useEffect(() => {
    // Without a team or a drill name the link is unaddressable — it would save
    // against a null key and never be found again. Stop loading so the UI can say so.
    if (!teamId || !drillName) { setLoading(false); return }
    setLoading(true)
    supabase
      .from('drill_links')
      .select('*')
      .eq('team_id', teamId)
      .eq('drill_name', drillName)
      .order('created_at')
      .then(({ data, error }) => {
        if (error) addToast('Could not load drill links', 'error')
        setLinks(data || [])
        setLoading(false)
      })
  }, [teamId, drillName])

  async function handleAdd(url, label) {
    if (!teamId || !drillName) {
      addToast('Cannot save link — no team selected for this drill', 'error')
      return
    }
    const { data, error } = await supabase
      .from('drill_links')
      .insert({ team_id: teamId, drill_name: drillName, url, label })
      .select()
      .single()
    if (error || !data) {
      addToast(`Could not save link${error?.message ? ' — ' + error.message : ''}`, 'error')
      return
    }
    setLinks(prev => [...prev, data])
    setAdding(false)
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('drill_links').delete().eq('id', id)
    if (error) { addToast('Could not remove link', 'error'); return }
    setLinks(prev => prev.filter(l => l.id !== id))
  }

  if (loading) return null

  if (!teamId || !drillName) {
    return (
      <div className="px-3 pb-3 mt-2">
        <p className="text-xs text-gray-500">Links can't be saved for this drill right now.</p>
      </div>
    )
  }

  return (
    <div className="px-3 pb-3 mt-2">
      {links.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          {links.map(link => (
            <LinkItem key={link.id} link={link} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {adding ? (
        <AddLinkForm
          color={color}
          onAdd={handleAdd}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs transition"
          style={{ color: color + 'aa' }}
          onMouseEnter={e => (e.currentTarget.style.color = color)}
          onMouseLeave={e => (e.currentTarget.style.color = color + 'aa')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add link
        </button>
      )}
    </div>
  )
}
