import { layout, escapeAttr } from './views'

export type SettingsView = {
  rootUrl: string
  apiToken: string | null
  apiFromEnv: boolean
  defaultPermanent: boolean
  passwordInApp: boolean
  notice?: string
  error?: string
}

const NOTICES: Record<string, string> = {
  general: 'Settings saved.',
  token_new: 'New API token generated. It’s shown below, so copy it now.',
  token_off: 'The HTTP API is now off.',
  token_off_env: 'Stored token cleared, but the API_TOKEN environment variable still enables the API. Remove it with: npx wrangler secret delete API_TOKEN',
  password: 'Password updated.',
}
const ERRORS: Record<string, string> = {
  badurl: 'That main-site URL isn’t a valid http(s) link.',
  pw_wrong: 'Your current password is incorrect.',
  pw_mismatch: 'The new passwords don’t match.',
  pw_short: 'Use at least 8 characters for the new password.',
}

export function settingsPage(d: SettingsView): string {
  const body = `
  <main class="wrap">
    <a class="back" href="/">← All links</a>
    <div class="detail-head"><span class="slug">Settings</span></div>
    <p class="detail-sub">Run your foogl from here. No trip to the Cloudflare dashboard.</p>

    ${d.notice ? `<div class="banner ok">${NOTICES[d.notice] ?? 'Saved.'}</div>` : ''}
    ${d.error ? `<div class="banner">${ERRORS[d.error] ?? 'Something went wrong.'}</div>` : ''}

    <div class="section-title">General</div>
    <form class="edit" method="post" action="/api/settings">
      <label>Main site <span class="opt-inline">(your bare domain and any unknown link go here)</span></label>
      <input name="root_url" type="url" value="${escapeAttr(d.rootUrl)}" placeholder="https://yourbrand.com (optional)" />
      <label style="margin-top:6px">New links default to</label>
      <label class="radio"><input type="radio" name="default_permanent" value="0" ${d.defaultPermanent ? '' : 'checked'} /> <span><b>302 temporary.</b> Stays editable and tracked (recommended).</span></label>
      <label class="radio"><input type="radio" name="default_permanent" value="1" ${d.defaultPermanent ? 'checked' : ''} /> <span><b>301 permanent.</b> Cached hard by browsers, not tracked.</span></label>
      <div class="row-2"><button class="save" type="submit">Save</button></div>
    </form>

    <div class="section-title">HTTP API</div>
    <form class="edit" method="post" action="/api/settings/token">
      ${d.apiToken
        ? `<label>Your API token${d.apiFromEnv ? ' <span class="opt-inline">(set via the API_TOKEN environment variable)</span>' : ''}</label>
           <div class="token-row">
             <input class="token-field" type="password" value="${escapeAttr(d.apiToken)}" readonly />
             <button type="button" class="ghost reveal">Reveal</button>
             <button type="button" class="copy" data-copy="${escapeAttr(d.apiToken)}">Copy</button>
           </div>
           <p class="hint">Send it as <code>Authorization: Bearer &lt;token&gt;</code> to <code>/api/v1</code>.</p>
           <div class="row-2">
             <button class="save" type="submit" name="action" value="regen">Regenerate</button>
             <button class="del" type="submit" name="action" value="revoke">Turn API off</button>
           </div>`
        : `<p class="hint">The HTTP API is <b>off</b>. Generate a token to turn it on, then create, list and delete links from a script.</p>
           <div class="row-2"><button class="save" type="submit" name="action" value="regen">Generate token</button></div>`}
    </form>

    <div class="section-title">Password</div>
    <form class="edit" method="post" action="/api/settings/password">
      <p class="hint">${d.passwordInApp ? 'Your dashboard password is managed here.' : 'Your password is currently the <code>SITE_PASSWORD</code> secret. Set a new one here to manage it from the dashboard instead.'}</p>
      <label>Current password</label>
      <input name="current" type="password" autocomplete="current-password" required />
      <label>New password</label>
      <input name="new" type="password" autocomplete="new-password" required />
      <label>Confirm new password</label>
      <input name="confirm" type="password" autocomplete="new-password" required />
      <div class="row-2"><button class="save" type="submit">Update password</button></div>
    </form>
  </main>`
  return layout('Settings · foogl', body)
}
