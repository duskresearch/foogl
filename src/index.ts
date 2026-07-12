import { Hono } from 'hono'
import QRCode from 'qrcode-svg'
import { dashboardPage, loginPage, setupPage } from './views'
import { statsPage } from './stats'
import { gate, handleLogin, handleLogout, isAuthed } from './auth'
import { parseClick, isCrawler, clientTraits } from './ua'
import { parseRules, resolveTarget } from './targeting'
import { ogPage, hasOg } from './og'
import { DEPARTURE_MONO_WOFF2_B64 } from './font'
import { LANDING_HTML, OG_PNG_B64, QR_SVG, FAVICON_SVG, ROBOTS_TXT, SITEMAP_XML } from './landing-assets'
import { MANIFEST, SW_JS, FAVICON_SVG as APP_FAVICON, ICON_192_B64, ICON_512_B64, ICON_180_B64 } from './pwa-assets'

// Resources this Worker can talk to. DB is the D1 database from wrangler.jsonc;
// SITE_PASSWORD is the dashboard password (a secret).
export type Env = {
  DB: D1Database
  SITE_PASSWORD: string
  // Optional: where the bare domain (and unknown slugs) redirect. Set it to
  // your main site so people who hit the naked short domain land somewhere real.
  ROOT_URL?: string
  // Optional: enables the HTTP API. Requests send `Authorization: Bearer <API_TOKEN>`.
  API_TOKEN?: string
  // Optional: the host your short links live on, when it differs from where you
  // open the dashboard (e.g. manage on *.workers.dev, share on foo.gl). Cosmetic
  // only — sets what the dashboard shows, the QR encodes, and the API returns.
  LINK_HOST?: string
}

// One row of the `links` table.
export type LinkRow = {
  slug: string
  url: string
  clicks: number
  created_at: string
  og_title: string | null
  og_description: string | null
  og_image: string | null
  expires_at: string | null
  passthrough: number
  permanent: number
  rules: string | null
  hide_referrer: number
}

const app = new Hono<{ Bindings: Env }>()

// Slugs that would collide with our own routes.
const RESERVED = new Set(['api', 'login', 'logout'])

// ───────────────────────────────────────────────────────────
// HOST ROUTING — one Worker, three roles decided by the host:
//   • foo.gl (+ www)  → foogl's marketing LANDING + /slug short links
//   • a dashboard host (app.*, *.workers.dev, localhost) → the DASHBOARD
//   • any other bare short domain → REDIRECT-ONLY: the root goes to the
//     operator's site (ROOT_URL) and /slug resolves, but the dashboard is
//     never exposed there. The dashboard lives on app.<that-domain>.
// Runs before every route below.
// ───────────────────────────────────────────────────────────
app.use('*', async (c, next) => {
  const hostname = (c.req.header('host') || '').toLowerCase().split(':')[0] // drop any :port

  // www.foo.gl → apex, canonical (avoids duplicate content in search).
  if (hostname === 'www.foo.gl') {
    const u = new URL(c.req.url)
    u.hostname = 'foo.gl'
    return c.redirect(u.toString(), 301)
  }

  // foo.gl: the product's landing page, and short links resolve here too.
  if (hostname === 'foo.gl') {
    const p = c.req.path
    if (p === '/_f/dm.woff2') return next() // font is served by the route below
    if (p === '/robots.txt') return c.body(ROBOTS_TXT, 200, { 'content-type': 'text/plain; charset=utf-8' })
    if (p === '/sitemap.xml') return c.body(SITEMAP_XML, 200, { 'content-type': 'application/xml; charset=utf-8' })
    if (p === '/favicon.svg') return c.body(FAVICON_SVG, 200, { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' })
    if (p === '/qr.svg') return c.body(QR_SVG, 200, { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' })
    if (p === '/og.png') {
      const bin = atob(OG_PNG_B64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return c.body(bytes, 200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' })
    }
    // A bare /slug falls through to the redirect route; everything else stays
    // the landing, so the dashboard is never exposed on the marketing host.
    const m = /^\/([a-zA-Z0-9_-]+)$/.exec(p)
    if (m && !RESERVED.has(m[1].toLowerCase())) return next()
    return c.html(LANDING_HTML)
  }

  // Dashboard hosts get the full app (login, manage, API, stats, PWA, CSV).
  if (isDashboardHost(hostname)) return next()

  // Otherwise this is a bare short domain: redirect-only.
  const p = c.req.path
  const m = /^\/([a-zA-Z0-9_-]+)$/.exec(p)
  if (m && !RESERVED.has(m[1].toLowerCase())) return next() // /slug → redirect route
  // Root and everything else (incl. would-be dashboard paths) → the operator's
  // main site if set, else a plain 404. No dashboard on a bare short domain.
  return c.env.ROOT_URL ? c.redirect(c.env.ROOT_URL, 302) : c.notFound()
})

// ───────────────────────────────────────────────────────────
// AUTH (public: login page + form; logout)
// ───────────────────────────────────────────────────────────
app.get('/login', (c) =>
  c.html(c.env.SITE_PASSWORD ? loginPage(c.req.query('error')) : setupPage()),
)
app.post('/login', handleLogin)
app.post('/logout', handleLogout)

// ───────────────────────────────────────────────────────────
// DASHBOARD (gated) — list every link, newest first
// ───────────────────────────────────────────────────────────
app.get('/', async (c) => {
  // This route only runs on dashboard hosts (app.*, workers.dev, localhost) —
  // bare short domains are handled by the host-routing middleware above. So an
  // unauthenticated visitor here just gets the sign-in page.
  if (!(await isAuthed(c))) return c.redirect('/login')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM links ORDER BY created_at DESC',
  ).all<LinkRow>()
  const origin = linkBase(c.env, c.req.url)
  return c.html(dashboardPage(results ?? [], origin, c.req.query('error')))
})

// ───────────────────────────────────────────────────────────
// CREATE (gated)
// ───────────────────────────────────────────────────────────
app.post('/api/links', gate, async (c) => {
  const form = await c.req.parseBody()
  const r = await createLink(c.env, {
    url: String(form.url ?? ''),
    slug: String(form.slug ?? ''),
    og_title: str(form.og_title),
    og_description: str(form.og_description),
    og_image: str(form.og_image),
    expires_at: str(form.expires_at),
    passthrough: !!form.passthrough,
    permanent: !!form.permanent,
  })
  return c.redirect(r.ok ? '/' : '/?error=' + r.error)
})

// ───────────────────────────────────────────────────────────
// EDIT (gated) — change destination + social preview
// ───────────────────────────────────────────────────────────
app.post('/api/links/:slug/edit', gate, async (c) => {
  const slug = c.req.param('slug')
  const form = await c.req.parseBody()
  const url = String(form.url ?? '').trim()
  if (!isValidUrl(url)) return c.redirect(`/${slug}/stats?error=badurl`)
  const exp = form.expires_at ? String(form.expires_at).slice(0, 10) : null
  const parsed = parseRules(str(form.rules))
  if (!parsed.ok) return c.redirect(`/${slug}/stats?error=badrules`)
  const rules = parsed.rules.length ? JSON.stringify(parsed.rules) : null

  await c.env.DB.prepare(
    'UPDATE links SET url = ?, og_title = ?, og_description = ?, og_image = ?, expires_at = ?, passthrough = ?, permanent = ?, hide_referrer = ?, rules = ? WHERE slug = ?',
  )
    .bind(url, str(form.og_title), str(form.og_description), str(form.og_image), exp, form.passthrough ? 1 : 0, form.permanent ? 1 : 0, form.hide_referrer ? 1 : 0, rules, slug)
    .run()
  return c.redirect(`/${slug}/stats`)
})

// ───────────────────────────────────────────────────────────
// DELETE (gated)
// ───────────────────────────────────────────────────────────
app.post('/api/links/:slug/delete', gate, async (c) => {
  const slug = c.req.param('slug')
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM links WHERE slug = ?').bind(slug),
    c.env.DB.prepare('DELETE FROM clicks WHERE slug = ?').bind(slug),
  ])
  return c.redirect('/')
})

// ───────────────────────────────────────────────────────────
// QR CODE (public) — GET /:slug/qr  (add ?download=1 to save)
// ───────────────────────────────────────────────────────────
app.get('/:slug/qr', async (c) => {
  const slug = c.req.param('slug')
  const exists = await c.env.DB.prepare('SELECT 1 FROM links WHERE slug = ?').bind(slug).first()
  if (!exists) return c.notFound()

  const origin = linkBase(c.env, c.req.url)
  const svg = new QRCode({
    content: `${origin}/${slug}`,
    padding: 2,
    width: 256,
    height: 256,
    color: '#000000',
    background: '#ffffff',
    ecl: 'M',
    join: true,
  }).svg()

  const headers: Record<string, string> = {
    'content-type': 'image/svg+xml; charset=utf-8',
    'cache-control': 'public, max-age=86400',
  }
  if (c.req.query('download')) headers['content-disposition'] = `attachment; filename="${slug}.svg"`
  return new Response(svg, { headers })
})

// ───────────────────────────────────────────────────────────
// PER-LINK STATS (gated) — GET /:slug/stats
// ───────────────────────────────────────────────────────────
app.get('/:slug/stats', gate, async (c) => {
  const slug = c.req.param('slug')
  const link = await c.env.DB.prepare('SELECT * FROM links WHERE slug = ?').bind(slug).first<LinkRow>()
  if (!link) return c.notFound()
  const origin = linkBase(c.env, c.req.url)

  const [series, countries, referers, devices, browsers, last7] = await Promise.all([
    c.env.DB.prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS n FROM clicks
       WHERE slug = ? AND created_at >= date('now','-29 days') GROUP BY day ORDER BY day`,
    ).bind(slug).all<{ day: string; n: number }>(),
    c.env.DB.prepare(
      `SELECT COALESCE(country,'Unknown') AS k, COUNT(*) AS n FROM clicks WHERE slug=? GROUP BY k ORDER BY n DESC LIMIT 6`,
    ).bind(slug).all<{ k: string; n: number }>(),
    c.env.DB.prepare(
      `SELECT COALESCE(referer,'Direct') AS k, COUNT(*) AS n FROM clicks WHERE slug=? GROUP BY k ORDER BY n DESC LIMIT 6`,
    ).bind(slug).all<{ k: string; n: number }>(),
    c.env.DB.prepare(
      `SELECT COALESCE(device,'unknown') AS k, COUNT(*) AS n FROM clicks WHERE slug=? GROUP BY k ORDER BY n DESC LIMIT 6`,
    ).bind(slug).all<{ k: string; n: number }>(),
    c.env.DB.prepare(
      `SELECT COALESCE(browser,'Other') AS k, COUNT(*) AS n FROM clicks WHERE slug=? GROUP BY k ORDER BY n DESC LIMIT 6`,
    ).bind(slug).all<{ k: string; n: number }>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM clicks WHERE slug=? AND created_at >= datetime('now','-7 days')`,
    ).bind(slug).first<{ n: number }>(),
  ])

  return c.html(
    statsPage({
      link,
      origin,
      series: series.results ?? [],
      countries: countries.results ?? [],
      referers: referers.results ?? [],
      devices: devices.results ?? [],
      browsers: browsers.results ?? [],
      last7: last7?.n ?? 0,
      error: c.req.query('error'),
    }),
  )
})

// ───────────────────────────────────────────────────────────
// FONT (public) — self-serve Departure Mono so the app matches the brand.
// ───────────────────────────────────────────────────────────
app.get('/_f/dm.woff2', (c) => {
  const bin = atob(DEPARTURE_MONO_WOFF2_B64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Response(bytes, {
    headers: { 'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable' },
  })
})

// ───────────────────────────────────────────────────────────
// CSV EXPORT (gated) — your data is yours. `.csv` can't be a slug (no dots),
// so these are safe to register ahead of the /:slug redirect.
// ───────────────────────────────────────────────────────────
app.get('/links.csv', gate, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT slug, url, clicks, created_at, expires_at, passthrough, permanent, hide_referrer FROM links ORDER BY created_at DESC',
  ).all<LinkRow>()
  const origin = linkBase(c.env, c.req.url)
  const header = ['slug', 'short_url', 'destination', 'clicks', 'created_at', 'expires_at', 'passthrough', 'permanent', 'hide_referrer']
  const rows = (results ?? []).map((l) => [
    l.slug, `${origin}/${l.slug}`, l.url, l.clicks, l.created_at, l.expires_at ?? '', l.passthrough, l.permanent, l.hide_referrer,
  ])
  return new Response(toCsv([header, ...rows]), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="foogl-links.csv"' },
  })
})

app.get('/:slug/clicks.csv', gate, async (c) => {
  const slug = c.req.param('slug')
  const exists = await c.env.DB.prepare('SELECT 1 FROM links WHERE slug = ?').bind(slug).first()
  if (!exists) return c.notFound()
  const { results } = await c.env.DB.prepare(
    'SELECT created_at, country, city, device, browser, os, referer FROM clicks WHERE slug = ? ORDER BY created_at DESC LIMIT 100000',
  ).bind(slug).all<{ created_at: string; country: string | null; city: string | null; device: string; browser: string; os: string; referer: string | null }>()
  const header = ['clicked_at', 'country', 'city', 'device', 'browser', 'os', 'referer']
  const rows = (results ?? []).map((r) => [r.created_at, r.country ?? '', r.city ?? '', r.device, r.browser, r.os, r.referer ?? ''])
  return new Response(toCsv([header, ...rows]), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="foogl-${slug}-clicks.csv"` },
  })
})

// ───────────────────────────────────────────────────────────
// PWA (public) — lets the dashboard install to a phone home screen.
// ───────────────────────────────────────────────────────────
app.get('/manifest.webmanifest', (c) =>
  c.body(MANIFEST, 200, { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=86400' }),
)
app.get('/sw.js', (c) =>
  c.body(SW_JS, 200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' }),
)
app.get('/favicon.svg', (c) =>
  c.body(APP_FAVICON, 200, { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' }),
)
app.get('/icon-192.png', () => pngResponse(ICON_192_B64))
app.get('/icon-512.png', () => pngResponse(ICON_512_B64))
app.get('/icon-180.png', () => pngResponse(ICON_180_B64))

// ───────────────────────────────────────────────────────────
// HTTP API (public, token-gated) — opt-in; set the API_TOKEN variable
// to enable it. Authenticate with:  Authorization: Bearer <API_TOKEN>
// ───────────────────────────────────────────────────────────
const api = new Hono<{ Bindings: Env }>()
api.use('*', async (c, next) => {
  const token = c.env.API_TOKEN
  if (!token) return c.json({ error: 'api_disabled', detail: 'Set the API_TOKEN variable to enable the HTTP API.' }, 503)
  const hdr = c.req.header('authorization') || ''
  const got = hdr.startsWith('Bearer ') ? hdr.slice(7).trim() : ''
  if (got !== token) return c.json({ error: 'unauthorized' }, 401)
  await next()
})
api.get('/links', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM links ORDER BY created_at DESC').all<LinkRow>()
  const origin = linkBase(c.env, c.req.url)
  return c.json({ links: (results ?? []).map((l) => publicLink(l, origin)) })
})
api.post('/links', async (c) => {
  let body: Record<string, unknown> = {}
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'bad_json' }, 400)
  }
  const r = await createLink(c.env, {
    url: String(body.url ?? ''),
    slug: body.slug ? String(body.slug) : '',
    og_title: str(body.og_title),
    og_description: str(body.og_description),
    og_image: str(body.og_image),
    expires_at: str(body.expires_at),
    passthrough: !!body.passthrough,
    permanent: !!body.permanent,
    hide_referrer: !!body.hide_referrer,
    rules: body.rules,
  })
  if (!r.ok) return c.json({ error: r.error }, 400)
  const link = await c.env.DB.prepare('SELECT * FROM links WHERE slug = ?').bind(r.slug).first<LinkRow>()
  return c.json(publicLink(link!, linkBase(c.env, c.req.url)), 201)
})
api.get('/links/:slug', async (c) => {
  const link = await c.env.DB.prepare('SELECT * FROM links WHERE slug = ?').bind(c.req.param('slug')).first<LinkRow>()
  if (!link) return c.json({ error: 'not_found' }, 404)
  return c.json(publicLink(link, linkBase(c.env, c.req.url)))
})
api.delete('/links/:slug', async (c) => {
  const slug = c.req.param('slug')
  const exists = await c.env.DB.prepare('SELECT 1 FROM links WHERE slug = ?').bind(slug).first()
  if (!exists) return c.json({ error: 'not_found' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM links WHERE slug = ?').bind(slug),
    c.env.DB.prepare('DELETE FROM clicks WHERE slug = ?').bind(slug),
  ])
  return c.json({ ok: true })
})
app.route('/api/v1', api)

// ───────────────────────────────────────────────────────────
// REDIRECT (public) — must be LAST so it doesn't shadow routes above.
// Serves a social-preview page to crawlers; redirects everyone else and
// records the click AFTER the redirect ships.
// ───────────────────────────────────────────────────────────
app.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const link = await c.env.DB.prepare('SELECT * FROM links WHERE slug = ?').bind(slug).first<LinkRow>()
  // Unknown or expired slug: fall back to your site if ROOT_URL is set, else a plain 404.
  if (!link || isExpired(link)) return c.env.ROOT_URL ? c.redirect(c.env.ROOT_URL, 302) : c.notFound()

  const req = c.req.raw
  const dest = destOf(link, req) // forwards ?query to the target when passthrough is on
  const code = link.permanent ? 301 : 302

  if (isCrawler(req)) {
    // Social/link-preview bot: show the branded card if we have one, else just redirect.
    return hasOg(link) ? c.html(ogPage(link)) : c.redirect(dest, code)
  }

  const info = parseClick(req)
  c.executionCtx.waitUntil(
    c.env.DB.batch([
      c.env.DB.prepare('UPDATE links SET clicks = clicks + 1 WHERE slug = ?').bind(slug),
      c.env.DB.prepare(
        'INSERT INTO clicks (slug, country, city, device, browser, os, referer) VALUES (?,?,?,?,?,?,?)',
      ).bind(slug, info.country, info.city, info.device, info.browser, info.os, info.referer),
    ]),
  )
  // Referrer hiding: send them through a no-referrer interstitial so the
  // destination can't see where the click came from. (An HTML hop, so the
  // 301/302 choice doesn't apply here.)
  if (link.hide_referrer) {
    return c.html(referrerHidePage(dest), 200, { 'referrer-policy': 'no-referrer' })
  }
  return c.redirect(dest, code)
})

export default app

// ───────────────────────────────────────────────────────────
// tiny helpers
// ───────────────────────────────────────────────────────────
function str(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s || null
}

type CreateInput = {
  url: string
  slug?: string
  og_title?: string | null
  og_description?: string | null
  og_image?: string | null
  expires_at?: string | null
  passthrough?: boolean
  permanent?: boolean
  hide_referrer?: boolean
  rules?: unknown
}

// Shared create path, used by the dashboard form AND the HTTP API.
async function createLink(
  env: Env,
  input: CreateInput,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const url = (input.url ?? '').trim()
  if (!isValidUrl(url)) return { ok: false, error: 'badurl' }
  let slug = (input.slug ?? '').trim()
  if (!slug) slug = randomSlug()
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return { ok: false, error: 'badslug' }
  if (RESERVED.has(slug.toLowerCase())) return { ok: false, error: 'reserved' }
  const exp = input.expires_at ? String(input.expires_at).slice(0, 10) : null
  if (exp && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) return { ok: false, error: 'badexp' }
  const parsed = parseRules(input.rules)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  const rules = parsed.rules.length ? JSON.stringify(parsed.rules) : null
  try {
    await env.DB.prepare(
      'INSERT INTO links (slug, url, og_title, og_description, og_image, expires_at, passthrough, permanent, hide_referrer, rules) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
      .bind(slug, url, input.og_title ?? null, input.og_description ?? null, input.og_image ?? null, exp, input.passthrough ? 1 : 0, input.permanent ? 1 : 0, input.hide_referrer ? 1 : 0, rules)
      .run()
  } catch {
    return { ok: false, error: 'taken' }
  }
  return { ok: true, slug }
}

// Destination for this request: apply targeting rules first (a matching rule
// can override the default URL), then optional query passthrough on top.
function destOf(link: LinkRow, req: Request): string {
  const base = resolveTarget(link.rules, clientTraits(req), link.url)
  if (!link.passthrough) return base
  const inQs = new URL(req.url).search
  if (!inQs) return base
  try {
    const d = new URL(base)
    for (const [k, v] of new URLSearchParams(inQs)) d.searchParams.append(k, v)
    return d.toString()
  } catch {
    return base
  }
}

function pngResponse(b64: string): Response {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Response(bytes, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' } })
}

// Tiny interstitial that drops the referrer, then bounces to the destination.
function referrerHidePage(dest: string): string {
  const attr = dest.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="referrer" content="no-referrer">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta http-equiv="refresh" content="0; url=${attr}">` +
    `<title>Redirecting…</title></head>` +
    `<body style="font:15px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:#8A929C;background:#070809;display:grid;place-items:center;height:100vh;margin:0">` +
    `<p>Redirecting… <a href="${attr}" style="color:#3FCF5E;text-decoration:none">Continue →</a></p>` +
    `<script>location.replace(${JSON.stringify(dest)})</script></body></html>`
}

// CSV: quote a cell only when it needs it (comma, quote, or newline).
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

// A host is a "dashboard host" if it's the app.* subdomain, the workers.dev
// URL (so a fresh deploy works before custom domains), or local dev.
function isDashboardHost(hostname: string): boolean {
  return (
    hostname.startsWith('app.') ||
    hostname.endsWith('.workers.dev') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  )
}

// The base URL to SHOW short links on. LINK_HOST wins if set. Otherwise, when
// the dashboard is on app.<domain>, links live on <domain> — so strip "app.".
// Falls back to the request's own origin (e.g. the workers.dev URL).
function linkBase(env: Env, reqUrl: string): string {
  if (env.LINK_HOST) return 'https://' + env.LINK_HOST.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const u = new URL(reqUrl)
  if (u.hostname.startsWith('app.')) {
    return `${u.protocol}//${u.hostname.slice(4)}${u.port ? ':' + u.port : ''}`
  }
  return u.origin
}

// expires_at is a plain "YYYY-MM-DD"; a link is live through the end of that day (UTC).
function isExpired(link: LinkRow): boolean {
  if (!link.expires_at) return false
  return Date.now() > new Date(link.expires_at + 'T23:59:59Z').getTime()
}

// The JSON shape the HTTP API returns for a link.
function publicLink(l: LinkRow, origin: string) {
  let rules: unknown = []
  if (l.rules) {
    try {
      rules = JSON.parse(l.rules)
    } catch {
      rules = []
    }
  }
  return {
    slug: l.slug,
    url: l.url,
    short_url: `${origin}/${l.slug}`,
    clicks: l.clicks,
    created_at: l.created_at,
    expires_at: l.expires_at,
    passthrough: !!l.passthrough,
    permanent: !!l.permanent,
    hide_referrer: !!l.hide_referrer,
    rules,
    og: { title: l.og_title, description: l.og_description, image: l.og_image },
  }
}
function randomSlug(len = 6): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789' // no look-alikes (l,1,o,0)
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}
function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
