// Tiny, dependency-free request parsing. Enough to answer "which device /
// browser / OS / country / referrer" without pulling in a heavy UA library.

export type ClickInfo = {
  country: string | null
  city: string | null
  device: string
  browser: string
  os: string
  referer: string | null
}

// Cloudflare attaches geo (country/city) to every request for free — no
// MaxMind database, no API token. In local dev these may be undefined.
export function parseClick(req: Request): ClickInfo {
  const ua = req.headers.get('user-agent') || ''
  const cf = (req as unknown as { cf?: Record<string, string> }).cf || {}
  return {
    country: cf.country ?? null,
    city: cf.city ?? null,
    device: deviceOf(ua),
    browser: browserOf(ua),
    os: osOf(ua),
    referer: refererHost(req.headers.get('referer')),
  }
}

// The lowercased traits targeting rules match against. Same source data as
// parseClick, but shaped for comparison and without the analytics-only fields.
export function clientTraits(req: Request): { country: string; device: string; os: string } {
  const ua = req.headers.get('user-agent') || ''
  const cf = (req as unknown as { cf?: Record<string, string> }).cf || {}
  return {
    country: (cf.country ?? '').toLowerCase(),
    device: deviceOf(ua).toLowerCase(), // mobile / tablet / desktop
    os: osOf(ua).toLowerCase(), // windows / ios / macos / android / linux / other
  }
}

function deviceOf(ua: string): string {
  if (/\b(iPad|Tablet)\b/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet'
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile'
  return 'desktop'
}
function osOf(ua: string): string {
  if (/Windows/i.test(ua)) return 'Windows'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Mac OS X/i.test(ua)) return 'macOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Other'
}
function browserOf(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\/|Opera/i.test(ua)) return 'Opera'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Chrome\//i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua)) return 'Safari'
  return 'Other'
}
function refererHost(ref: string | null): string | null {
  if (!ref) return null
  try {
    return new URL(ref).host || null
  } catch {
    return null
  }
}

// Social / link-preview crawlers. When one of these fetches a link that has
// social-preview data, we serve OG meta tags instead of redirecting, so the
// shared link renders as a branded card. We also never count these as clicks.
const CRAWLERS = [
  'facebookexternalhit', 'twitterbot', 'slackbot', 'discordbot', 'telegrambot',
  'whatsapp', 'linkedinbot', 'pinterest', 'redditbot', 'skypeuripreview',
  'googlebot', 'bingbot', 'embedly', 'quora link preview', 'vkshare',
  'mastodon', 'bluesky', 'applebot', 'yandex',
]
export function isCrawler(req: Request): boolean {
  const ua = (req.headers.get('user-agent') || '').toLowerCase()
  return CRAWLERS.some((c) => ua.includes(c))
}
