import { Hono } from 'hono'
import QRCode from 'qrcode-svg'
import { dashboardPage, loginPage } from './views'
import { statsPage } from './stats'
import { gate, handleLogin, handleLogout } from './auth'
import { parseClick, isCrawler } from './ua'
import { ogPage, hasOg } from './og'

// Resources this Worker can talk to. DB is the D1 database from wrangler.jsonc;
// SITE_PASSWORD is the dashboard password (a secret).
export type Env = {
  DB: D1Database
  SITE_PASSWORD: string
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
}

const app = new Hono<{ Bindings: Env }>()

// Slugs that would collide with our own routes.
const RESERVED = new Set(['api', 'login', 'logout'])

// ───────────────────────────────────────────────────────────
// AUTH (public: login page + form; logout)
// ───────────────────────────────────────────────────────────
app.get('/login', (c) => c.html(loginPage(c.req.query('error'))))
app.post('/login', handleLogin)
app.post('/logout', handleLogout)

// ───────────────────────────────────────────────────────────
// DASHBOARD (gated) — list every link, newest first
// ───────────────────────────────────────────────────────────
app.get('/', gate, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM links ORDER BY created_at DESC',
  ).all<LinkRow>()
  const origin = new URL(c.req.url).origin
  return c.html(dashboardPage(results ?? [], origin, c.req.query('error')))
})

// ───────────────────────────────────────────────────────────
// CREATE (gated)
// ───────────────────────────────────────────────────────────
app.post('/api/links', gate, async (c) => {
  const form = await c.req.parseBody()
  const url = String(form.url ?? '').trim()
  let slug = String(form.slug ?? '').trim()

  if (!isValidUrl(url)) return c.redirect('/?error=badurl')
  if (!slug) slug = randomSlug()
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return c.redirect('/?error=badslug')
  if (RESERVED.has(slug.toLowerCase())) return c.redirect('/?error=reserved')

  try {
    await c.env.DB.prepare(
      'INSERT INTO links (slug, url, og_title, og_description, og_image) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(slug, url, str(form.og_title), str(form.og_description), str(form.og_image))
      .run()
  } catch {
    return c.redirect('/?error=taken') // slug is the primary key → duplicate throws
  }
  return c.redirect('/')
})

// ───────────────────────────────────────────────────────────
// EDIT (gated) — change destination + social preview
// ───────────────────────────────────────────────────────────
app.post('/api/links/:slug/edit', gate, async (c) => {
  const slug = c.req.param('slug')
  const form = await c.req.parseBody()
  const url = String(form.url ?? '').trim()
  if (!isValidUrl(url)) return c.redirect(`/${slug}/stats?error=badurl`)

  await c.env.DB.prepare(
    'UPDATE links SET url = ?, og_title = ?, og_description = ?, og_image = ? WHERE slug = ?',
  )
    .bind(url, str(form.og_title), str(form.og_description), str(form.og_image), slug)
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

  const origin = new URL(c.req.url).origin
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
  const origin = new URL(c.req.url).origin

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
// REDIRECT (public) — must be LAST so it doesn't shadow routes above.
// Serves a social-preview page to crawlers; redirects everyone else and
// records the click AFTER the redirect ships.
// ───────────────────────────────────────────────────────────
app.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const link = await c.env.DB.prepare('SELECT * FROM links WHERE slug = ?').bind(slug).first<LinkRow>()
  if (!link) return c.notFound()

  const req = c.req.raw
  if (isCrawler(req)) {
    // Social/link-preview bot: show the branded card if we have one, else just redirect.
    return hasOg(link) ? c.html(ogPage(link)) : c.redirect(link.url, 302)
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
  return c.redirect(link.url, 302)
})

export default app

// ───────────────────────────────────────────────────────────
// tiny helpers
// ───────────────────────────────────────────────────────────
function str(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s || null
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
