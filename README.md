# foogl

**A tiny, self-hosted link shortener you deploy to Cloudflare in one click.**

Short links on your own domain, a clean dashboard you'd actually enjoy using, and simple analytics — with no server to run, no Docker, and no database to provision. It lives entirely on Cloudflare's free tier.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ekpani/foogl)

---

## What you get

- **Create short links** — auto-generated or your own custom slug
- **Fast redirects** at Cloudflare's edge, counted without slowing anyone down
- **Simple analytics** per link — clicks over time, plus top countries, referrers, devices and browsers. Geolocation is free from Cloudflare's edge (no MaxMind, no API token)
- **Link expiry** — set a date and the link stops working after it (falling back to your `ROOT_URL` or a 404)
- **Targeting** — send different visitors to different URLs with per-link rules: by **platform** (iOS → App Store, Android → Play, desktop → your site) or by **country** (US → us-site). First match wins; everyone else gets the default. Geo is free from Cloudflare's edge
- **Query passthrough** — optionally forward `?utm_source=…` and friends from the short link straight onto the destination
- **UTM builder** — compose `utm_*` tags onto a destination with a live preview as you type
- **301 or 302** per link — permanent (cached hard by browsers) or temporary, your call
- **Referrer hiding** — optionally send visitors through a `no-referrer` hop so the destination can't see where they came from
- **QR code** for every link, ready to download
- **Social previews** — set a title, description and image so shared links look right on Twitter, Slack, Discord, etc.
- **CSV export** — download all your links, or one link's full clickstream, any time. Your data, no lock-in
- **HTTP API** — create, list and delete links from a script or another app (opt-in with a token). See [below](#http-api)
- **Installable** — the dashboard is a PWA, so you can add it to your phone's home screen and it works like an app
- **One password** protects your dashboard. No accounts, no user table
- **Your domain** — point `go.yourbrand.com` at it and you're done
- **Bring nothing** — Cloudflare Workers + D1 (SQLite), no build step, no Redis, no Postgres

It deliberately does *less* than the big shorteners. No teams, no affiliate programs, no A/B tests. Just the short-link loop, done well.

## Deploy it

1. Click **Deploy to Cloudflare** above.
2. Authorize your Cloudflare account. It forks this repo, creates your database, and deploys, all automatically.
3. When prompted, set a **`SITE_PASSWORD`**. It is the only thing between the public and your dashboard, so make it a good one. (Skip it and foogl will show you how to set it on first open.)

### After it deploys, here is how you use it

4. Cloudflare shows your new Worker. Open its **`*.workers.dev`** URL — the *Visit* link, or find it under *Workers &amp; Pages → foogl → Visit*.
5. **Sign in** with the `SITE_PASSWORD` you set. That page is your dashboard.
6. **Make your first link:** paste a long URL, optionally type a custom slug, and hit **Shorten**. It is live instantly at `your-worker.workers.dev/your-slug`.
7. **Put it on your own domain** (recommended): in the Worker, open *Settings → Domains &amp; Routes* and add a short domain you own, like `go.yourbrand.com`. From then on your short links live there — `go.yourbrand.com/your-slug`.

That is it. No servers to patch, nothing to keep running.

### Where the dashboard lives

foogl decides what to serve by hostname, so your short domain stays clean:

- **`go.yourbrand.com`** (your short domain) → only resolves links. The root sends people to your `ROOT_URL`; `…/slug` redirects. The dashboard is **never** exposed here.
- **`app.go.yourbrand.com`** → the **dashboard** (sign in, manage links). Add it as a second custom domain and it just works — the dashboard automatically shows your links on the short domain.
- **`your-worker.workers.dev`** → also the dashboard, so you can manage links before you set up any custom domains.

So: add your short domain for the links, and `app.<that-domain>` when you want a tidy dashboard URL. Until then, the `workers.dev` URL is your dashboard.

**Optional:** set a `ROOT_URL` variable (Worker → *Settings → Variables*) to your main site. Then your short domain's root, and any mistyped link, sends people there instead of a 404.

**Optional:** set a `LINK_HOST` variable if your dashboard host and link host don't follow the `app.` convention — it forces what the dashboard shows and the QR encodes.

**Optional:** set a `LINK_HOST` variable (e.g. `go.yourbrand.com`) if you open the dashboard on one host but want to share links on another. It only changes what the dashboard shows and what the QR encodes — your links already resolve on every domain bound to the Worker.

## Run it locally

```bash
git clone https://github.com/ekpani/foogl.git
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
    "slug": "launch",           // optional — omit for a random one
    "expires_at": "2030-12-31",  // optional — YYYY-MM-DD
    "passthrough": true,         // optional — forward ?query to the destination
    "permanent": false,          // optional — true = 301, false (default) = 302
    "hide_referrer": false,      // optional — hop through a no-referrer page
    "rules": [                   // optional — targeting; first match wins
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

- **[Cloudflare Workers](https://workers.cloudflare.com/)** — the runtime (edge, generous free tier)
- **[Hono](https://hono.dev/)** — a tiny, fast web framework
- **[D1](https://developers.cloudflare.com/d1/)** — Cloudflare's built-in SQLite; holds your links and clicks
- **No build step** — the dashboard is server-rendered HTML with hand-written CSS

## License

MIT — see [LICENSE](./LICENSE). Do what you like with it.

---

<sub>The name's a wink at goo.gl. The rest is yours to run. Built by [Ekpani](https://ekpani.com).</sub>
