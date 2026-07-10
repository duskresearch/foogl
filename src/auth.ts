import type { Context, Next } from 'hono'
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie'
import type { Env } from './index'

// Auth is deliberately the simplest thing that works: ONE password (set as a
// secret), no user accounts, no database. Logging in sets a signed cookie so
// nobody can forge it. This is the same model Sink uses at 6.9k stars.

const COOKIE = 'sid'
type Ctx = Context<{ Bindings: Env }>

const isSecure = (c: Ctx) => new URL(c.req.url).protocol === 'https:'

export async function isAuthed(c: Ctx): Promise<boolean> {
  const secret = c.env.SITE_PASSWORD
  if (!secret) return false
  // The cookie is signed WITH the password, so changing the password logs
  // everyone out automatically — a nice free property.
  const v = await getSignedCookie(c, secret, COOKIE)
  return v === 'ok'
}

// Middleware: block a page or endpoint unless logged in.
export async function gate(c: Ctx, next: Next) {
  if (await isAuthed(c)) return next()
  if (c.req.path.startsWith('/api/')) return c.text('Unauthorized', 401)
  return c.redirect('/login')
}

export async function handleLogin(c: Ctx) {
  const form = await c.req.parseBody()
  const pw = String(form.password ?? '')
  const secret = c.env.SITE_PASSWORD
  if (!secret) return c.redirect('/login?error=unset')
  if (pw !== secret) return c.redirect('/login?error=wrong')
  await setSignedCookie(c, COOKIE, 'ok', secret, {
    httpOnly: true,
    secure: isSecure(c),
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return c.redirect('/')
}

export function handleLogout(c: Ctx) {
  deleteCookie(c, COOKIE, { path: '/' })
  return c.redirect('/login')
}
