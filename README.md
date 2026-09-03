# Foogl

**A tiny, self-hosted link shortener you deploy to Cloudflare in one click.**

Short links on your own domain, a clean dashboard you'd actually enjoy using, and simple analytics, with no server to run, no Docker, and no database to provision. It lives entirely on Cloudflare's free tier.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/duskresearch/foogl)

---

## Set it up with your agent

Tell Claude Code, Cursor, or any coding agent:

> Read https://foo.gl/agent.md and set up foogl on my own Cloudflare account.
> It has every step and check; ask me only for what it says to ask.

The runbook walks the agent through the database, migrations, the password
secret, deploy, verification, and an optional custom domain, with a check
after every step. You will be asked for exactly two things: a dashboard
password and (optionally) your short domain.

## What you get

- **Create short links.** Auto-generated or your own custom slug
- **Fast redirects** at Cloudflare's edge, counted without slowing anyone down
- **Simple analytics** per link: clicks over time, plus top countries, referrers, devices and browsers. Geolocation is free from Cloudflare's edge (no MaxMind, no API token)
- **Link expiry.** Set a date and the link stops working after it (falling back to your `ROOT_URL` or a 404)
- **Targeting.** Send different visitors to different URLs with per-link rules: by **platform** (iOS → App Store, Android → Play, desktop → your site) or by **country** (US → us-site). First match wins; everyone else gets the default. Geo is free from Cloudflare's edge
- **Query passthrough.** Optionally forward `?utm_source=…` and friends from the short link straight onto the destination
- **UTM builder.** Compose `utm_*` tags onto a destination with a live preview as you type
- **301 or 302** per link: permanent (cached hard by browsers) or temporary, your call
- **Referrer hiding.** Optionally send visitors through a `no-referrer` hop so the destination can't see where they came from
- **QR code** for every link, ready to download
- **Social previews.** Set a title, description and image so shared links look right on Twitter, Slack, Discord, etc.
- **CSV export.** Download all your links, or one link's full clickstream, any time. Your data, no lock-in
- **HTTP API.** Create, list and delete links from a script or another app (opt-in with a token). See [below](#http-api)
- **Installable.** The dashboard is a PWA, so you can add it to your phone's home screen and it works like an app
- **One password** protects your dashboard. No accounts, no user table
- **Your domain.** Point `go.yourbrand.com` at it and you're done
- **Bring nothing.** Cloudflare Workers + D1 (SQLite), no build step, no Redis, no Postgres

It deliberately does *less* than the big shorteners. No teams, no affiliate programs, no A/B tests. Just the short-link loop, done well.

## Deploy it (one click)

Clicking **Deploy to Cloudflare** hands the whole setup to Cloudflare. Here is exactly what happens, and the little you do.

1. **Sign in to Cloudflare.** The button takes you there. A free account is all you need.
2. **Let it connect to your GitHub.** Cloudflare copies Foogl into a brand-new repository on *your* GitHub account. That copy is yours to keep and redeploy. Authorize it when asked.
3. **Set your dashboard password.** On the single setup page there is a field for **`SITE_PASSWORD`**. This is the only thing guarding your dashboard, so make it a strong one. (The Worker name and database name are pre-filled. The defaults are fine.)
4. **Click deploy and wait a minute or two.** Cloudflare now does the rest for you: it creates your database, builds the tables (runs the migrations), and publishes the Worker. You never touch a command line.
5. **Open your dashboard.** When it finishes, Cloudflare shows your new Worker with an address like `https://foogl-abc123.your-name.workers.dev`. Click **Visit** (or find it later under *Workers &amp; Pages → your worker → Visit*). That page is your dashboard.
6. **Sign in and make your first link.** Enter the password from step 3, paste a long URL, and hit **Shorten**. It is live instantly at `your-worker.workers.dev/your-slug`.

That is the whole thing. No servers, no database to run, nothing to keep patched.

> **Landed on a "finish setting up" screen, or never got asked for a password?** You skipped step 3. The screen tells you how: open your Worker, go to *Settings → Variables and Secrets*, add a **Secret** named `SITE_PASSWORD`, click **Deploy**, then reload and sign in.

## Put it on your own domain

Your dashboard and links work on the `workers.dev` address right away. To run links on your own short domain, add it as a custom domain on the Worker (*Settings → Domains &amp; Routes → Add → Custom Domain*); Cloudflare provisions the DNS and SSL.

By default your short domain is **redirect-only**: `…/slug` redirects, the bare domain sends people to your `ROOT_URL`, and the dashboard is never exposed there. You reach the dashboard on the `*.workers.dev` URL, or on an **`app.` subdomain** of your short domain — add `app.go.yourbrand.com` as a second custom domain and any `app.*` host serves the dashboard. This suits a domain used only by Foogl (links on `example.com`, dashboard on `app.example.com`).

**Want everything on one host, no `app.` subdomain?** Set the `DASH_PATH` variable (e.g. `app`) and the dashboard moves onto the short domain at that path:

| Address | What it serves |
| --- | --- |
| `go.yourbrand.com/` | Your main site (`ROOT_URL`). |
| `go.yourbrand.com/slug` | The short link. |
| `go.yourbrand.com/app` | Your **dashboard** (the word you set as `DASH_PATH`). |

That path is then reserved, so pick a word you're happy not to use as a short link (change `DASH_PATH` later to free it). Avoid `login`, `settings`, `api`, and the like — those fall back to `app`.

**Prefer the dashboard on a different host entirely?** Set `DASH_HOST` to any host (e.g. `dash.yourbrand.com`), add it as a custom domain, and set `LINK_HOST` to your short domain so the dashboard shows the right short URLs. The short domain stays redirect-only. This is the clean way to avoid a nested `app.go.yourbrand.com` when your short domain is itself a subdomain.

**Good to know:** the `*.workers.dev` URL always serves the dashboard, so it is a way in even before any custom domain exists. `DASH_HOST`, `DASH_PATH` and `LINK_HOST` are set under the Worker's *Settings → Variables*.

## Set the rest from the dashboard

Signed in, the **Settings** link (top-right) runs everything else, no Cloudflare trip needed:

- **Main site** the bare domain and any mistyped link redirect to.
- **Default 301 or 302** for new links.
- **HTTP API** on or off, with a token you generate here. See [below](#http-api).
- **Password** change it whenever you like.

*(Prefer environment variables? `ROOT_URL`, `API_TOKEN` and `LINK_HOST` still work as fallbacks, set under the Worker's *Settings → Variables*. A value saved in the dashboard wins over the variable.)*

## Run it locally

```bash
git clone https://github.com/duskresearch/foogl.git
cd foogl
npm install

# create the local database tables
npm run db:migrate:local

# set a local dashboard password
cp .dev.vars.example .dev.vars      # then edit SITE_PASSWORD

npm run dev                          # http://localhost:8787
```

## Deploy from the CLI (instead of the button)

```bash
npx wrangler login
npm run db:create                    # creates the remote D1, prints a database_id
# paste that id into wrangler.jsonc under d1_databases
npm run db:migrate:remote            # apply the schema to the remote DB
npx wrangler secret put SITE_PASSWORD
npm run deploy
```

## HTTP API

The API is **off by default**. To turn it on, set an `API_TOKEN` variable (Worker → *Settings → Variables*, or `npx wrangler secret put API_TOKEN`). Use a long random value, e.g. `openssl rand -hex 24`. Every request sends it as a bearer token:

```
Authorization: Bearer <API_TOKEN>
```

Base path is `/api/v1`. All responses are JSON.

| Method   | Path                | Does                                             |
| -------- | ------------------- | ------------------------------------------------ |
| `POST`   | `/api/v1/links`     | Create a link                                    |
| `GET`    | `/api/v1/links`     | List every link                                  |
| `GET`    | `/api/v1/links/:slug` | Fetch one link (includes its click count)      |
| `DELETE` | `/api/v1/links/:slug` | Delete a link                                  |

**Create a link:**

```bash
curl -X POST https://your-worker.workers.dev/api/v1/links \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/a-very-long-link",
    "slug": "launch",           // optional, omit for a random one
    "expires_at": "2030-12-31",  // optional, YYYY-MM-DD
    "passthrough": true,         // optional, forward ?query to the destination
    "permanent": false,          // optional, true = 301, false (default) = 302
    "hide_referrer": false,      // optional, hop through a no-referrer page
    "rules": [                   // optional, targeting; first match wins
      { "type": "platform", "match": "ios",     "url": "https://apps.apple.com/app/id123" },
      { "type": "platform", "match": "android", "url": "https://play.google.com/store/apps/details?id=x" },
      { "type": "country",  "match": "US",      "url": "https://example.com/us" }
    ]
  }'
```

`rules[].type` is `platform` (match `mobile`/`desktop`/`tablet`/`ios`/`android`) or `country` (a 2-letter code). Returns the created link:

```json
{
  "slug": "launch",
  "url": "https://example.com/a-very-long-link",
  "short_url": "https://your-worker.workers.dev/launch",
  "clicks": 0,
  "created_at": "2026-07-11 21:13:15",
  "expires_at": "2030-12-31",
  "passthrough": true,
  "permanent": false,
  "hide_referrer": false,
  "rules": [ { "type": "platform", "match": "ios", "url": "https://apps.apple.com/app/id123" } ],
  "og": { "title": null, "description": null, "image": null }
}
```

Errors come back as `{ "error": "..." }` with a matching HTTP status: `401` (bad or missing token), `503` (`API_TOKEN` not set), `400` (e.g. `badurl`, `taken`, `badslug`, `badexp`), `404` (unknown slug).

## How it's built

- **[Cloudflare Workers](https://workers.cloudflare.com/)** for the runtime (edge, generous free tier)
- **[Hono](https://hono.dev/)**, a tiny, fast web framework
- **[D1](https://developers.cloudflare.com/d1/)**, Cloudflare's built-in SQLite; holds your links and clicks
- **No build step.** The dashboard is server-rendered HTML with hand-written CSS

## Forking Foogl?

The repo ships with the marketing landing page for [foo.gl](https://foo.gl), which only ever renders on the `foo.gl` host, so on your own deployment it never shows. If you want it out of your fork entirely, delete `src/landing-assets.ts` and remove the `if (hostname === 'foo.gl')` / `www.foo.gl` branch in the host-routing middleware at the top of `src/index.ts`. The shortener and dashboard are unaffected.

## License

MIT. See [LICENSE](./LICENSE) and do what you like with it.

---

<sub>Yours to run, on your own domain. Built by [Dusk Research](https://duskresearch.com).</sub>
