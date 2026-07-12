// Per-link redirect rules. A rule sends a subset of visitors to a different URL;
// the first matching rule wins, and everyone else falls through to the link's
// default destination. Two dimensions, both free at Cloudflare's edge:
//   • country  — matches the visitor's ISO-2 country (from request.cf.country)
//   • platform — matches device (mobile/tablet/desktop) OR os (ios/android/…)
// That covers the two things people actually reach for: app-install links
// (iOS → App Store, Android → Play) and regional links (US → us-site).

export type Rule = { type: 'country' | 'platform'; match: string; url: string }
export type Traits = { country: string; device: string; os: string }

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// Validate + normalize rules coming from the edit form (JSON string) or the API
// (already an array). Returns a clean array, or an error the caller can surface.
export function parseRules(raw: unknown): { ok: true; rules: Rule[] } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, rules: [] }
  let arr: unknown = raw
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return { ok: true, rules: [] }
    try {
      arr = JSON.parse(s)
    } catch {
      return { ok: false, error: 'badrules' }
    }
  }
  if (!Array.isArray(arr)) return { ok: false, error: 'badrules' }
  const out: Rule[] = []
  for (const r of arr) {
    if (!r || typeof r !== 'object') continue
    const rec = r as Record<string, unknown>
    const type = String(rec.type ?? '').toLowerCase()
    const match = String(rec.match ?? '').trim()
    const url = String(rec.url ?? '').trim()
    if (!match && !url) continue // skip fully-blank rows the form may emit
    if (type !== 'country' && type !== 'platform') return { ok: false, error: 'badrules' }
    if (!match) return { ok: false, error: 'badrules' }
    if (!isHttpUrl(url)) return { ok: false, error: 'badrules' }
    out.push({ type, match: type === 'country' ? match.toUpperCase() : match.toLowerCase(), url })
    if (out.length >= 25) break // sanity cap; this is a shortener, not a router
  }
  return { ok: true, rules: out }
}

// Pick the destination for this visitor: the first matching rule, else `fallback`.
export function resolveTarget(rulesJson: string | null, traits: Traits, fallback: string): string {
  if (!rulesJson) return fallback
  let rules: unknown
  try {
    rules = JSON.parse(rulesJson)
  } catch {
    return fallback
  }
  if (!Array.isArray(rules)) return fallback
  for (const r of rules) {
    if (!r || typeof r.url !== 'string') continue
    const match = String(r.match ?? '').toLowerCase()
    if (r.type === 'country' && match === traits.country) return r.url
    if (r.type === 'platform' && (match === traits.device || match === traits.os)) return r.url
  }
  return fallback
}
