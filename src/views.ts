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
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)}</title>
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icon-180.png" />
<meta name="theme-color" content="#ECEBE7" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#070809" media="(prefers-color-scheme: dark)" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="foogl" />
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
      <div class="brand center"><span class="dot"></span><h1 class="wm">foogl</h1></div>
      <p class="sub center">Enter your password to continue.</p>
      ${error ? `<div class="banner">${LOGIN_ERRORS[error] ?? 'Could not sign in.'}</div>` : ''}
      <input class="url" name="password" type="password" placeholder="Password" autofocus required />
      <button type="submit">Sign in</button>
    </form>
  </main>`)
}

// ── first-run setup (shown when SITE_PASSWORD is not set yet) ───────────────
export function setupPage(setupKey = '', error = ''): string {
  const ERR: Record<string, string> = {
    short: 'Use at least 8 characters.',
    mismatch: 'The two passwords don’t match.',
    badkey: 'That setup link isn’t valid. Use the exact link your installer gave you.',
    unmigrated: 'The database isn’t initialised yet. Run the migrations, then reload.',
  }
  return layout('Choose a password · foogl', `
  <main class="login-wrap">
    <div class="login-card setup">
      <div class="brand center"><span class="dot"></span><h1>Choose a password</h1></div>
      <p class="sub center">foogl is deployed. Set the one password that guards this dashboard.</p>
      ${error ? `<p class="sub center" role="alert">${ERR[error] ?? 'Could not finish setup.'}</p>` : ''}
      <form method="POST" action="/setup">
        ${setupKey ? `<input type="hidden" name="key" value="${escapeAttr(setupKey)}"/>` : ''}
        <label for="pw">Password</label>
        <input id="pw" type="password" name="password" minlength="8" required autofocus placeholder="At least 8 characters"/>
        <label for="pw2">Same again</label>
        <input id="pw2" type="password" name="confirm" minlength="8" required/>
        <button type="submit">Set password and sign in</button>
      </form>
      <p class="sub center" style="margin-top:14px">Prefer a secret instead? Add <code>SITE_PASSWORD</code> under the Worker’s Settings → Variables and Secrets, and reload.</p>
    </div>
  </main>`)
}

// ── dashboard ──────────────────────────────────────────────────────────────
const ERRORS: Record<string, string> = {
  badurl: 'That doesn’t look like a valid http(s) link.',
  badslug: 'A custom slug can only use letters, numbers, - and _.',
  db: 'The database had a problem saving that. Try again in a moment.',
  taken: 'That slug is already in use. Try another.',
  reserved: 'That slug is reserved. Try another.',
  badexp: 'The expiry date isn’t valid.',
}

export function dashboardPage(links: LinkRow[], origin: string, error?: string, defaultPermanent = false): string {
  const shortHost = origin.replace(/^https?:\/\//, '')
  const totalClicks = links.reduce((s, l) => s + l.clicks, 0)

  const body = `
  <main class="wrap">
    <header class="head">
      <div class="topbar">
        <div class="brand"><span class="dot"></span><h1 class="wm">foogl</h1></div>
        <div class="actions">
          <a class="ghost" href="/settings">Settings</a>
          <form method="post" action="/logout"><button class="ghost">Log out</button></form>
        </div>
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
      <details class="more">
        <summary>Link options <span class="opt">optional</span></summary>
        <div class="more-body">
          <label class="field">
            <span class="flabel">Expires on <span class="opt-inline">(stops working after this day)</span></span>
            <input name="expires_at" type="date" autocomplete="off" />
          </label>
          <label class="check">
            <input type="checkbox" name="passthrough" value="1" />
            <span><b>Forward query parameters.</b> Anything after <code>?</code> on the short link is added to the destination. Handy for <code>utm_*</code> tags.</span>
          </label>
          <label class="check">
            <input type="checkbox" name="permanent" value="1" ${defaultPermanent ? 'checked' : ''} />
            <span><b>Permanent redirect (301).</b> Faster, but browsers cache it hard. Use only when the destination will never change.</span>
          </label>
          <label class="check">
            <input type="checkbox" name="hide_referrer" value="1" />
            <span><b>Hide referrer.</b> The destination won't see that the visitor came from your link.</span>
          </label>
        </div>
      </details>
      <details class="more utm">
        <summary>UTM tags <span class="opt">optional</span></summary>
        <div class="more-body">
          <p class="hint">Bake campaign tags onto the destination. They're added when you shorten.</p>
          <div class="utm-grid">
            <input class="utm-f" data-utm="utm_source" type="text" placeholder="Source (e.g. twitter)" autocomplete="off" />
            <input class="utm-f" data-utm="utm_medium" type="text" placeholder="Medium (e.g. social)" autocomplete="off" />
            <input class="utm-f" data-utm="utm_campaign" type="text" placeholder="Campaign (e.g. launch)" autocomplete="off" />
            <input class="utm-f" data-utm="utm_term" type="text" placeholder="Term (optional)" autocomplete="off" />
            <input class="utm-f" data-utm="utm_content" type="text" placeholder="Content (optional)" autocomplete="off" />
          </div>
          <p class="utm-preview" hidden></p>
        </div>
      </details>
    </form>

    ${links.length === 0 ? emptyState(origin) : `
      <div class="count-strip">
        <span><b>${links.length}</b> ${links.length === 1 ? 'link' : 'links'}</span>
        <span class="sep">·</span>
        <span><b>${totalClicks.toLocaleString('en-US')}</b> total clicks</span>
        <a class="export" href="/links.csv">Export CSV ↓</a>
      </div>
      ${linkList(links, origin)}`}
  </main>`
  return layout('foogl', body)
}

function emptyState(origin: string): string {
  const host = origin.replace(/^https?:\/\//, '')
  const onWorkersDev = /\.workers\.dev$/i.test(host)
  return `<div class="empty">
    <div class="empty-mark"></div>
    <p>You're live.</p>
    <span>Your short links will look like <code>${escapeHtml(host)}/your-slug</code>. Paste a URL above to make your first one.</span>
    ${onWorkersDev ? `<div class="tip"><b>Want branded links</b> like <code>go.yourbrand.com/launch</code>? Add your own domain in <b>Cloudflare → this Worker → Settings → Domains &amp; Routes</b>, then it becomes your short-link home.</div>` : ''}
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
@font-face{font-family:"Departure Mono";src:url("/_f/dm.woff2") format("woff2");font-weight:400;font-display:swap}
:root {
  --bg:#ECEBE7; --panel:#FFFFFF; --sunken:#F1F0ED; --ink:#16181B; --secondary:#5B636E; --muted:#8A929C;
  --line:#E6E7E9; --line-strong:#D5D7DA; --accent:#1A7F37; --accent-fg:#FFFFFF;
  --accent-soft:rgba(26,127,55,.10); --danger:#C0362C;
  --radius:12px; --shadow:0 1px 2px rgba(16,18,21,.06), 0 4px 12px rgba(16,18,21,.07);
  --mono:"Departure Mono", ui-monospace, "SF Mono", Menlo, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:#070809; --panel:#0C0E11; --sunken:#050607; --ink:#ECEEF0; --secondary:#9AA0A6; --muted:#5C636B;
    --line:#1E2329; --line-strong:#2A3036; --accent:#3FCF5E; --accent-fg:#07140B;
    --accent-soft:rgba(63,207,94,.13); --danger:#F0726A;
    --shadow:0 1px 2px rgba(0,0,0,.5), 0 8px 28px rgba(0,0,0,.5);
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: var(--bg); color: var(--ink);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased; letter-spacing: -.01em;
}
a { color: inherit; }
.wrap { max-width: 680px; margin: 0 auto; padding: 64px 24px 120px; }
.head { margin-bottom: 28px; }
.topbar { display: flex; align-items: center; justify-content: space-between; }
.actions { display: flex; align-items: center; gap: 8px; }
.actions .ghost { text-decoration: none; display: inline-flex; align-items: center; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand.center { justify-content: center; }
.dot { width: 12px; height: 12px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
h1 { font-size: 20px; font-weight: 640; letter-spacing: -.01em; margin: 0; }
/* brand wordmark — lowercase, Departure Mono, matching the foo.gl landing */
h1.wm { font-family: var(--mono); font-weight: 400; font-size: 18px; letter-spacing: .02em; }
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
.banner.ok { background: var(--accent-soft); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 30%, transparent); }

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
.slug-host { flex-shrink: 0; padding: 11px 2px 11px 13px; color: var(--muted); font-size: 13px; font-family: var(--mono); white-space: nowrap; }
.slug-field input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--ink); padding: 11px 13px 11px 2px; font-size: 14px; outline: none; }
.create button[type=submit], .login-card button {
  border: 0; background: var(--accent); color: var(--accent-fg); font-weight: 560; font-size: 14px;
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
.field { display: grid; gap: 6px; }
.flabel { font-size: 12px; color: var(--muted); }
.opt-inline { opacity: .8; }
.more-body input[type=date] { color-scheme: light dark; max-width: 220px; }
.check { display: flex; gap: 9px; align-items: flex-start; font-size: 12.5px; color: var(--muted); line-height: 1.5; cursor: pointer; }
.check input[type=checkbox] { margin: 2px 0 0; accent-color: var(--accent); width: 15px; height: 15px; flex-shrink: 0; }
.check b { color: var(--ink); font-weight: 600; }
.check code { font-family: var(--mono); font-size: .92em; background: var(--sunken); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; }
.radio { display: flex; gap: 9px; align-items: flex-start; font-size: 13px; color: var(--secondary); line-height: 1.5; cursor: pointer; }
.radio input[type=radio] { margin: 2px 0 0; accent-color: var(--accent); width: 15px; height: 15px; flex-shrink: 0; }
.radio b { color: var(--ink); font-weight: 600; }
.token-row { display: flex; gap: 8px; align-items: center; }
.token-field { flex: 1; min-width: 0; font-family: var(--mono); font-size: 12px; letter-spacing: .01em; }
.edit .hint code, .hint code { font-family: var(--mono); font-size: .9em; background: var(--sunken); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; color: var(--ink); }
.utm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.utm-grid .utm-f:nth-child(3) { grid-column: 1 / -1; }
.utm-preview { margin: 10px 0 0; font-family: var(--mono); font-size: 11.5px; line-height: 1.5; color: var(--secondary); word-break: break-all; background: var(--sunken); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }

/* export link in the count strip */
.export { margin-left: auto; color: var(--muted); text-decoration: none; font-size: 12.5px; border-bottom: 1px solid var(--line); }
.export:hover { color: var(--accent); border-color: var(--accent); }

/* targeting rules editor (on the manage page) */
.rules-json { width: 100%; min-height: 84px; border: 1px solid var(--line); background: var(--sunken); color: var(--ink); border-radius: 9px; padding: 10px 13px; font: 12px/1.5 var(--mono); outline: none; resize: vertical; }
.rules-json:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.js-on .rules-json { display: none; }
.rules { display: grid; gap: 8px; }
.rule-row { display: grid; grid-template-columns: 116px 96px 1fr 30px; gap: 7px; align-items: center; }
.rule-row select, .rule-row input { border: 1px solid var(--line); background: transparent; color: var(--ink); border-radius: 8px; padding: 9px 10px; font-size: 13px; outline: none; min-width: 0; }
.rule-row select:focus, .rule-row input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.rule-row .rm { border: 1px solid var(--line); background: transparent; color: var(--muted); border-radius: 8px; padding: 8px 0; cursor: pointer; font-size: 14px; line-height: 1; }
.rule-row .rm:hover { color: var(--danger); border-color: var(--danger); }
.rule-add { align-self: start; border: 1px dashed var(--line); background: transparent; color: var(--muted); font-size: 12.5px; padding: 8px 12px; border-radius: 8px; cursor: pointer; }
.rule-add:hover { color: var(--ink); border-color: var(--muted); }
.rules-hint { color: var(--muted); font-size: 12px; margin: 0 0 2px; line-height: 1.5; }

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
.slug { font-family: var(--mono); font-size: 14px; font-weight: 500; letter-spacing: .01em; }
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
.empty code, .setup code, .steps code, .rules-hint code { font-family: var(--mono); font-size: .9em; background: var(--sunken); border: 1px solid var(--line); border-radius: 5px; padding: 1px 6px; color: var(--ink); }
.empty .tip { max-width: 430px; margin: 20px auto 0; padding: 14px 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; font-size: 13px; line-height: 1.55; color: var(--muted); text-align: left; }
.empty .tip b { color: var(--ink); font-weight: 600; }
/* first-run setup */
.login-card.setup { max-width: 430px; text-align: left; }
.login-card.setup .brand.center, .login-card.setup .sub.center { text-align: center; }
.login-card.setup .steps { margin: 2px 0 8px; padding-left: 20px; display: grid; gap: 9px; font-size: 13.5px; color: var(--muted); line-height: 1.5; }
.login-card.setup .steps b { color: var(--ink); font-weight: 600; }
.login-card.setup .steps li::marker { color: var(--accent); }
.setup-reload { text-align: center; }

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
.edit button.save { border: 0; background: var(--accent); color: var(--accent-fg); font-weight: 560; font-size: 14px; padding: 10px 20px; border-radius: 9px; cursor: pointer; }
.edit button.save:hover { filter: brightness(1.06); }
.qr-card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; text-align: center; }
.qr-card img { width: 160px; height: 160px; border-radius: 8px; background: #fff; padding: 8px; }
.qr-card .dl { display: inline-block; margin-top: 10px; font-size: 13px; color: var(--muted); text-decoration: none; border-bottom: 1px solid var(--line); }
.qr-card .dl:hover { color: var(--accent); border-color: var(--accent); }
.danger { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }
.del { border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--line)); background: transparent; color: var(--danger); font-size: 13px; padding: 8px 14px; border-radius: 8px; cursor: pointer; }
.del:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); }
.two-col { display: grid; grid-template-columns: 1fr 220px; gap: 12px; align-items: start; }
@media (max-width: 560px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .breakdowns, .two-col { grid-template-columns: 1fr; }
  .wrap { padding: 40px 18px 96px; }
  .create { grid-template-columns: 1fr; }
  .create button[type=submit] { width: 100%; }
  .row { flex-wrap: wrap; }
  .row-meta { flex-basis: 100%; justify-content: flex-end; padding-left: 32px; }
  .utm-grid { grid-template-columns: 1fr; }
  .rule-row { grid-template-columns: 1fr 1fr; }
  .rule-row .rule-url { grid-column: 1 / -1; }
  .rule-row .rm { grid-column: 1 / -1; }
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
/* Settings: reveal/hide the API token */
document.addEventListener('click', (e) => {
  const r = e.target.closest('.reveal'); if (!r) return;
  const f = r.parentElement.querySelector('.token-field'); if (!f) return;
  const show = f.type === 'password';
  f.type = show ? 'text' : 'password';
  r.textContent = show ? 'Hide' : 'Reveal';
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

/* UTM builder: compose utm_* onto the destination, live preview, bake in on submit. */
(function(){
  var urlEl = document.querySelector('.create .url');
  var utmFields = Array.prototype.slice.call(document.querySelectorAll('.utm-f'));
  var preview = document.querySelector('.utm-preview');
  var form = document.querySelector('form.create');
  if (!urlEl || !utmFields.length || !preview) return;
  function compose(base){
    try {
      var u = new URL(base);
      utmFields.forEach(function(f){
        var k = f.getAttribute('data-utm'), v = f.value.trim();
        if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
      });
      return u.toString();
    } catch(_) { return null; }
  }
  function anyUtm(){ return utmFields.some(function(f){ return f.value.trim(); }); }
  function refresh(){
    if (!anyUtm()) { preview.hidden = true; return; }
    var composed = compose(urlEl.value.trim());
    if (composed) { preview.hidden = false; preview.textContent = composed; } else { preview.hidden = true; }
  }
  utmFields.forEach(function(f){ f.addEventListener('input', refresh); });
  urlEl.addEventListener('input', refresh);
  if (form) form.addEventListener('submit', function(){
    if (anyUtm()) { var composed = compose(urlEl.value.trim()); if (composed) urlEl.value = composed; }
  });
})();

/* Targeting rules: friendly rows <-> a JSON textarea (which is the no-JS fallback). */
(function(){
  var ta = document.querySelector('.rules-json');
  var container = document.querySelector('.rules');
  if (!ta || !container) return;
  document.body.classList.add('js-on');
  var seed = [];
  try { seed = JSON.parse(ta.value || '[]'); if (!Array.isArray(seed)) seed = []; } catch(_) { seed = []; }
  function sync(){
    var out = [];
    container.querySelectorAll('.rule-row').forEach(function(r){
      var type = r.querySelector('.rule-type').value;
      var match = r.querySelector('.rule-match').value.trim();
      var url = r.querySelector('.rule-url').value.trim();
      if (match || url) out.push({ type: type, match: match, url: url });
    });
    ta.value = out.length ? JSON.stringify(out) : '';
  }
  function makeRow(rule){
    rule = rule || { type: 'platform', match: '', url: '' };
    var row = document.createElement('div'); row.className = 'rule-row';
    var sel = document.createElement('select'); sel.className = 'rule-type';
    [['platform','Platform'],['country','Country']].forEach(function(o){
      var opt = document.createElement('option'); opt.value = o[0]; opt.textContent = o[1];
      if (o[0] === rule.type) opt.selected = true; sel.appendChild(opt);
    });
    var match = document.createElement('input'); match.className = 'rule-match'; match.value = rule.match || '';
    var url = document.createElement('input'); url.className = 'rule-url'; url.type = 'url'; url.placeholder = 'https://…'; url.value = rule.url || '';
    var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'rm'; rm.textContent = '×'; rm.title = 'Remove rule';
    function ph(){ match.placeholder = sel.value === 'country' ? 'US' : 'mobile / ios / android'; }
    ph();
    sel.addEventListener('change', function(){ ph(); sync(); });
    match.addEventListener('input', sync); url.addEventListener('input', sync);
    rm.addEventListener('click', function(){ row.remove(); sync(); });
    row.appendChild(sel); row.appendChild(match); row.appendChild(url); row.appendChild(rm);
    return row;
  }
  seed.forEach(function(r){ container.appendChild(makeRow(r)); });
  var add = document.querySelector('.rule-add');
  if (add) add.addEventListener('click', function(){ container.appendChild(makeRow()); sync(); });
})();
`
