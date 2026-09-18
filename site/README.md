# SquadIQ marketing site — squadiq.online

Static marketing site for SquadIQ. Plain HTML/CSS, no build step. Presents the app
and its features, links to the stores + web app, and hosts the support / privacy /
terms pages.

| File | Purpose |
|------|---------|
| `index.html` | Landing page (hero, features, pricing, download buttons) |
| `features.html` | Full feature breakdown |
| `support.html` | Help / FAQ |
| `privacy.html` | Privacy Policy |
| `terms.html` | Terms of Use (EULA) |
| `404.html` | Not-found page |
| `assets/`, `features/` | Optimized images (regenerate with `node scripts/optimize-site-images.mjs`) |
| `_headers` | Cloudflare Pages security + cache headers |
| `_redirects` | Campaign short links `/yt` `/ig` `/tt` (UTM-tagged, see `../social-captions.md`) |
| `robots.txt`, `sitemap.xml` | SEO |

The app itself lives separately at **https://squadiq-coach.vercel.app** (Vercel).
The "Web App" / "Install on Windows/Mac" buttons point there.

---

## Deploy to Cloudflare Pages (free forever)

### 1. Push this folder to a Git repo (recommended) — or use Direct Upload
Cloudflare Pages can deploy straight from GitHub, or you can drag-and-drop the `site/`
folder. Git is best so future edits auto-deploy.

### 2. Create the Pages project
1. Go to **dash.cloudflare.com → Workers & Pages → Create → Pages**.
2. **Connect to Git** and pick this repo. (Or **Upload assets** and drop the `site/` folder.)
3. Build settings:
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `site`  *(if the repo root is this project; if you push only the `site/` folder, leave it blank/`/`)*
4. **Save and Deploy.** You'll get a `*.pages.dev` URL within ~1 minute. Verify it works.

### 3. Connect the domain squadiq.online
**Easiest path — move DNS to Cloudflare (also free):**
1. In Cloudflare dashboard → **Add a site** → enter `squadiq.online` → Free plan.
2. Cloudflare gives you **two nameservers**. Log in to your domain registrar and
   replace the existing nameservers with those two. (Propagation: minutes to a few hours.)
3. Back in your Pages project → **Custom domains → Set up a custom domain** →
   add `squadiq.online` **and** `www.squadiq.online`. Cloudflare creates the DNS
   records and SSL certificate automatically.

**Alternative — keep DNS at your current registrar:**
- Add a `CNAME` record: `squadiq.online` → `<your-project>.pages.dev`
  (and `www` → `<your-project>.pages.dev`). Some registrars need "CNAME flattening"
  for the root domain; if yours can't CNAME the root, use the move-to-Cloudflare path above.

### 4. Done
HTTPS is automatic and free. Pushing to the repo (or re-uploading) redeploys.

---

## Before you go live — swap the remaining store link

In `index.html`, the **Google Play** button is still a placeholder
(marked `class="badge-btn soon"`, `href="#"`). When the listing is live:

1. Replace `href="#"` with the real Play Store URL.
2. Remove `soon` from the class (so it loses the "Soon" tag and dimming).

There are two copies of the button block — in the hero (`id="get"`) and in the
download section (`id="download"`). Update both.

Live already: **App Store** (`https://apps.apple.com/app/id6766638428`),
**Web App**, and **Windows / Mac** (the last two open the PWA at
`squadiq-coach.vercel.app`, which installs to the home screen / desktop).

## A note on paths
All asset/link paths are **relative** (`assets/bg.webp`, not `/assets/bg.webp`),
so the site works when opened directly, served from any folder, or deployed to
Cloudflare Pages. Keep new links relative too.

## Preview locally
```
npx serve site      # or: python -m http.server 8000 --directory site
```
