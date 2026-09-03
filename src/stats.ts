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
  home: string
}

const STATS_ERRORS: Record<string, string> = {
  badurl: 'That doesn’t look like a valid http(s) link.',
  badexp: 'The expiry date isn’t a valid calendar date.',
  badrules: 'A targeting rule is incomplete. Each needs a match value and a valid http(s) URL.',
}

export function statsPage(d: StatsData): string {
  const { link, origin } = d
  const shortUrl = `${origin}/${link.slug}`
  const topCountry = d.countries[0]?.k ?? '—'
  const created = link.created_at?.slice(0, 10) ?? ''

  const body = `
  <main class="wrap">
    <a class="back" href="${d.home}">← All links</a>

    <div class="detail-head">
      <span class="slug">/${escapeHtml(link.slug)}</span>
      <button class="copy" data-copy="${escapeAttr(shortUrl)}" title="Copy short link">Copy</button>
    </div>
    <p class="detail-sub">
      <a href="${escapeAttr(link.url)}" target="_blank" rel="noopener">${escapeHtml(prettyUrl(link.url))} ↗</a>
      <span>·</span><span>created ${escapeHtml(created)}</span>
      <span>·</span><a href="/${escapeAttr(link.slug)}/clicks.csv">Export clicks ↓</a>
    </p>

    ${d.error ? `<div class="banner">${STATS_ERRORS[d.error] ?? 'Something went wrong.'}</div>` : ''}

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
        <label>Expires on <span class="opt-inline">(leave blank for never)</span></label>
        <input name="expires_at" type="date" value="${escapeAttr(link.expires_at ?? '')}" />
        <label class="check" style="margin-top:4px">
          <input type="checkbox" name="passthrough" value="1" ${link.passthrough ? 'checked' : ''} />
          <span><b>Forward query parameters</b> to the destination.</span>
        </label>
        <label class="check">
          <input type="checkbox" name="permanent" value="1" ${link.permanent ? 'checked' : ''} />
          <span><b>Permanent redirect (301)</b> instead of temporary (302).</span>
        </label>
        <label class="check">
          <input type="checkbox" name="hide_referrer" value="1" ${link.hide_referrer ? 'checked' : ''} />
          <span><b>Hide referrer.</b> Redirect through a no-referrer interstitial.</span>
        </label>
        <label style="margin-top:4px">Targeting rules <span class="opt-inline">(first match wins; everyone else gets the destination above)</span></label>
        <p class="rules-hint">Send different visitors elsewhere. <b>Platform</b> = mobile, desktop, tablet, ios or android. <b>Country</b> = a 2-letter code like <code>US</code>.</p>
        <div class="rules"></div>
        <button type="button" class="rule-add">+ Add rule</button>
        <textarea name="rules" class="rules-json" spellcheck="false" placeholder='[{"type":"platform","match":"ios","url":"https://apps.apple.com/…"}]'>${escapeHtml(link.rules ?? '')}</textarea>
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
  return layout(`/${link.slug} · foogl`, body)
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
