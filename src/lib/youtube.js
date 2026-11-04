// One place that understands YouTube links, so every screen agrees:
// watch?v=, Shorts, youtu.be, embed, live and m./music. hosts.
const ID_RE = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([\w-]{6,})/i

export function youTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const m = url.trim().match(ID_RE)
  return m ? m[1] : null
}

export function isYouTubeShort(url) {
  return /youtube\.com\/shorts\//i.test(url || '')
}

export function youTubeThumb(url) {
  const id = youTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}

export function youTubeEmbed(url) {
  const id = youTubeId(url)
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1` : null
}
