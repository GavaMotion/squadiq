import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isOffline } from '../lib/offline'

// Who else has this team's lineup open right now.
//
// Nobody is blocked and nothing is locked — saves stay last-write-wins. This
// exists so two coaches on the same sideline can see they're both in it and
// sort it out between themselves, instead of one of them watching a sub
// silently disappear.
export function useTeamPresence(teamId, { label, enabled = true } = {}) {
  const [others, setOthers] = useState([])

  useEffect(() => {
    if (!teamId || !enabled) { setOthers([]); return }
    // No point opening a socket with no signal; the offline banner already
    // tells the coach where they stand.
    if (isOffline()) { setOthers([]); return }

    let cancelled = false
    let channel = null

    async function join() {
      const { data } = await supabase.auth.getUser().catch(() => ({ data: null }))
      const me = data?.user
      if (!me || cancelled) return

      channel = supabase.channel(`team:${teamId}:lineup`, {
        config: { presence: { key: me.id } },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          if (cancelled) return
          const state = channel.presenceState()
          const seen = []
          for (const [key, metas] of Object.entries(state)) {
            if (key === me.id) continue
            const meta = metas?.[0] || {}
            seen.push({ id: key, name: meta.label || meta.email || 'Another coach' })
          }
          setOthers(seen)
        })
        .subscribe(async status => {
          if (status !== 'SUBSCRIBED' || cancelled) return
          await channel.track({
            label: label || me.email || 'Another coach',
            email: me.email,
            at: Date.now(),
          })
        })
    }

    join()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
      setOthers([])
    }
  }, [teamId, enabled, label])

  return others
}
