# foogl

**A tiny, self-hosted link shortener you deploy to Cloudflare in one click.**

Short links on your own domain, a clean dashboard you'd actually enjoy using, and simple analytics — with no server to run, no Docker, and no database to provision. It lives entirely on Cloudflare's free tier.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ekpani/foogl)

---

## What you get

- **Create short links** — auto-generated or your own custom slug
- **Fast redirects** at Cloudflare's edge, counted without slowing anyone down
- **Simple analytics** per link — clicks over time, plus top countries, referrers, devices and browsers. Geolocation is free from Cloudflare's edge (no MaxMind, no API token)
- **QR code** for every link, ready to download
- **Social previews** — set a title, description and image so shared links look right on Twitter, Slack, Discord, etc.
- **One password** protects your dashboard. No accounts, no user table
- **Your domain** — point `go.yourbrand.com` at it and you're done
- **Bring nothing** — Cloudflare Workers + D1 (SQLite), no build step, no Redis, no Postgres

It deliberately does *less* than the big shorteners. No teams, no affiliate programs, no A/B tests. Just the short-link loop, done well.

## Deploy it (the one-click way)

1. Click **Deploy to Cloudflare** above.
2. Authorize your Cloudflare account. It forks this repo, creates your database, and deploys — all automatically.
3. When prompted, set a **`SITE_PASSWORD`**. That's the only thing standing between the public and your dashboard, so make it a good one.
4. Open your new `*.workers.dev` URL, sign in, and make your first link.
5. **Add your own domain** (optional): in the Cloudflare dashboard, open your Worker → *Settings* → *Domains & Routes* → add a custom domain like `go.yourbrand.com`.

That's it. No servers to patch, nothing to keep running.

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

## How it's built

- **[Cloudflare Workers](https://workers.cloudflare.com/)** — the runtime (edge, generous free tier)
- **[Hono](https://hono.dev/)** — a tiny, fast web framework
- **[D1](https://developers.cloudflare.com/d1/)** — Cloudflare's built-in SQLite; holds your links and clicks
- **No build step** — the dashboard is server-rendered HTML with hand-written CSS

## License

MIT — see [LICENSE](./LICENSE). Do what you like with it.

---

<sub>The name's a wink at goo.gl. The rest is yours to run. Built by [Ekpani](https://ekpani.com).</sub>
