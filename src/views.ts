import type { LinkRow } from './index'

// All the HTML + CSS lives in this file (and stats.ts, which borrows layout()).
// No build step, no framework — the design is hand-written so it doesn't look
// like default Tailwind.

// ── shared document shell ───────────────────────────────────────────────
export function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>${body}<script>${js}</script></body>
</html>`
}

// ── login ────────────────────────────────────────────────────────────────
const LOGIN_ERRORS: Record<string, string> = {
  wrong: 'Wrong password.',
  unset: 'No password is configured on this deployment yet.',
}
export function loginPage(error?: string): string {
  return layout('Sign in', `
  <main class="login-wrap">
    <form class="login-card" method="post" action="/login">
      <div class="brand center"><span class="dot"></span><h1>Links</h1></div>
      <p class="sub center">Enter your password to continue.</p>
      ${error ? `<div class="banner">${LOGIN_ERRORS[error] ?? 'Could not sign in.'}</div>` : ''}
      <input class="url" name="password" type="password" placeholder="Password" autofocus required />
      <button type="submit">Sign in</button>
    </form>
  </main>`)
}

// ── dashboard ──────────────────────────────────────────────────────────────
const ERRORS: Record<string, string> = {
  badurl: 'That doesn’t look like a valid http(s) link.',
  badslug: 'A custom slug can only use letters, numbers, - and _.',
  taken: 'That slug is already in use. Try another.',
  reserved: 'That slug is reserved. Try another.',
}

export function dashboardPage(links: LinkRow[], origin: string, error?: string): string {
  const shortHost = origin.replace(/^https?:\/\//, '')
  const totalClicks = links.reduce((s, l) => s + l.clicks, 0)

  const body = `
  <main class="wrap">
    <header class="head">
      <div class="topbar">
        <div class="brand"><span class="dot"></span><h1>Links</h1></div>
        <form method="post" action="/logout"><button class="ghost">Log out</button></form>
      </div>
      <p class="sub">Short, sharp links on your own domain.</p>
    </header>

    ${error ? `<div class="banner">${ERRORS[error] ?? 'Something went wrong.'}</div>` : ''}

    <form class="create" method="post" action="/api/links">
      <input class="url" name="url" type="url" inputmode="url" required
             placeholder="Paste a long URL…" autocomplete="off" autofocus />
      <div class="slug-field">
        <span class="slug-host">${escapeHtml(shortHost)}/</span>
        <input name="slug" type="text" placeholder="custom (optional)"
               autocomplete="off" pattern="[a-zA-Z0-9_-]+" />
      </div>
      <button type="submit">Shorten</button>
      <details class="more">
        <summary>Social preview <span class="opt">optional</span></summary>
        <div class="more-body">
          <p class="hint">How this link looks when shared on Twitter, Slack, Discord, etc.</p>
          <input name="og_title" type="text" placeholder="Title" autocomplete="off" />
          <input name="og_description" type="text" placeholder="Description" autocomplete="off" />
          <input name="og_image" type="url" placeholder="Image URL (https://…)" autocomplete="off" />
        </div>
      </details>
    </form>

    ${links.length === 0 ? emptyState() : `
      <div class="count-strip">
        <span><b>${links.length}</b> ${links.length === 1 ? 'link' : 'links'}</span>
        <span class="sep">·</span>
        <span><b>${totalClicks.toLocaleString('en-US')}</b> total clicks</span>
      </div>
      ${linkList(links, origin)}`}
  </main>`
  return layout('Links', body)
}

function emptyState(): string {
  return `<div class="empty">
    <div class="empty-mark"></div>
    <p>No links yet.</p>
    <span>Paste a URL above and you’ll get a short one instantly.</span>
  </div>`
}

function linkList(links: LinkRow[], origin: string): string {
  const rows = links.map((l) => {
    const shortUrl = `${origin}/${l.slug}`
    const host = hostOf(l.url)
    return `<li class="row">
      <img class="fav" src="https://icons.duckduckgo.com/ip3/${escapeAttr(host)}.ico"
           onerror="this.style.visibility='hidden'" alt="" width="18" height="18" loading="lazy" />
      <div class="row-main">
        <a class="slug-link" href="/${escapeAttr(l.slug)}/stats"><span class="slug">/${escapeHtml(l.slug)}</span></a>
        <a class="dest" href="${escapeAttr(l.url)}" target="_blank" rel="noopener">${escapeHtml(prettyUrl(l.url))}</a>
      </div>
      <div class="row-meta">
        <button class="copy" data-copy="${escapeAttr(shortUrl)}" title="Copy short link">Copy</button>
        <a class="clicks" href="/${escapeAttr(l.slug)}/stats"><b>${l.clicks}</b> ${l.clicks === 1 ? 'click' : 'clicks'}</a>
      </div>
    </li>`
  }).join('')
  return `<ul class="list">${rows}</ul>`
}

// ── helpers (exported for stats.ts / og.ts) ────────────────────────────────
export function prettyUrl(u: string): string {
  try {
    const p = new URL(u)
    return (p.host + p.pathname + p.search).replace(/\/$/, '')
  } catch {
    return u
  }
}
export function hostOf(u: string): string {
  try {
    return new URL(u).host
  } catch {
    return ''
  }
}
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
}
export function escapeAttr(s: string): string {
  return escapeHtml(s)
}

// ─────────────────────────────────────────────────────────────────────────
// Styles — neutral, calm, one accent. Auto light/dark.
// ─────────────────────────────────────────────────────────────────────────
const css = `
:root {
  --bg: #fbfbfa; --panel: #ffffff; --ink: #1a1a19; --muted: #8a8a85;
  --line: #ececea; --accent: #3d5afe; --accent-soft: #eef1ff; --danger: #d1453b;
  --radius: 12px; --shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.04);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0e0e0f; --panel: #171718; --ink: #f2f2f0; --muted: #7c7c78;
    --line: #262627; --accent: #7c8bff; --accent-soft: #1b1e33; --danger: #f2665b;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.25);
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: var(--bg); color: var(--ink);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
.wrap { max-width: 680px; margin: 0 auto; padding: 64px 24px 120px; }
.head { margin-bottom: 28px; }
.topbar { display: flex; align-items: center; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand.center { justify-content: center; }
.dot { width: 12px; height: 12px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
h1 { font-size: 20px; font-weight: 640; letter-spacing: -.01em; margin: 0; }
.sub { color: var(--muted); margin: 8px 0 0; font-size: 14px; }
.sub.center, .center { text-align: center; }
.ghost {
  border: 1px solid var(--line); background: transparent; color: var(--muted);
  font-size: 13px; padding: 6px 12px; border-radius: 8px; cursor: pointer; transition: all .15s;
}
.ghost:hover { color: var(--ink); border-color: var(--muted); }

.banner {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 20px;
}

/* create form */
.create {
  display: grid; grid-template-columns: 1fr auto; gap: 10px;
  background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 14px; box-shadow: var(--shadow); margin-bottom: 26px;
}
.create .url { grid-column: 1 / -1; }
.create .url {
  width: 100%; border: 1px solid var(--line); background: transparent; color: var(--ink);
  border-radius: 9px; padding: 11px 13px; font-size: 14px; outline: none; transition: border-color .15s, box-shadow .15s;
}
.create .url:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
input::placeholder { color: var(--muted); }
.slug-field {
  display: flex; align-items: center; min-width: 0;
  border: 1px solid var(--line); border-radius: 9px; overflow: hidden; transition: border-color .15s, box-shadow .15s;
}
.slug-field:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.slug-host { flex-shrink: 0; padding: 11px 2px 11px 13px; color: var(--muted); font-size: 13px; font-family: ui-monospace, "SF Mono", Menlo, monospace; white-space: nowrap; }
.slug-field input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--ink); padding: 11px 13px 11px 2px; font-size: 14px; outline: none; }
.create button[type=submit], .login-card button {
  border: 0; background: var(--accent); color: #fff; font-weight: 560; font-size: 14px;
  padding: 0 20px; border-radius: 9px; cursor: pointer; transition: filter .15s, transform .05s;
}
.create button[type=submit] { padding: 11px 20px; }
.create button[type=submit]:hover, .login-card button:hover { filter: brightness(1.06); }
.create button[type=submit]:active { transform: translateY(1px); }

/* progressive disclosure: social preview */
.more { grid-column: 1 / -1; margin-top: 2px; }
.more > summary {
  list-style: none; cursor: pointer; color: var(--muted); font-size: 13px;
  display: inline-flex; align-items: center; gap: 6px; user-select: none;
}
.more > summary::-webkit-details-marker { display: none; }
.more > summary::before { content: "＋"; font-size: 13px; }
.more[open] > summary::before { content: "－"; }
.more > summary:hover { color: var(--ink); }
.opt { font-size: 11px; background: var(--line); color: var(--muted); padding: 1px 7px; border-radius: 20px; }
.more-body { display: grid; gap: 8px; margin-top: 12px; }
.more-body .hint { color: var(--muted); font-size: 12px; margin: 0 0 2px; }
.more-body input {
  width: 100%; border: 1px solid var(--line); background: transparent; color: var(--ink);
  border-radius: 9px; padding: 10px 13px; font-size: 14px; outline: none; transition: border-color .15s, box-shadow .15s;
}
.more-body input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

/* count strip (numbers-first) */
.count-strip { color: var(--muted); font-size: 13px; margin: 0 4px 12px; display: flex; gap: 10px; }
.count-strip b { color: var(--ink); font-weight: 600; }
.count-strip .sep { opacity: .5; }

/* list */
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.row {
  display: flex; align-items: center; gap: 14px;
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 13px 16px; transition: border-color .15s;
}
.row:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
.fav { flex-shrink: 0; border-radius: 5px; }
.row-main { min-width: 0; flex: 1; }
.slug-link { text-decoration: none; }
.slug { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 14px; font-weight: 560; }
.slug-link:hover .slug { color: var(--accent); }
.dest { display: block; color: var(--muted); font-size: 13px; text-decoration: none; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dest:hover { color: var(--accent); }
.row-meta { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.copy {
  border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer;
  font-size: 12px; padding: 5px 11px; border-radius: 7px; transition: all .15s;
}
.copy:hover { color: var(--ink); border-color: var(--muted); }
.copy.ok { color: var(--accent); border-color: var(--accent); }
.clicks { font-size: 13px; color: var(--muted); white-space: nowrap; text-decoration: none; }
.clicks b { color: var(--ink); font-weight: 600; }
.clicks:hover { color: var(--accent); }

/* empty state */
.empty { text-align: center; padding: 56px 20px; color: var(--muted); }
.empty-mark { width: 40px; height: 40px; margin: 0 auto 16px; border-radius: 12px; border: 2px dashed var(--line); position: relative; }
.empty-mark::after { content: ""; position: absolute; inset: 12px; border-radius: 4px; background: var(--line); }
.empty p { color: var(--ink); font-weight: 560; margin: 0 0 4px; }
.empty span { font-size: 13px; }

/* login */
.login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.login-card { width: 100%; max-width: 340px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 32px 28px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 14px; }
.login-card .sub { margin: -6px 0 6px; }
.login-card .url { width: 100%; border: 1px solid var(--line); background: transparent; color: var(--ink); border-radius: 9px; padding: 11px 13px; font-size: 14px; outline: none; }
.login-card .url:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.login-card button { padding: 11px 20px; }

/* ── per-link stats page ── */
.back { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); text-decoration: none; font-size: 13px; margin-bottom: 20px; }
.back:hover { color: var(--ink); }
.detail-head { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.detail-head .slug { font-size: 22px; }
.detail-sub { color: var(--muted); font-size: 13px; margin: 0 0 26px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.detail-sub a { color: var(--muted); text-decoration: none; border-bottom: 1px solid var(--line); }
.detail-sub a:hover { color: var(--accent); border-color: var(--accent); }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 22px; }
.stat-card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
.stat-card .n { font-size: 26px; font-weight: 680; letter-spacing: -.02em; }
.stat-card .l { color: var(--muted); font-size: 12px; margin-top: 2px; }
.chart-card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px 18px 12px; margin-bottom: 22px; }
.chart-title { font-size: 12px; color: var(--muted); margin: 0 0 14px; }
.chart { display: flex; align-items: flex-end; gap: 3px; height: 90px; }
.bar { flex: 1; background: color-mix(in srgb, var(--accent) 22%, transparent); border-radius: 3px 3px 0 0; min-height: 2px; position: relative; transition: background .15s; }
.bar:hover { background: var(--accent); }
.bar > span { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 5px; background: var(--ink); color: var(--bg); font-size: 11px; padding: 3px 7px; border-radius: 6px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .12s; }
.bar:hover > span { opacity: 1; }
.chart-axis { display: flex; justify-content: space-between; color: var(--muted); font-size: 11px; margin-top: 8px; }
.breakdowns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 22px; }
.bd { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
.bd h3 { font-size: 12px; color: var(--muted); font-weight: 560; margin: 0 0 12px; text-transform: uppercase; letter-spacing: .04em; }
.bd-row { position: relative; display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; font-size: 13px; border-radius: 7px; overflow: hidden; }
.bd-row .fill { position: absolute; inset: 0; background: var(--accent-soft); border-radius: 7px; z-index: 0; }
.bd-row .k, .bd-row .v { position: relative; z-index: 1; }
.bd-row .k { color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bd-row .v { color: var(--muted); font-variant-numeric: tabular-nums; padding-left: 10px; }
.bd-empty { color: var(--muted); font-size: 13px; padding: 6px 10px; }
.section-title { font-size: 12px; color: var(--muted); font-weight: 560; margin: 30px 0 12px; text-transform: uppercase; letter-spacing: .04em; }
.edit { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; display: grid; gap: 10px; }
.edit label { font-size: 12px; color: var(--muted); }
.edit input { width: 100%; border: 1px solid var(--line); background: transparent; color: var(--ink); border-radius: 9px; padding: 10px 13px; font-size: 14px; outline: none; transition: border-color .15s, box-shadow .15s; }
.edit input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.edit .row-2 { display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-top: 4px; }
.edit button.save { border: 0; background: var(--accent); color: #fff; font-weight: 560; font-size: 14px; padding: 10px 20px; border-radius: 9px; cursor: pointer; }
.edit button.save:hover { filter: brightness(1.06); }
.qr-card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; text-align: center; }
.qr-card img { width: 160px; height: 160px; border-radius: 8px; background: #fff; padding: 8px; }
.qr-card .dl { display: inline-block; margin-top: 10px; font-size: 13px; color: var(--muted); text-decoration: none; border-bottom: 1px solid var(--line); }
.qr-card .dl:hover { color: var(--accent); border-color: var(--accent); }
.danger { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }
.danger .del { border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--line)); background: transparent; color: var(--danger); font-size: 13px; padding: 8px 14px; border-radius: 8px; cursor: pointer; }
.danger .del:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); }
.two-col { display: grid; grid-template-columns: 1fr 220px; gap: 12px; align-items: start; }
@media (max-width: 560px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .breakdowns, .two-col { grid-template-columns: 1fr; }
}
`

// A whisper of JS: copy-to-clipboard, and press "c" to jump to the URL field.
const js = `
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy'); if (!btn) return;
  e.preventDefault();
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    const t = btn.textContent; btn.textContent = 'Copied'; btn.classList.add('ok');
    setTimeout(() => { btn.textContent = t; btn.classList.remove('ok'); }, 1200);
  } catch (_) {}
});
document.addEventListener('keydown', (e) => {
  const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
  if (e.key === 'c' && tag !== 'input' && tag !== 'textarea' && !e.metaKey && !e.ctrlKey) {
    const el = document.querySelector('.create .url'); if (el) { e.preventDefault(); el.focus(); }
  }
});
`
