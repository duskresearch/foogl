import type { LinkRow } from './index'
import { layout, escapeHtml, escapeAttr, prettyUrl } from './views'

type Row = { k: string; n: number }
type StatsData = {
  link: LinkRow
  origin: string
  last7: number
  series: { day: string; n: number }[]
  countries: Row[]
  referers: Row[]
  devices: Row[]
  browsers: Row[]
  error?: string
}

export function statsPage(d: StatsData): string {
  const { link, origin } = d
  const shortUrl = `${origin}/${link.slug}`
  const topCountry = d.countries[0]?.k ?? '—'
  const created = link.created_at?.slice(0, 10) ?? ''

  const body = `
  <main class="wrap">
    <a class="back" href="/">← All links</a>

    <div class="detail-head">
      <span class="slug">/${escapeHtml(link.slug)}</span>
      <button class="copy" data-copy="${escapeAttr(shortUrl)}" title="Copy short link">Copy</button>
    </div>
    <p class="detail-sub">
      <a href="${escapeAttr(link.url)}" target="_blank" rel="noopener">${escapeHtml(prettyUrl(link.url))} ↗</a>
      <span>·</span><span>created ${escapeHtml(created)}</span>
    </p>

    ${d.error ? `<div class="banner">That doesn’t look like a valid http(s) link.</div>` : ''}

    <div class="stats-grid">
      <div class="stat-card"><div class="n">${link.clicks.toLocaleString('en-US')}</div><div class="l">Total clicks</div></div>
      <div class="stat-card"><div class="n">${d.last7.toLocaleString('en-US')}</div><div class="l">Last 7 days</div></div>
      <div class="stat-card"><div class="n">${escapeHtml(withFlag(topCountry))}</div><div class="l">Top country</div></div>
    </div>

    ${chart(d.series)}

    <div class="breakdowns">
      ${bdCard('Top countries', d.countries.map((r) => ({ ...r, k: withFlag(r.k) })))}
      ${bdCard('Top referrers', d.referers)}
      ${bdCard('Devices', d.devices.map((r) => ({ ...r, k: cap(r.k) })))}
      ${bdCard('Browsers', d.browsers)}
    </div>

    <div class="section-title">Manage</div>
    <div class="two-col">
      <form class="edit" method="post" action="/api/links/${escapeAttr(link.slug)}/edit">
        <label>Destination URL</label>
        <input name="url" type="url" required value="${escapeAttr(link.url)}" />
        <label>Social preview title</label>
        <input name="og_title" type="text" value="${escapeAttr(link.og_title ?? '')}" placeholder="optional" />
        <label>Social preview description</label>
        <input name="og_description" type="text" value="${escapeAttr(link.og_description ?? '')}" placeholder="optional" />
        <label>Social preview image URL</label>
        <input name="og_image" type="url" value="${escapeAttr(link.og_image ?? '')}" placeholder="optional" />
        <div class="row-2">
          <button class="save" type="submit">Save changes</button>
        </div>
      </form>

      <div class="qr-card">
        <img src="/${escapeAttr(link.slug)}/qr" alt="QR code" width="160" height="160" />
        <div><a class="dl" href="/${escapeAttr(link.slug)}/qr?download=1">Download QR ↓</a></div>
      </div>
    </div>

    <div class="danger">
      <span class="l" style="color:var(--muted);font-size:13px">Delete this link permanently.</span>
      <form method="post" action="/api/links/${escapeAttr(link.slug)}/delete"
            onsubmit="return confirm('Delete /${escapeHtml(link.slug)}? This cannot be undone.')">
        <button class="del" type="submit">Delete link</button>
      </form>
    </div>
  </main>`
  return layout(`/${link.slug} · Links`, body)
}

// ── chart: last 30 days as bars ──
function chart(series: { day: string; n: number }[]): string {
  const days = last30(series)
  const max = Math.max(1, ...days.map((x) => x.n))
  const bars = days
    .map((x) => {
      const h = (x.n / max) * 100
      return `<div class="bar" style="height:${h}%"><span>${x.n} on ${x.day.slice(5)}</span></div>`
    })
    .join('')
  return `<div class="chart-card">
    <p class="chart-title">Clicks · last 30 days</p>
    <div class="chart">${bars}</div>
    <div class="chart-axis"><span>${days[0].day.slice(5)}</span><span>${days[days.length - 1].day.slice(5)}</span></div>
  </div>`
}

function last30(series: { day: string; n: number }[]): { day: string; n: number }[] {
  const map = new Map(series.map((s) => [s.day, s.n]))
  const now = new Date()
  const out: { day: string; n: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    const key = d.toISOString().slice(0, 10)
    out.push({ day: key, n: map.get(key) ?? 0 })
  }
  return out
}

function bdCard(title: string, rows: Row[], wide = false): string {
  const max = Math.max(1, ...rows.map((r) => r.n))
  const items = rows.length
    ? rows
        .map((r) => {
          const pct = Math.round((r.n / max) * 100)
          return `<div class="bd-row"><span class="fill" style="width:${pct}%"></span><span class="k">${escapeHtml(r.k)}</span><span class="v">${r.n}</span></div>`
        })
        .join('')
    : `<div class="bd-empty">No data yet.</div>`
  return `<div class="bd${wide ? ' wide' : ''}"><h3>${escapeHtml(title)}</h3>${items}</div>`
}

// ISO country code → flag emoji + code, e.g. "US" → "🇺🇸 US"
function withFlag(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return cc
  const base = 0x1f1e6
  const flag = String.fromCodePoint(
    ...cc.toUpperCase().split('').map((ch) => base + ch.charCodeAt(0) - 65),
  )
  return `${flag} ${cc.toUpperCase()}`
}
function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}
