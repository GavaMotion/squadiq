/**
 * Supabase Edge Function: practice-plan
 * ──────────────────────────────────────
 * Proxies a request to the Anthropic Claude API to generate a custom
 * 60-minute AYSO practice plan. The API key is stored as a Supabase
 * secret — it is NEVER exposed to the browser.
 *
 * ── One-time setup ────────────────────────────────────────────────
 *   npm install -g supabase          # install CLI if needed
 *   supabase login
 *   supabase link --project-ref <your-project-ref>
 *
 *   # Store the key as a server-side secret:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *
 *   # Deploy this function:
 *   supabase functions deploy practice-plan --no-verify-jwt
 *
 * ── Local development ─────────────────────────────────────────────
 *   Create  supabase/.env  (gitignored) with:
 *     ANTHROPIC_API_KEY=sk-ant-...
 *
 *   Then run:
 *     supabase start
 *     supabase functions serve practice-plan --env-file supabase/.env
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // ── CORS pre-flight ──
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { division, teamName, playerCount } = await req.json()

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in Supabase secrets. See function comments for setup instructions.' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const div   = division    || 'Unknown'
    const team  = teamName    || 'the team'
    const count = playerCount || 10

    const prompt = `You are an expert AYSO youth soccer coach educator. Create a structured 60-minute practice plan for a ${div} division team called "${team}" with approximately ${count} players.

Use EXACTLY these section headers (including the time in parentheses):

## Warm-Up (10 min)
## Skill Focus (20 min)
## Small-Sided Game (20 min)
## Cool-Down & Review (10 min)

For each section provide these fields on separate lines:
- **Activity:** [name of the activity]
- **Setup:** [equipment and space needed]
- **Instructions:** [step-by-step how to run it]
- **Coaching Cues:** [2–3 key points to emphasize]
- **${div} Tip:** [one age-appropriate modification or focus]

Keep language positive and age-appropriate for ${div} players. For younger divisions (8U, 10U) emphasize fun and fundamentals. For older divisions (14U+) emphasize tactical awareness.`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 2048,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text()
      throw new Error(`Anthropic API ${anthropicRes.status}: ${body}`)
    }

    const json = await anthropicRes.json()
    const plan: string = json?.content?.[0]?.text ?? ''

    return new Response(
      JSON.stringify({ plan }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
