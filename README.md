# pembervillefrontstreetcafe.com

The site for [The Front Street Cafe](https://pembervillefrontstreetcafe.com), Pemberville, Ohio.
Rebuild plan and phase order: [plan.md](plan.md).

## Stack

- **[Astro 5](https://astro.build)** — static site generator
- **[Tailwind CSS v4](https://tailwindcss.com)** — utility-first styling
- **[TinaCMS](https://tina.io)** — git-based content editor at `/admin`
- Hosted on **GitHub Pages** with custom domain

All content lives in the repo under [`content/`](content/) (JSON + Markdown).
Images live in `public/uploads/` and are committed to git.

## Local development

```bash
npm install
npm run dev         # Astro only — fastest for code work
npm run dev:cms     # Astro + Tina admin (visit /admin/index.html)
npm run build       # Production build to dist/
npm run preview     # Serve the built dist/
npx astro check     # Type check
```

The Tina admin runs at `http://localhost:4321/admin/index.html` when using `dev:cms`.
No Tina Cloud credentials are required for local dev — edits write straight to the local
filesystem.

## Production environment

See [`.env.example`](.env.example):

- `PUBLIC_WEB3FORMS_KEY` — access key from web3forms.com (phase 6)
- `TINA_TOKEN` + `NEXT_PUBLIC_TINA_CLIENT_ID` — from app.tina.io, only needed when
  building the production Tina admin SPA

## Domain

**Apex, no `www`.** `pembervillefrontstreetcafe.com` is what is currently indexed, so that
stays the canonical host: `site:` in [astro.config.mjs](astro.config.mjs), the sitemap URL in
[public/robots.txt](public/robots.txt), and the `public/CNAME` written at cutover must all
agree on the apex. Apex on GitHub Pages needs four A records (or ALIAS/ANAME if the DNS host
supports it), not a CNAME — settle that during phase 8.

## Content model

[`tina/config.ts`](tina/config.ts) is the source of truth. Current state (scaffold):

| Type          | Storage                      | Notes     |
| ------------- | ---------------------------- | --------- |
| Site Settings | `content/settings/site.json` | Singleton |

Menu sections/items, hours and pages arrive in phase 2. Address, phone and hours are
deliberately blank until Gavin confirms them — see plan.md "Unverified / needs Gavin".

## Repo layout

```
content/         Content files edited via Tina
public/uploads/  Images uploaded via Tina (committed to git)
src/
  layouts/       Base layout
  lib/           Content loaders
  pages/         Routes
  styles/        Global CSS + Tailwind theme tokens
tina/            Tina schema + generated files
```
