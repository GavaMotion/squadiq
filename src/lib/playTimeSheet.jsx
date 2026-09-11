// Printable playing-time report for a Free Subs game.
//
// Same shape as the roster sheet: a hidden, white, ink-friendly page rendered
// off-screen and captured to PDF. This is the record a coach hands a parent
// who asks how much their kid played, so it shows the stints too, not just a
// total — "14:00" is an assertion, "0:00–8:20, 19:40–25:20" is evidence.
import { getContrastTextColor } from './utils'
import { fmtMs, pctOf, playedMsFor, segmentsFor, totalMs } from './freeSubs'

export function PlayTimeSheet({ team, players, freeSubs, nowMs }) {
  const primary = team?.color_primary || '#1a5c2e'
  const ink     = '#1a1a1a'
  const line    = '#c9c9d2'
  const soft    = '#6b6b7a'
  const bar     = '#0e7490'

  const stints = freeSubs?.stints || []
  const total  = totalMs(freeSubs)
  const rows   = [...(players || [])]
    .map(p => ({
      player: p,
      ms:     playedMsFor(stints, p.id, nowMs),
      spells: stints
        .filter(s => s.playerId === p.id)
        .sort((a, b) => a.in - b.in)
        .map(s => `${fmtMs(s.in)}–${s.out === null ? fmtMs(nowMs) : fmtMs(s.out)}`),
      segs:   segmentsFor(stints, p.id, nowMs, total),
    }))
    .sort((a, b) => b.ms - a.ms || (a.player.jersey_number ?? 0) - (b.player.jersey_number ?? 0))

  const played  = rows.filter(r => r.ms > 0)
  const most    = played.length ? played[0].ms : 0
  const least   = rows.length ? rows[rows.length - 1].ms : 0
  const average = rows.length ? Math.round(rows.reduce((a, r) => a + r.ms, 0) / rows.length) : 0

  const th = { border: `1px solid ${line}`, padding: '5px 7px', fontSize: 10, fontWeight: 700,
               background: '#f1f1f5', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em' }
  const td = { border: `1px solid ${line}`, padding: '4px 7px', fontSize: 11, verticalAlign: 'middle' }

  const stat = (label, value) => (
    <div style={{ border: `1px solid ${line}`, borderRadius: 4, padding: '6px 8px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 8, color: soft, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: ink, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )

  return (
    <div id="playtime-print" style={{
      position: 'fixed', left: '-9999px', top: 0, width: 760,
      background: '#fff', color: ink, padding: 28,
      fontFamily: 'Arial, Helvetica, sans-serif', boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: `2px solid ${primary}`, paddingBottom: 12, marginBottom: 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
          background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, color: getContrastTextColor(primary),
        }}>
          {team?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>Playing Time Report</div>
          <div style={{ fontSize: 12, color: soft }}>
            Squad<span style={{ color: primary, fontWeight: 700 }}>IQ</span> · Free subs
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: soft }}>
          <div><b style={{ color: ink }}>{team?.name || '—'}</b></div>
          <div>{team?.division || '—'} · {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* Game summary */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {stat(freeSubs?.ended ? 'Final time' : 'Game clock', fmtMs(nowMs))}
        {stat('Game length', `${freeSubs?.gameLengthMin ?? '—'} min`)}
        {stat('Players used', `${played.length}/${rows.length}`)}
        {stat('Most', fmtMs(most))}
        {stat('Least', fmtMs(least))}
        {stat('Average', fmtMs(average))}
        {stat('Spread', fmtMs(most - least))}
      </div>

      {/* Per-player table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 34, textAlign: 'center' }}>#</th>
            <th style={{ ...th }}>Player</th>
            <th style={{ ...th, width: 150 }}>Share of game</th>
            <th style={{ ...th, width: 58, textAlign: 'right' }}>Time</th>
            <th style={{ ...th, width: 44, textAlign: 'right' }}>%</th>
            <th style={{ ...th, width: 190 }}>On the field</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, ms, spells, segs }) => (
            <tr key={player.id}>
              <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{player.jersey_number}</td>
              <td style={{ ...td }}>{player.name}</td>
              <td style={{ ...td }}>
                {/* Same bar as the app, in ink-friendly colours */}
                <div style={{ position: 'relative', height: 9, background: '#e8e8ee', border: `1px solid ${line}`, borderRadius: 2 }}>
                  {segs.map((s, i) => (
                    <div key={i} style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: `${s.leftPct}%`, width: `${s.widthPct}%`,
                      minWidth: 1, background: bar,
                    }} />
                  ))}
                </div>
              </td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtMs(ms)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{pctOf(ms, total)}%</td>
              <td style={{ ...td, fontSize: 9, color: soft }}>
                {spells.length ? spells.join(', ') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, fontSize: 9, color: soft, display: 'flex', justifyContent: 'space-between' }}>
        <span>Times are game clock, excluding stoppages while the clock was paused.</span>
        <span>Coach: ______________________</span>
      </div>
    </div>
  )
}

export async function exportPlayTimeSheet(team) {
  const el = document.getElementById('playtime-print')
  if (!el) return
  const html2canvas = (await import('html2canvas')).default
  el.style.left = '0'
  el.style.position = 'absolute'
  const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true, allowTaint: false })
  el.style.left = '-9999px'
  el.style.position = 'fixed'

  const fileName = `${team?.name || 'team'}-playing-time`
  const { jsPDF } = await import('jspdf')
  const pageW = 612, pageH = 792, margin = 24
  const imgW  = pageW - margin * 2
  const imgH  = (canvas.height / canvas.width) * imgW
  const pdf   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, Math.min(imgH, pageH - margin * 2))
  const pdfBlob = pdf.output('blob')
  const file = new File([pdfBlob], `${fileName}.pdf`, { type: 'application/pdf' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: `${team?.name} Playing Time`, files: [file] })
  } else {
    pdf.save(`${fileName}.pdf`)
  }
}
