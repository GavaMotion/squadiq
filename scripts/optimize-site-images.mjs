// Optimize large source images into web-ready assets for the squadiq.online marketing site.
// Run: node scripts/optimize-site-images.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SRC = 'public'
const OUT = 'site'
// Tagged-template helper for the external brand-art folder.
const ARTS = (s) => 'E:/Gavamotion/APPS/SquadIQ/assets/arts/' + s[0]

mkdirSync(`${OUT}/assets`, { recursive: true })
mkdirSync(`${OUT}/features`, { recursive: true })

const jobs = [
  // Hero phone screenshot (portrait). Source is ~5.6MB — shrink hard.
  { in: `${SRC}/cover_V.png`, out: `${OUT}/assets/hero.webp`, width: 820, fmt: 'webp', q: 82 },
  { in: `${SRC}/cover_V.png`, out: `${OUT}/assets/hero.png`,  width: 820, fmt: 'png' },
  // Wide dashboard shot for the "everything in one place" band.
  { in: `${SRC}/cover_H.png`, out: `${OUT}/assets/wide.webp`, width: 1200, fmt: 'webp', q: 82 },
  // Feature thumbnails (portrait phone shots ~3:4).
  { in: `${SRC}/features/team.png`,      out: `${OUT}/features/team.webp`,      width: 560, fmt: 'webp', q: 80 },
  { in: `${SRC}/features/lineup.png`,    out: `${OUT}/features/lineup.webp`,    width: 560, fmt: 'webp', q: 80 },
  { in: `${SRC}/features/sketch.png`,    out: `${OUT}/features/sketch.webp`,    width: 560, fmt: 'webp', q: 80 },
  { in: `${SRC}/features/practice.png`,  out: `${OUT}/features/practice.webp`,  width: 560, fmt: 'webp', q: 80 },
  { in: `${SRC}/features/standings.jpg`, out: `${OUT}/features/standings.webp`, width: 560, fmt: 'webp', q: 80 },
  // App icon / logo + favicon.
  { in: `${SRC}/icons/icon-192.png`, out: `${OUT}/assets/icon.png`, width: 192, fmt: 'png' },
  { in: `${SRC}/favicon.png`,        out: `${OUT}/favicon.png`,     width: 64,  fmt: 'png' },
  // Brand art from E:\Gavamotion\APPS\SquadIQ\assets\arts
  { in: ARTS`cover_H site.png`,   out: `${OUT}/assets/bg.webp`,           width: 1600, fmt: 'webp', q: 78 },
  { in: ARTS`logo_squadiq.png`,   out: `${OUT}/assets/logo_squadiq.png`,  width: 520,  fmt: 'png' },
  { in: ARTS`bygavamotion.png`,   out: `${OUT}/assets/bygavamotion.png`,  width: 320,  fmt: 'png' },
  // Social share image (Open Graph) — 1200x630 with the wide shot centered on brand bg.
]

for (const j of jobs) {
  let img = sharp(j.in).resize({ width: j.width, withoutEnlargement: true })
  if (j.fmt === 'webp') img = img.webp({ quality: j.q })
  else if (j.fmt === 'png') img = img.png({ compressionLevel: 9, quality: 90 })
  await img.toFile(j.out)
  console.log('✓', j.out)
}

// Dark-background logo variant: recolor the black "Squad" to white, keep the green "IQ".
// (The brand logo has black text + green accent; black is invisible on the dark site.)
{
  const { data, info } = await sharp(ARTS`logo_squadiq.png`)
    .resize({ width: 560, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const greenish = g > 90 && g > r * 1.25 && g > b * 1.25
    if (!greenish) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255 } // ink -> white, alpha preserved
  }
  await sharp(data, { raw: { width, height, channels } }).png().toFile(`${OUT}/assets/logo_squadiq_dark.png`)
  console.log('✓', `${OUT}/assets/logo_squadiq_dark.png`)
}

// Feature screenshots: crop the phone OS status/nav bars off, export clean web thumbnails.
const SHOTS = (s) => 'E:/Gavamotion/APPS/SquadIQ/assets/screenshots/' + s[0]
const shotJobs = [
  { in: SHOTS`2-roster.jpeg`,    out: 'shot-team' },
  { in: SHOTS`4-formation.jpeg`, out: 'shot-lineup' },
  { in: SHOTS`5-sketch.jpeg`,    out: 'shot-sketch' },
  { in: SHOTS`6-practice.jpeg`,  out: 'shot-practice' },
  { in: SHOTS`8-standings.jpeg`, out: 'shot-standings' },
  { in: SHOTS`1-intro.jpeg`,     out: 'shot-intro' },
  { in: SHOTS`9 - freesubs.jpg`, out: 'shot-freesubs' },
  // Full-width variant for the feature detail page.
  { in: SHOTS`9 - freesubs.jpg`, out: 'freesubs', width: 560 },
]
for (const j of shotJobs) {
  const meta = await sharp(j.in).metadata()
  const top = Math.round(meta.height * 0.035)     // system status bar
  const bottom = Math.round(meta.height * 0.05)   // android nav bar
  await sharp(j.in)
    .extract({ left: 0, top, width: meta.width, height: meta.height - top - bottom })
    .resize({ width: j.width ?? 520, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(`${OUT}/features/${j.out}.webp`)
  console.log('✓', `${OUT}/features/${j.out}.webp`)
}

// Open Graph card: 1200x630, brand background, wide screenshot inset.
const ogBg = { create: { width: 1200, height: 630, channels: 4, background: '#0d0d1a' } }
const inset = await sharp(`${SRC}/cover_H.png`)
  .resize({ width: 1040, height: 470, fit: 'inside', withoutEnlargement: true })
  .png().toBuffer()
const insetMeta = await sharp(inset).metadata()
await sharp(ogBg)
  .composite([{ input: inset, top: Math.round((630 - insetMeta.height) / 2), left: Math.round((1200 - insetMeta.width) / 2) }])
  .png()
  .toFile(`${OUT}/assets/og.png`)
console.log('✓', `${OUT}/assets/og.png`)

console.log('done')
