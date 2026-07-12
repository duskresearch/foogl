import type { Context, Next } from 'hono'
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie'
import type { Env } from './index'
import { authSecret, verifyLogin, hasPassword } from './settings'

// Auth is deliberately the simplest thing that works: ONE password, no user
// accounts. Logging in sets a signed cookie so nobody can forge it. The signing
// secret is the effective password (an in-app one stored hashed in D1, or the
// SITE_PASSWORD secret) — so changing the password logs everyone out for free.

const COOKIE = 'sid'
type Ctx = Context<{ Bindings: Env }>

const cookieOpts = (c: Ctx) => ({
  httpOnly: true,
  secure: new URL(c.req.url).protocol === 'https:',
  sameSite: 'Lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
})

export async function isAuthed(c: Ctx): Promise<boolean> {
  const secret = await authSecret(c.env)
  if (!secret) return false
  const v = await getSignedCookie(c, secret, COOKIE)
  return v === 'ok'
}

// Middleware: block a page or endpoint unless logged in.
export async function gate(c: Ctx, next: Next) {
  if (await isAuthed(c)) return next()
  if (c.req.path.startsWith('/api/')) return c.text('Unauthorized', 401)
  return c.redirect('/login')
}

// Issue a fresh session cookie. Used at login and after a password change (so
// rotating the signing secret doesn't bounce the operator to the login page).
export async function issueSession(c: Ctx): Promise<boolean> {
  const secret = await authSecret(c.env)
  if (!secret) return false
  await setSignedCookie(c, COOKIE, 'ok', secret, cookieOpts(c))
  return true
}

export async function handleLogin(c: Ctx) {
  const form = await c.req.parseBody()
  const pw = String(form.password ?? '')
  if (!(await hasPassword(c.env))) return c.redirect('/login?error=unset')
  if (!(await verifyLogin(c.env, pw))) return c.redirect('/login?error=wrong')
  await issueSession(c)
  return c.redirect('/')
}

export function handleLogout(c: Ctx) {
  deleteCookie(c, COOKIE, { path: '/' })
  return c.redirect('/login')
}
