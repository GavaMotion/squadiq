// Shared printable line-up report — used by both the Lineup (GameDay) and
// My Team pages. Renders a hidden, white-background report off-screen and
// exports it as an ink-friendly portrait PDF. Blank Goals + Q1-Q4 columns are
// left empty so coaches can mark subs and scorers by hand during the game.
import { getContrastTextColor } from './utils'

// Hidden layout captured by html2canvas. Mount one instance per page; only one
// page is mounted at a time so the shared `#roster-print` id never collides.
export function RosterPrintSheet({ team, players }) {
  const primary  = team?.color_primary || '#1a5c2e'
  const swatches = [team?.color_primary, team?.color_secondary, team?.color_accent].filter(Boolean)
  const sorted   = [...(players || [])].sort((a, b) => (a.jersey_number || 0) - (b.jersey_number || 0))
  const blankRows = Math.max(3, 18 - sorted.length)
  const ink   = '#1a1a1a'
  const line  = '#c9c9d2'
  const soft  = '#6b6b7a'
  const cell  = { border: `1px solid ${line}`, height: 26, padding: '0 8px' }
  const qcell = { border: `1px solid ${line}`, width: 46 }
  const fillLine = (label, w) => (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 6, marginRight: 18, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: ink }}>{label}</span>
      <span style={{ display: 'inline-block', width: w, borderBottom: `1px solid ${ink}`, height: 14 }} />
    </span>
  )
  return (
    <div id="roster-print" style={{
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
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>Line-Up Report</div>
          <div style={{ fontSize: 12, color: soft }}>
            Squad<span style={{ color: primary, fontWeight: 700 }}>IQ</span> · Soccer Coach
          </div>
        </div>
      </div>

      {/* Team info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: 12, marginBottom: 14 }}>
        <div><b>Team Name:</b> {team?.name || '__________'}</div>
        <div><b>Division:</b> {team?.division || '______'} <span style={{ color: soft }}>&nbsp;&nbsp;Region: ______</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <b>Team Colors:</b>
          {swatches.length
            ? swatches.map((c, i) => (
                <span key={i} style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: c, border: `1px solid ${line}` }} />
              ))
            : <span style={{ color: soft }}>__________</span>}
        </div>
        <div style={{ color: ink }}><b>Team Coach:</b> <span style={{ display: 'inline-block', width: 150, borderBottom: `1px solid ${ink}` }} /></div>
        <div />
        <div><b>Asst. Coach:</b> <span style={{ display: 'inline-block', width: 150, borderBottom: `1px solid ${ink}` }} /></div>
      </div>

      {/* Roster table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f2f2f5' }}>
            <th style={{ ...cell, width: 56, fontWeight: 700 }}>Jersey&nbsp;#</th>
            <th style={{ ...cell, textAlign: 'left', fontWeight: 700 }}>Player Name <span style={{ fontWeight: 400, color: soft }}>*</span></th>
            <th style={{ ...cell, width: 54, fontWeight: 700 }}>Goals</th>
            <th style={{ ...qcell, fontWeight: 700 }}>Q1</th>
            <th style={{ ...qcell, fontWeight: 700 }}>Q2</th>
            <th style={{ ...qcell, fontWeight: 700 }}>Q3</th>
            <th style={{ ...qcell, fontWeight: 700 }}>Q4</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => {
            const isGK = (p.positions || []).includes('GK')
            return (
              <tr key={p.id}>
                <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{p.jersey_number}</td>
                <td style={{ ...cell, textAlign: 'left' }}>
                  {p.name}{isGK && <span style={{ color: soft, fontWeight: 700 }}> — GK</span>}
                </td>
                <td style={cell} />
                <td style={qcell} /><td style={qcell} /><td style={qcell} /><td style={qcell} />
              </tr>
            )
          })}
          {Array.from({ length: blankRows }).map((_, i) => (
            <tr key={`blank-${i}`}>
              <td style={cell} /><td style={cell} /><td style={cell} />
              <td style={qcell} /><td style={qcell} /><td style={qcell} /><td style={qcell} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div style={{ fontSize: 10.5, color: soft, textAlign: 'center', margin: '8px 0 14px' }}>
        * GK = Goalkeeper · C = Captain · A = Alt. Captain — all players on the roster must be listed; indicate the reason for any absence.
      </div>

      {/* Game info fill lines */}
      <div style={{ borderTop: `1px solid ${line}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
        <div>{fillLine('Date', 120)}{fillLine('Time', 90)}{fillLine('Field', 160)}</div>
        <div>{fillLine('Halftime Score', 90)}{fillLine('In Favor Of', 150)}</div>
        <div>{fillLine('Final Score', 90)}{fillLine('Winning Team', 130)}{fillLine('Losing Team', 130)}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 10, color: soft }}>
        <span>Referee must sign reverse side.</span>
        <span>Created with SquadIQ · squadiq.online</span>
      </div>
    </div>
  )
}

// Capture the hidden report and save/share it as a US-Letter portrait PDF.
export async function exportRosterSheet(team) {
  const el = document.getElementById('roster-print')
  if (!el) return
  const html2canvas = (await import('html2canvas')).default
  el.style.left = '0'
  el.style.position = 'absolute'
  const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true, allowTaint: false })
  el.style.left = '-9999px'
  el.style.position = 'fixed'

  const fileName = `${team?.name || 'team'}-lineup-report`
  const { jsPDF } = await import('jspdf')
  const pageW = 612, pageH = 792, margin = 24
  const imgW  = pageW - margin * 2
  const imgH  = (canvas.height / canvas.width) * imgW
  const pdf   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, Math.min(imgH, pageH - margin * 2))
  const pdfBlob = pdf.output('blob')
  const file = new File([pdfBlob], `${fileName}.pdf`, { type: 'application/pdf' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: `${team?.name} Line-Up Report`, files: [file] })
  } else {
    pdf.save(`${fileName}.pdf`)
  }
}
