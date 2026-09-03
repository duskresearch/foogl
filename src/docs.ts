// One markdown source, two outputs: the rendered /docs page for humans and the
// raw text inside /llms-full.txt for machines. Edit DOCS_MD; both follow.

export const DOCS_MD = "# Foogl Documentation\n\nA tiny, self-hosted link shortener you run on your own Cloudflare account. Short\nlinks on your own domain, a clean dashboard, and simple analytics, on Cloudflare's\nfree tier. One Worker, one D1 database, no build step.\n\n## Set it up\n\nThe fastest path is your coding agent. Tell Claude Code, Cursor, or any agent:\n\n> Read https://foo.gl/agent.md and set up foogl on my own Cloudflare account. It has every step and check; ask me only for what it says to ask.\n\nIt hands you a one-time link at the end; you choose your password in your own browser. Or deploy it yourself:\n\n### One-click deploy\n\n1. Click Deploy to Cloudflare on the [landing page](https://foo.gl) or the [repo](https://github.com/duskresearch/foogl). A free Cloudflare account is all you need.\n2. Cloudflare copies Foogl into a new repository on your own GitHub and keeps it in sync.\n3. Cloudflare creates your database, runs the migrations, and publishes the Worker. You never touch a command line.\n4. Open the Worker's `*.workers.dev` URL and choose your dashboard password on the setup screen.\n5. Sign in, paste a long URL, and hit Shorten. It is live instantly.\n\n### From the command line\n\n```\ngit clone https://github.com/duskresearch/foogl.git\ncd foogl && npm install\nnpx wrangler login\nnpm run db:create\nnpm run db:migrate:remote\nnpm run deploy\n```\n\nPaste the printed database_id into wrangler.jsonc under d1_databases before migrating. Then open the Worker URL and set your password on the setup screen.\n\n## Your own domain\n\nLinks work on the `workers.dev` address right away. To put them on your own short domain, Foogl routes by hostname:\n\n| Address | What it serves |\n| --- | --- |\n| `go.yourbrand.com` | Links only. `\u2026/slug` redirects; the bare domain sends people to your main site. The dashboard is never exposed here. |\n| `app.go.yourbrand.com` | Your dashboard (sign in, manage links). |\n| `your-worker.workers.dev` | Also the dashboard, always a way in before custom domains exist. |\n\nOpen your Worker, go to Settings, Domains and Routes, and add two custom domains: your short domain and `app.` plus that domain. Cloudflare provisions DNS and SSL. The dashboard on the `app.` host shows and copies your links on the short domain, so there is nothing else to wire up.\n\nIf your short domain itself starts with `app.`, set a `LINK_HOST` variable to that domain so the dashboard shows the right short URLs.\n\n## Features\n\n- Create short links, auto-generated or a custom slug.\n- Fast redirects at Cloudflare's edge, counted without slowing anyone down.\n- Simple analytics per link: clicks over time, top countries, referrers, devices and browsers. Geolocation is free from the edge, no MaxMind, no token.\n- Link expiry: set a date and the link stops working after it, falling back to your main site or a 404.\n- Targeting: send different visitors to different URLs by platform (iOS to the App Store, Android to Play) or by country. First match wins.\n- Query passthrough: forward `?utm_source=\u2026` and friends straight onto the destination.\n- UTM builder with a live preview.\n- 301 or 302 per link, your call.\n- Referrer hiding through a `no-referrer` hop.\n- A downloadable QR code for every link.\n- Social previews: set a title, description and image so shared links render right.\n- CSV export of all links, or one link's full clickstream.\n- An opt-in HTTP API.\n- Installable as a PWA.\n- One password guards the dashboard. No accounts, no user table.\n\nIt deliberately does less than the big shorteners: no teams, no affiliate programs, no A/B tests. Just the short-link loop, done well.\n\n## Settings\n\nSigned in, the Settings link runs everything without a Cloudflare trip:\n\n- Main site: the bare domain and any mistyped link redirect here.\n- Default 301 or 302 for new links.\n- HTTP API: on or off, with a token you generate.\n- Password: change it whenever.\n\nA value saved in the dashboard wins over the matching environment variable (`ROOT_URL`, `API_TOKEN`, `LINK_HOST`).\n\n## HTTP API\n\nOff by default. Turn it on in Settings, or set an `API_TOKEN` variable (`npx wrangler secret put API_TOKEN`, value `openssl rand -hex 24`). Every request sends it as a bearer token. Base path `/api/v1`, all responses JSON.\n\n| Method | Path | Does |\n| --- | --- | --- |\n| `POST` | `/api/v1/links` | Create a link |\n| `GET` | `/api/v1/links` | List every link |\n| `GET` | `/api/v1/links/:slug` | Fetch one link with its click count |\n| `DELETE` | `/api/v1/links/:slug` | Delete a link |\n\n```\ncurl -X POST https://your-worker.workers.dev/api/v1/links \\\n  -H \"Authorization: Bearer $API_TOKEN\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{ \"url\": \"https://example.com/a-very-long-link\", \"slug\": \"launch\" }'\n```\n\nOptional fields: `expires_at` (YYYY-MM-DD), `passthrough`, `permanent` (true = 301), `hide_referrer`, and `rules` (targeting; `type` is `platform` or `country`, first match wins). Errors return `{ \"error\": \"...\" }` with a matching status: 401 (bad token), 503 (API off), 400 (bad input), 404 (unknown slug).\n\n## Run it locally\n\n```\ngit clone https://github.com/duskresearch/foogl.git\ncd foogl && npm install\nnpm run db:migrate:local\ncp .dev.vars.example .dev.vars\nnpm run dev\n```\n\nEdit SITE_PASSWORD in .dev.vars, then open http://localhost:8787.\n\n## Troubleshooting\n\n- A \"choose a password\" screen keeps appearing: nobody has set the password yet. Set it there, or add a `SITE_PASSWORD` secret under the Worker's Settings.\n- Every page returns 500: usually a wrong `database_id` in wrangler.jsonc, or the migrations never ran. Run `npx wrangler tail` to see the error.\n- \"Database not initialised\": run `npx wrangler d1 migrations apply foogl-db --remote`.\n- \"Exceeded D1's free tier daily limit\": another D1 database on the same account spent the shared daily allowance. It resets at midnight UTC.\n\n## How it is built\n\nCloudflare Workers for the runtime, [Hono](https://hono.dev) for routing, and [D1](https://developers.cloudflare.com/d1/) (SQLite) for storage. No build step: the dashboard is server-rendered HTML with hand-written CSS.\n\n## More\n\n- The agent runbook: [foo.gl/agent.md](https://foo.gl/agent.md)\n- Source (MIT): [github.com/duskresearch/foogl](https://github.com/duskresearch/foogl)\n- The lab: [Dusk Research](https://duskresearch.com)\n"

const DOCS_CSS = ":root{--bg:#0E0E10;--surface:#17171a;--ink:#F4EEDF;--sec:#b7b1a3;--muted:#6f6a5e;--accent:#3FCF5E;--border:#26262b;--mono:'Departure Mono',ui-monospace,SFMono-Regular,Menlo,monospace}\n*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}\n@font-face{font-family:'Departure Mono';src:url('/_f/dm.woff2') format('woff2');font-weight:400;font-display:swap}\na{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}\n.top{border-bottom:1px solid var(--border);padding:18px 24px;display:flex;align-items:center;gap:14px;position:sticky;top:0;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);z-index:5}\n.top .wm{font-family:var(--mono);font-size:15px;color:var(--ink)}.top .bc{color:var(--muted);font-size:14px}\n.wrap{max-width:1080px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:220px minmax(0,1fr);gap:48px}\nnav.toc{position:sticky;top:80px;align-self:start;padding-top:40px;display:flex;flex-direction:column;gap:9px;font-family:var(--mono);font-size:12px;letter-spacing:.02em}\nnav.toc a{color:var(--sec)}nav.toc a:hover{color:var(--ink);text-decoration:none}\nmain{padding:40px 0 120px;min-width:0}\nh1{font-size:30px;line-height:1.15;letter-spacing:-.02em;margin:0 0 8px}\nh2{font-size:21px;letter-spacing:-.01em;margin:44px 0 12px;padding-top:8px}\nh3{font-size:16px;margin:26px 0 8px;color:var(--ink)}\np{margin:12px 0;color:var(--sec)}li{margin:5px 0;color:var(--sec)}ul,ol{padding-left:22px}ol li{margin:6px 0}\nstrong{color:var(--ink);font-weight:640}\ncode{font-family:var(--mono);font-size:13px;background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:1px 5px;color:var(--ink)}\npre{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;overflow-x:auto;margin:16px 0}\npre code{background:none;border:0;padding:0;font-size:13px;line-height:1.6;color:var(--ink)}\nblockquote{border-left:2px solid var(--accent);margin:16px 0;padding:4px 0 4px 16px;color:var(--ink)}\n.tw{overflow-x:auto;margin:16px 0}table{border-collapse:collapse;width:100%;font-size:14px}\nth,td{text-align:left;padding:9px 14px;border-bottom:1px solid var(--border);vertical-align:top}th{color:var(--muted);font-family:var(--mono);font-size:12px;font-weight:400;text-transform:uppercase;letter-spacing:.05em}\ntd{color:var(--sec)}\n.foot{border-top:1px solid var(--border);margin-top:60px;padding-top:20px;font-family:var(--mono);font-size:12px;color:var(--muted)}\n@media(max-width:760px){.wrap{grid-template-columns:1fr;gap:0}nav.toc{display:none}}"

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function inlineMd(s) {
  s = esc(s)
  s = s.replace(/`([^`]+)`/g, (_m, c) => '<code>' + c + '</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, c) => '<strong>' + c + '</strong>')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => '<a href="' + u + '">' + t + '</a>')
  return s
}
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
export function renderDocs(md) {
  const lines = md.split('\n')
  const out = []
  const toc = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(esc(lines[i])); i++ }
      i++
      out.push('<pre><code>' + code.join('\n') + '</code></pre>')
      continue
    }
    if (line.startsWith('### ')) { const t = line.slice(4); out.push('<h3 id="' + slugify(t) + '">' + inlineMd(t) + '</h3>'); i++; continue }
    if (line.startsWith('## ')) { const t = line.slice(3); toc.push({ id: slugify(t), title: t }); out.push('<h2 id="' + slugify(t) + '">' + inlineMd(t) + '</h2>'); i++; continue }
    if (line.startsWith('# ')) { const t = line.slice(2); out.push('<h1>' + inlineMd(t) + '</h1>'); i++; continue }
    if (line.startsWith('> ')) { out.push('<blockquote>' + inlineMd(line.slice(2)) + '</blockquote>'); i++; continue }
    if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++ }
      const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim())
      const header = cells(rows[0])
      const body = rows.slice(2).map(cells)
      out.push('<div class="tw"><table><thead><tr>' + header.map((h) => '<th>' + inlineMd(h) + '</th>').join('') + '</tr></thead><tbody>' +
        body.map((r) => '<tr>' + r.map((c) => '<td>' + inlineMd(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>')
      continue
    }
    if (/^\d+\.\s/.test(line)) {
      const buf = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { buf.push('<li>' + inlineMd(lines[i].replace(/^\d+\.\s/, '')) + '</li>'); i++ }
      out.push('<ol>' + buf.join('') + '</ol>')
      continue
    }
    if (line.startsWith('- ')) {
      const buf = []
      while (i < lines.length && lines[i].startsWith('- ')) { buf.push('<li>' + inlineMd(lines[i].slice(2)) + '</li>'); i++ }
      out.push('<ul>' + buf.join('') + '</ul>')
      continue
    }
    if (line.trim() === '') { i++; continue }
    const para = []
    while (i < lines.length && lines[i].trim() !== '' &&
           !/^([#>|]|- |\`\`\`)/.test(lines[i])) { para.push(lines[i]); i++ }
    out.push('<p>' + inlineMd(para.join(' ')) + '</p>')
  }
  return { html: out.join('\n'), toc }
}


export function docsPage() {
  const { html, toc } = renderDocs(DOCS_MD)
  const nav = toc.map((s) => '<a href="#' + s.id + '">' + esc(s.title) + '</a>').join('')
  return '<!doctype html><html lang="en" data-theme="dark"><head>' +
    '<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>' +
    '<title>Documentation \u00b7 Foogl</title>' +
    '<meta name="description" content="How to deploy, configure, and use Foogl, the self-hosted link shortener."/>' +
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>' +
    '<style>' + DOCS_CSS + '</style></head><body>' +
    '<header class="top"><a class="wm" href="/">foogl</a><span class="bc">/ docs</span></header>' +
    '<div class="wrap"><nav class="toc">' + nav + '</nav><main>' + html +
    '<div class="foot">\u00a9 2026 <a href="https://duskresearch.com">Dusk Research</a> \u00b7 <a href="/agent.md">agent.md</a> \u00b7 <a href="/llms.txt">llms.txt</a></div>' +
    '</main></div></body></html>'
}
