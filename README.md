# Source Inspector

A terminal-styled workspace with two tools:

- **Inspect** — paste a URL, fetch its HTML through a public CORS relay, and see its
  structure (headings, images, links), an SEO readout, and the HTML/CSS/JS split into
  separate views. If a site blocks the relay, use "manual paste" with copied page source instead.
- **Editor** — a three-pane HTML/CSS/JS editor with a live preview and starter templates.
  Download your work as a single `page.html`.

Static site, no build step, no server, no dependencies.

## Deploy to Vercel

**Option A — CLI**
```bash
npm i -g vercel
cd source-inspector
vercel
```
Follow the prompts (link or create a project); Vercel will detect it as a static site.

**Option B — Dashboard**
1. Push this folder to a GitHub repo.
2. Go to vercel.com → **Add New Project** → import the repo.
3. Framework preset: **Other** (or leave auto-detected — no build command needed).
4. Deploy.

**Option C — Drag and drop**
Go to vercel.com/new, and drag this folder onto the upload area.

## Notes on the CORS relays

The Inspect tab uses `api.allorigin.win` or `corsproxy.io` to fetch pages client-side,
since browsers block cross-origin reads by default. These are free public services —
they can rate-limit or go down, and some sites (behind Cloudflare, requiring auth, etc.)
will refuse to be proxied at all regardless. There's no way around that from a pure
client-side app; a production version would need its own backend fetch endpoint.
