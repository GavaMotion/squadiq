import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

function num(v: string | undefined): number | null {
  const n = parseInt(v ?? '', 10);
  return Number.isNaN(n) ? null : n;
}

// ─── MatchTrak ───────────────────────────────────────────────
function parseMatchTrakHTML(html: string) {
  let cleaned = html;

  // Single pass: strip innermost tables (decorative colored-bar logos with no nested tables)
  cleaned = cleaned.replace(/<table\b[^>]*>(?:[^<]|<(?!\/table>|table\b))*<\/table>/gi, ' ');

  cleaned = cleaned
    .replace(/<\/table>\s*<table[^>]*>/gi, ' ')
    .replace(/<font[^>]*>/gi, '')
    .replace(/<\/font>/gi, '')
    .replace(/<i>/gi, '')
    .replace(/<\/i>/gi, '')
    .replace(/<b>/gi, '')
    .replace(/<\/b>/gi, '')
    .replace(/<img[^>]*>/gi, '');

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const anchorRegex = /<a[^>]*>([\s\S]*?)<\/a>/i;

  const allRows: string[][] = [];
  let rowMatch;

  while ((rowMatch = rowRegex.exec(cleaned)) !== null) {
    const rowHTML = rowMatch[0];
    if (rowHTML.includes('class="header"') || rowHTML.includes('nav')) continue;

    const cells: string[] = [];
    const localCellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = localCellRegex.exec(rowMatch[1])) !== null) {
      let text = cellMatch[1];
      const anchorMatch = anchorRegex.exec(text);
      if (anchorMatch) text = anchorMatch[1];
      text = text.replace(/<[^>]+>/g, '').trim();
      if (text.includes('~')) text = text.split('~')[0].trim();
      cells.push(text);
    }
    if (cells.some(c => c.length > 0)) allRows.push(cells);
  }

  if (allRows.length < 2) return null;

  let headerIdx = -1;
  const colMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(15, allRows.length); i++) {
    const row = allRows[i].map(c => c.toLowerCase().trim());
    const hasPoints = row.some(c => c === 'points' || c === 'pts');
    const hasMP = row.some(c => c === 'mp' || c === 'gp');
    if (hasPoints || hasMP) {
      headerIdx = i;
      let pointsFound = false;
      row.forEach((cell, idx) => {
        if (cell === 'team' || cell === 'club') colMap.team = idx;
        else if (cell === 'mp' || cell === 'gp' || cell === 'played') colMap.gp = idx;
        else if (cell === 'w-l-d' || cell === 'w-l-t' || cell === 'record') colMap.wld = idx;
        else if (cell === 'w') colMap.w = idx;
        else if (cell === 'l') colMap.l = idx;
        else if (cell === 'd' || cell === 't') colMap.t = idx;
        else if (cell === 'gf' || cell === 'f') colMap.gf = idx;
        else if (cell === 'ga' || cell === 'a') colMap.ga = idx;
        else if (cell === 'gd' || cell === 'diff') colMap.gd = idx;
        else if ((cell === 'points' || cell === 'pts') && !pointsFound) {
          colMap.pts = idx;
          pointsFound = true;
        }
      });
      if (colMap.team === undefined) colMap.team = 0;
      break;
    }
  }

  if (headerIdx === -1) return null;

  const rows: any[] = [];
  const seen = new Set<string>();

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (row.length < 3) continue;

    const teamName = row[colMap.team ?? 0]?.trim();
    if (!teamName || teamName.length < 2) continue;
    if (/^[\d\s\-]+$/.test(teamName)) continue;
    const lowerName = teamName.toLowerCase();
    if (lowerName.includes('flight') ||
        lowerName.includes('group') ||
        lowerName.includes('division') ||
        lowerName === 'team') continue;
    if (seen.has(teamName)) continue;
    seen.add(teamName);

    let w = 0, l = 0, t = 0;
    if (colMap.wld !== undefined && row[colMap.wld]) {
      const parts = row[colMap.wld].split('-').map((p: string) => parseInt(p) || 0);
      w = parts[0] || 0;
      l = parts[1] || 0;
      t = parts[2] || 0;
    } else {
      w = parseInt(row[colMap.w ?? -1]) || 0;
      l = parseInt(row[colMap.l ?? -1]) || 0;
      t = parseInt(row[colMap.t ?? -1]) || 0;
    }

    // `parseInt(x) || null` throws away a legitimate 0 — a clean sheet was
    // showing as a blank goals-against and no goal difference at all.
    const gf = colMap.gf !== undefined ? num(row[colMap.gf]) : null;
    const ga = colMap.ga !== undefined ? num(row[colMap.ga]) : null;
    const pts = (colMap.pts !== undefined ? num(row[colMap.pts]) : null) ?? (w * 3 + t);
    const gp = (colMap.gp !== undefined ? num(row[colMap.gp]) : null) ?? (w + l + t);

    if (w === 0 && l === 0 && t === 0 && pts === 0 && gp === 0) continue;

    rows.push({ team: teamName, gp, w, l, t, gf, ga, gd: gf !== null && ga !== null ? gf - ga : null, pts });
  }

  return rows.length > 0 ? rows : null;
}

// A MatchTrak *team* page — .../open-team-open/<id>?opendocument — is the URL
// a coach actually has: it is what the league hands out and what gets
// bookmarked. It holds no standings table itself, so it used to fall through
// to the division picker and surface as "No standings found at this URL".
// It does name the team's division, so resolve it to that division's
// standings and pick up the coach's name on the way (this league labels teams
// in the standings by head coach, so it lets us highlight their row).
async function resolveMatchTrakTeamPage(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
  if (!res.ok) throw new Error(`MatchTrak returned ${res.status}`);
  const html = await res.text();

  // Titles read "MatchTrak - BU14 Q57-Cruttenden_C".
  const title = /<title>[^<]*?MatchTrak\s*[-–]\s*([BG]U?\d{1,2})\b\s*([^<]*)<\/title>/i.exec(html);
  let division = title?.[1]?.toLowerCase() || null;
  const teamKey = title?.[2]?.trim() || null;

  // Fall back to a team key: S11Q-26-Fall-Q57-Cruttenden_C-BU14.
  if (!division) {
    for (const m of html.matchAll(/open-team-open\/([A-Za-z0-9_-]+)/g)) {
      const last = m[1].split('-').pop() || '';
      if (/^[bg]u?\d{1,2}$/i.test(last)) { division = last.toLowerCase(); break; }
    }
  }
  if (!division) return null;

  // The page links every division's standings — take ours rather than
  // rebuilding the category id from the subdomain by hand.
  const cats = [...new Set([...html.matchAll(/RestrictToCategory=([a-z0-9-]+)/gi)].map(m => m[1]))];
  const category = cats.find(c => c.toLowerCase().endsWith('-' + division));
  if (!category) return null;

  const coach = /Head Coach<\/font>[\s\S]{0,400}?<font[^>]*>([^<]+)<\/font>/i.exec(html);
  const base = new URL(url).origin;

  return {
    division,
    teamKey,
    myTeamName: coach?.[1]?.trim() || null,
    label: divisionLabel(division),
    url: `${base}/11/main.nsf/standings-circuit?openview&count=1000&ExpandView&RestrictToCategory=${category}`,
  };
}

function divisionLabel(divPart: string) {
  const gender = divPart.startsWith('b') ? 'Boys' : divPart.startsWith('g') ? 'Girls' : '';
  const age = divPart.replace(/[a-z]/gi, '').trim();
  return gender && age ? `${gender} U${age}` : divPart.toUpperCase();
}

function isMatchTrakTeamPage(url: string) {
  const u = url.toLowerCase();
  return u.includes('open-team-open') || u.includes('open-team');
}

async function fetchMatchTrak(url: string) {
  if (url.includes('RestrictToCategory')) {
    console.log('Fetching MatchTrak division URL:', url);
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    });
    if (!res.ok) throw new Error(`MatchTrak returned ${res.status}`);
    const html = await res.text();
    console.log('HTML length:', html.length);
    const parsed = parseMatchTrakHTML(html);
    console.log('Parsed rows:', parsed?.length);
    if (parsed && parsed.length > 0) return parsed;
    throw new Error('Could not parse standings table from this MatchTrak page');
  }

  throw new Error('Please paste a specific division URL, not the homepage');
}

function parseMatchTrakCSV(csv: string) {
  const lines = csv.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    if (cells.length < 3) continue;
    const row: any = {};
    headers.forEach((h, idx) => {
      const val = cells[idx] || '';
      if (h.includes('team') || h.includes('club') || h.includes('name')) row.team = val;
      else if (h === 'w' || h === 'wins') row.w = parseInt(val) || 0;
      else if (h === 'l' || h === 'losses') row.l = parseInt(val) || 0;
      else if (h === 'd' || h === 't' || h === 'draws' || h === 'ties') row.t = parseInt(val) || 0;
      else if (h === 'gf' || h === 'goals for' || h === 'f') row.gf = parseInt(val) || 0;
      else if (h === 'ga' || h === 'goals against' || h === 'a') row.ga = parseInt(val) || 0;
      else if (h === 'pts' || h === 'points') row.pts = parseInt(val) || 0;
      else if (h === 'gp' || h === 'played' || h === 'mp') row.gp = parseInt(val) || 0;
    });
    if (row.team) {
      row.gp = row.gp || (row.w + row.l + (row.t || 0));
      row.gd = (row.gf || 0) - (row.ga || 0);
      rows.push(row);
    }
  }
  return rows.length > 0 ? rows : null;
}

// ─── TeamSideline ─────────────────────────────────────────────
async function fetchTeamSideline(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error('Could not fetch TeamSideline page');
  const html = await res.text();
  return parseHTMLTable(html);
}

// ─── Generic HTML Table Parser ────────────────────────────────
function parseHTMLTable(html: string) {
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;

  let bestTable: string[][] = [];
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHTML = tableMatch[1];
    const tableRows: string[][] = [];
    let rowMatch;
    const rowRegexLocal = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    while ((rowMatch = rowRegexLocal.exec(tableHTML)) !== null) {
      const cells: string[] = [];
      let cellMatch;
      const cellRegexLocal = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      while ((cellMatch = cellRegexLocal.exec(rowMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim());
      }
      if (cells.length >= 3) tableRows.push(cells);
    }
    if (tableRows.length > bestTable.length) {
      const joined = tableRows.flat().join(' ').toLowerCase();
      if (joined.includes('pts') || joined.includes('points') || joined.includes(' w ') || joined.includes('wins')) {
        bestTable = tableRows;
      }
    }
  }

  if (bestTable.length < 2) return null;

  let headerIdx = 0;
  const colMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(3, bestTable.length); i++) {
    const row = bestTable[i].map(c => c.toLowerCase().trim());
    const hasPts = row.some(c => c === 'pts' || c === 'points' || c === 'pt');
    if (hasPts) {
      headerIdx = i;
      row.forEach((cell, idx) => {
        if (cell === 'w' || cell === 'wins') colMap.w = idx;
        else if (cell === 'l' || cell === 'losses' || cell === 'loss') colMap.l = idx;
        else if (cell === 'd' || cell === 't' || cell === 'ties' || cell === 'draws') colMap.t = idx;
        else if (cell === 'gf' || cell === 'f' || cell === 'goals for') colMap.gf = idx;
        else if (cell === 'ga' || cell === 'a' || cell === 'goals against') colMap.ga = idx;
        else if (cell === 'gd' || cell === 'diff' || cell === 'goal diff') colMap.gd = idx;
        else if (cell === 'pts' || cell === 'points' || cell === 'pt') colMap.pts = idx;
        else if (cell === 'gp' || cell === 'mp' || cell === 'p' || cell === 'played') colMap.gp = idx;
        else if ((cell === 'team' || cell === 'club' || cell === 'name') && colMap.team === undefined) colMap.team = idx;
      });
      if (colMap.team === undefined) colMap.team = 0;
      break;
    }
  }

  const rows: any[] = [];
  for (let i = headerIdx + 1; i < bestTable.length; i++) {
    const row = bestTable[i];
    const teamName = row[colMap.team ?? 0];
    if (!teamName || /^[\d]+$/.test(teamName)) continue;
    const w = parseInt(row[colMap.w ?? -1]) || 0;
    const l = parseInt(row[colMap.l ?? -1]) || 0;
    const t = parseInt(row[colMap.t ?? -1]) || 0;
    const gf = parseInt(row[colMap.gf ?? -1]) || null;
    const ga = parseInt(row[colMap.ga ?? -1]) || null;
    rows.push({
      team: teamName,
      gp: parseInt(row[colMap.gp ?? -1]) || (w + l + t),
      w, l, t,
      gf, ga,
      gd: gf !== null && ga !== null ? gf - ga : parseInt(row[colMap.gd ?? -1]) || null,
      pts: parseInt(row[colMap.pts ?? -1]) || (w * 3 + t),
    });
  }
  return rows.length > 0 ? rows : null;
}

// ─── MatchTrak Division List ──────────────────────────────────
async function fetchMatchTrakDivisions(url: string) {
  const parsedUrl = new URL(url);
  const subdomain = parsedUrl.hostname.split('.')[0];
  const base = `https://${subdomain}.matchtrak.com`;

  const circuitUrl = `${base}/11/main.nsf/standings-circuit?openview&count=1000&ExpandView`;
  const res = await fetch(circuitUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('Could not fetch MatchTrak divisions');
  const html = await res.text();

  const divisionRegex = /RestrictToCategory=([a-z0-9\-]+)/gi;
  const seen = new Set<string>();
  const divisions: { id: string; label: string; url: string }[] = [];

  let match;
  while ((match = divisionRegex.exec(html)) !== null) {
    const categoryId = match[1];
    if (seen.has(categoryId)) continue;
    seen.add(categoryId);

    const parts = categoryId.split('-');
    const divPart = parts[parts.length - 1];
    // The circuit itself ("s11q-26-fall") and the empty category are linked
    // from the same page but are not divisions — offering them as choices
    // just gives the coach a dead end.
    if (!/^[bg]u?\d{1,2}$/i.test(divPart)) continue;
    const gender = divPart.startsWith('b') ? 'Boys' : divPart.startsWith('g') ? 'Girls' : '';
    const age = divPart.replace(/[a-z]/g, '').trim();
    const label = gender && age ? `${gender} U${age}` : divPart.toUpperCase();

    divisions.push({
      id: categoryId,
      label,
      url: `${base}/11/main.nsf/standings-circuit?openview&count=1000&ExpandView&RestrictToCategory=${categoryId}`,
    });
  }

  return divisions.length > 0 ? divisions : null;
}

// ─── Platform Detection ───────────────────────────────────────
function detectPlatform(url: string): string {
  if (url.includes('matchtrak.com')) return 'matchtrak';
  if (url.includes('teamsideline.com')) return 'teamsideline';
  return 'generic';
}

// ─── Main Handler ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { url, teamId, save } = await req.json();
    console.log('scrape-standings called with URL:', url);
    const platform = detectPlatform(url);

    if (platform === 'matchtrak') {
      // The link a coach has is their own team page. Resolve it to that
      // team's division rather than sending them to a division picker.
      if (!url.includes('RestrictToCategory') && isMatchTrakTeamPage(url)) {
        const resolved = await resolveMatchTrakTeamPage(url);
        if (!resolved) {
          throw new Error('Could not work out the division for this team page. Paste the division standings link instead.');
        }
        console.log('Resolved team page to division:', resolved.division, resolved.url);
        const teamStandings = await fetchMatchTrak(resolved.url);
        if (!teamStandings || teamStandings.length === 0) {
          throw new Error('No standings published for this division yet');
        }
        return new Response(
          JSON.stringify({
            standings: teamStandings,
            platform,
            label: resolved.label,
            myTeamName: resolved.myTeamName,
            sourceUrl: resolved.url,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isHomepage = !url.includes('RestrictToCategory');

      if (isHomepage) {
        const divisions = await fetchMatchTrakDivisions(url);
        if (!divisions || divisions.length === 0) {
          throw new Error('Could not find divisions on this MatchTrak page');
        }
        return new Response(
          JSON.stringify({ divisions, needsDivisionPick: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const standings = await fetchMatchTrak(url);
      if (!standings || standings.length === 0) {
        throw new Error('No standings found for this division');
      }
      if (save && teamId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabase.from('standings').upsert({
          team_id: teamId,
          mode: platform,
          table_data: standings,
          updated_at: new Date().toISOString(),
        });
      }
      return new Response(
        JSON.stringify({ standings, platform }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let standings = null;
    if (platform === 'teamsideline') {
      standings = await fetchTeamSideline(url);
    } else {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error('Could not fetch page');
      const html = await res.text();
      standings = parseHTMLTable(html);
    }

    if (!standings || standings.length === 0) {
      throw new Error('No standings table found. Try switching to manual entry.');
    }

    if (save && teamId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await supabase.from('standings').upsert({
        team_id: teamId,
        mode: platform,
        table_data: standings,
        updated_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ standings, platform }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('scrape-standings error:', error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
