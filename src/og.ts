import type { LinkRow } from './index'
import { escapeHtml } from './views'

// Served ONLY to social crawlers (Twitter, Slack, Discord, etc.) when a link
// has social-preview data. Humans never see this — they get a 302 redirect.
// The crawler reads these meta tags and renders a branded card.
export function ogPage(link: LinkRow): string {
  const title = link.og_title || link.url
  const desc = link.og_description || ''
  const img = link.og_image || ''
  const dest = link.url
  const card = img ? 'summary_large_image' : 'summary'

  return `<!doctype html>
<html><head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<meta property="og:title" content="${escapeHtml(title)}"/>
${desc ? `<meta property="og:description" content="${escapeHtml(desc)}"/>` : ''}
${img ? `<meta property="og:image" content="${escapeHtml(img)}"/>` : ''}
<meta property="og:url" content="${escapeHtml(dest)}"/>
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="${card}"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
${desc ? `<meta name="twitter:description" content="${escapeHtml(desc)}"/>` : ''}
${img ? `<meta name="twitter:image" content="${escapeHtml(img)}"/>` : ''}
<meta http-equiv="refresh" content="0; url=${escapeHtml(dest)}"/>
</head><body></body></html>`
}

// A link only needs the crawler page if it actually has preview data.
export function hasOg(link: LinkRow): boolean {
  return !!(link.og_title || link.og_description || link.og_image)
}
