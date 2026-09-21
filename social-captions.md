# Social captions — per clip, per platform

Caption copy for the clip bank in [vo-script-clips.md](vo-script-clips.md). One
clip, three uploads, three different captions — the platforms reward different
things and only one of them gives you a clickable link.

---

## Link rules (read once, applies to every clip)

| Placement | YouTube Shorts | Instagram Reels | TikTok |
|---|---|---|---|
| Caption / description | ✅ clickable | ❌ plain text | ❌ plain text |
| Pinned comment | ✅ clickable | ❌ plain text | ❌ plain text |
| Profile / bio | ✅ channel Links | ✅ up to 5 bio links | ✅ bio link — **Business account required** |
| Story link sticker | — | ✅ clickable | — |

Cards and end screens don't render on Shorts, so the description link is the
only organic click YouTube offers — use it.

**Instagram and TikTok get no URL in the caption.** A pasted link there is dead
text that costs you reach and buys nothing. The clip's job on those two is to
earn the profile tap; the bio link closes it. On Instagram, also share each Reel
to your Story on release day with a link sticker — that's where the clicks
actually come from.

**TikTok bio link** needs a Business account if you're under 1k followers.
Convert it before the first release. Platform thresholds move — check it in the
app rather than trusting this table.

### Short links

Defined in [site/_redirects](site/_redirects). **Live and verified Sep 21, 2026** —
all three return 302 with their tags intact.

| Link | Goes to | Use on |
|---|---|---|
| `squadiq.online/yt` | landing page, tagged `utm_source=youtube` | YouTube description + pinned comment |
| `squadiq.online/ig` | landing page, tagged `utm_source=instagram` | Instagram **bio** and Story sticker |
| `squadiq.online/tt` | landing page, tagged `utm_source=tiktok` | TikTok **bio** |

Short enough to say out loud, and they're what tells you which platform is
actually converting. Use them anywhere the link is **spoken or typed** — a bio
field, a voiceover, a business card.

#### Splitting by clip — do not append to the short link

`squadiq.online/yt?utm_content=clip1` **silently drops the tag.** Cloudflare Pages
does not merge an incoming query string into a destination that already has one,
so all three clips land on the identical tagged URL and per-clip attribution is
lost with no error anywhere. Verified Sep 21, 2026.

Where you need per-clip data — YouTube descriptions and pinned comments, which are
clicked and never typed — paste the full tagged URL instead:

```
https://squadiq.online/?utm_source=youtube&utm_medium=shorts&utm_campaign=clips&utm_content=clip1
```

Ugly, but nobody reads a description link — they click it. Increment `clip1` per
clip and keep the numbering matched to the release order in the table below.

The alternative, if you ever want short *and* per-clip, is one redirect per clip
(`/yt1`, `/yt2`) in `site/_redirects` — but that needs a site deploy per clip, and
squadiq.online does not deploy from git pushes.

#### Which `utm_content` belongs to which video

The tag follows **posting order**, not the clip numbers used as headings below —
those come from the original nine-clip bank and don't match what actually shipped.
When in doubt, this table wins.

| Tag | Video | YouTube ID | Posted | Length |
|---|---|---|---|---|
| `clip1` | Lineup in one tap (AI planner) | `p5iEvLZKmO8` | Sep 6, 2026 | 0:37 |
| `clip2` | AYSO ¾ rule checked before kickoff | `7S0zXA_bC1Q` | Sep 14, 2026 | 0:52 |
| `clip3` | Practice plan in 30 seconds — 71 drills | `RB1UAZRQEEQ` | Sep 21, 2026 | 1:01 |
| `clip4` | Build your whole roster in 5 minutes | `CRIW3NZGV7c` | Sep 21, 2026 | ~0:35 |
| `clip5` | Sketch board — draw plays with your lineup | `gAIxe8ilqYU` | Sep 21, 2026 | ~0:23 |
| `ad`    | The 30s ad, recut | `1NKO2ni3PtE` | Sep 21, 2026 | 0:29 |

`clip4` was re-uploaded the same day to strip a background voice from the audio;
its first upload (`kPqfayGgFbs`) is deleted. A re-upload always mints a new id,
and that id is embedded in `site/guide.html` — so the order is **upload the new
one, update the guide, redeploy, then delete the old**, or the live guide shows
"Video unavailable" until someone does a manual Cloudflare upload.

Channel is **@SquadIQ_coach** — `@squadiq` belongs to an unrelated account.

Tags were added retroactively on Sep 21, so clip1's first 864 views and clip2's
first 33 carry no attribution at all. Any per-clip comparison starts from Sep 21
and compares clips of very different ages — read it as directional, not decisive.

---

## Clip 1 · Lineup in one tap (AI planner) — HERO

Release: **Aug 10–16**. Script: [vo-script-lineup.md](vo-script-lineup.md).

### TikTok

> kickoff's in an hour and you still don't have a lineup ⚽
>
> one tap → four balanced quarters. equal playing time, keeper rotation, nobody sitting twice in a row.
>
> #youthsoccer #soccercoach #ayso #coachlife #soccerdrills

No link, no CTA, lowercase. The first line is the retention hook — it's doing
all the work. "SquadIQ" appears in the on-screen text and the outro, not here.

### Instagram Reels

> Kickoff's in an hour and you don't have a lineup. One tap.
>
> Mark who's out — all game, or just a quarter — and SquadIQ builds all four. Equal playing time enforced, keeper rotation handled, nobody sits two in a row. Don't agree? Drag anyone anywhere.
>
> Free to try — link in bio.
>
> #youthsoccer #soccercoach #ayso #aysosoccer #coachlife #youthsports #soccerparents #soccerlineup

Only ~125 characters show before "more", so the hook has to be the entire first
line. Hashtags at the end of the caption, not in a comment. Bio link →
`squadiq.online/ig`. Share to Story same morning with a link sticker.

### YouTube Shorts

**Title:** `Youth soccer lineup in one tap — AI lineup planner (SquadIQ)`

> Try it free: https://squadiq.online/yt
>
> It's Saturday morning, kickoff is in an hour, and you don't have a lineup.
>
> SquadIQ's AI Lineup Planner builds all four quarters from your roster: equal playing time enforced, goalkeeper rotation handled, and nobody sits two quarters in a row. Mark a player out for the whole game or just one quarter and it plans around them. Drag anyone anywhere if you disagree — the AI just does the math.
>
> Then share it to the team chat or print an AYSO-style roster sheet for the sideline.
>
> #youthsoccer #soccercoach #ayso #shorts

Link on line one, above the fold, **and** pinned as a comment — the pinned
comment out-taps the description on mobile. The description is indexed for
search, which is why it carries the full feature vocabulary ("lineup planner",
"equal playing time", "goalkeeper rotation", "AYSO") that the other two
deliberately leave out. Keep `#shorts`.

---

## ¾ rule clip — the trust clip

Recorded Sep 3 (session: lineup · ¾ rule · edit player). Release: **Sep 13**.

Second on purpose. On its own this is a compliance feature; straight after the
lineup clip it's the reason to trust the lineup clip. And it's the one thing in
the app that names the audience out loud — "¾ rule = 3+ quarters" is AYSO's
language, not soccer's, so a rec coach reads that legend and knows the app was
built inside their league. No paid targeting buys that.

**Aim the first line at the parent, not the coach.** Every parent on that
sideline is already counting their own kid's minutes. The promise is that now
the app counts too — and it catches it *before* kickoff, not in the car home.

### TikTok

> every parent on that sideline is counting their kid's quarters ⚽
>
> so now the app counts too. anyone under three lights up amber — before kickoff, not after the game.
>
> #youthsoccer #soccercoach #ayso #coachlife #soccerparents

No link, no CTA, lowercase. The amber row is the payoff — don't explain it in
the caption, the video does that in two seconds.

### Instagram Reels

> Every parent on that sideline is counting their kid's quarters. Now the app counts too.
>
> AYSO's ¾ rule means every player gets at least three of the four quarters. SquadIQ checks the whole roster while you're still building the lineup — anyone short shows up as an amber row, so you catch it before kickoff instead of hearing about it after the game. Drag them into a quarter and the rest rebalances around it.
>
> Free to try — link in bio.
>
> #youthsoccer #soccercoach #ayso #aysosoccer #coachlife #youthsports #soccerparents #playingtime

First line is 87 characters, so the whole hook survives above "more". Bio link →
`squadiq.online/ig`. Share to Story the same morning with a link sticker.

### YouTube Shorts

**Title:** `Youth soccer playing time — AYSO ¾ rule checked before kickoff (SquadIQ)`

> Try it free: https://squadiq.online/yt
>
> Every parent on that sideline is counting their kid's quarters. Now the app counts too.
>
> AYSO's ¾ rule means every player plays at least three of the four quarters. SquadIQ checks your whole roster against it while you're still building the lineup: anyone short of three quarters shows as an amber row, so you catch it before kickoff instead of hearing about it after the game. Drag a player into a quarter and the rest rebalances — equal playing time, goalkeeper rotation, and nobody sitting two quarters in a row.
>
> Works on iPhone, Android, or straight in a browser. Free 30-day trial, no card.
>
> #youthsoccer #soccercoach #ayso #shorts

Link on line one **and** pinned as a comment. The description carries the search
vocabulary the other two deliberately leave out — "playing time", "¾ rule",
"AYSO", "goalkeeper rotation".

### Pinned comment

Unchanged from the house version in `squadiq/SquadIQ-Posting-Pack.md` — post it
yourself, then pin it.

### Cover frame

Use the amber row, not the finished lineup. The whole promise of this clip is a
problem being caught, and a green all-clear board says nothing. Check the
"¾ rule = 3+ quarters" legend is legible at phone size on that frame — it is the
single highest-value text in the clip.

---

## Clips 2–9

Hooks are drafted in [vo-script-clips.md](vo-script-clips.md); full three-platform
captions not written yet. The link rules above apply unchanged to all of them.
