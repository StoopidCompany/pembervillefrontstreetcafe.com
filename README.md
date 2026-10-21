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

If you script against Tina's local GraphQL API at `http://localhost:4001/graphql`, use the
generic `createDocument(collection:, relativePath:, params:)` mutation, which is what the
admin UI itself calls. The per-collection `createMenuItem` / `createMenuSection` mutations
throw `Cannot convert undefined or null to object` on @tinacms/cli 1.12.6 regardless of the
params given. Updates via `updateMenuItem` etc. are fine.

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

[`tina/config.ts`](tina/config.ts) is the source of truth;
[`src/content.config.ts`](src/content.config.ts) mirrors it as Zod schemas so bad content
fails the build instead of rendering blank.

| Type          | Storage                      | Notes                                       |
| ------------- | ---------------------------- | ------------------------------------------- |
| Site Settings | `content/settings/site.json` | Singleton. NAP, socials and opening hours   |
| Menu Sections | `content/menu-sections/*.md` | `order` + `published`. Body = section blurb |
| Menu Items    | `content/menu-items/*.md`    | `order` + `available`, `section` reference   |

Things worth knowing before changing any of it:

- **Prices are free-form strings.** The live menu uses `$16.99`, `$3`, `H $9 / F $12.99`,
  `Cup $4.99 / Bowl $7.99` and `Single $14.99 / Double $18.99`. Two-size items use
  `price`/`priceNote` for the smaller and `altPrice`/`altPriceNote` for the larger;
  `formatPrice()` in [src/lib/content.ts](src/lib/content.ts) renders both shapes. No
  number parsing anywhere — "Market price" has to keep working.
- **Hours live in one place**, `hours[]` in the settings singleton, stored 24-hour. Both
  the rendered hours list and the `openingHoursSpecification` in the JSON-LD read from it
  via `getHours()`. Days render Monday-first whatever order the rows sit in. Closed days
  are omitted from JSON-LD rather than written as `00:00`, which Google reads as open
  around the clock.
- **`section` is a Tina reference**, stored as a path (`content/menu-sections/handhelds.md`),
  so it cannot use Astro's `reference()`. `getMenu()` resolves it and throws on a dangling
  section — a typo breaks the build rather than silently dropping a dish.
- **Hiding beats deleting.** Section `published: false` hides the section and everything in
  it; item `available: false` hides one item. Both are toggles in the admin.
- Singletons carry `allowedActions: { create: false, delete: false }` so Gavin cannot
  delete his own settings file.

### Open items on the content

- Menu items seeded here are a representative subset, prices taken from the live site.
  Full transcription, descriptions and the bar list are phase 3; the `Bar Menu` section
  exists but is unpublished.
- The live menu groups sections under Breakfast / Lunch & Dinner / Bar. The model is flat
  for now — decide in phase 3 whether that grouping needs a field or is just section order.
- **Hours in `site.json` are provisional** — Tue–Sat 10:30–20:00, from the Facebook
  snippet in [plan.md](plan.md). The live site's contact page says 09:00–17:00. These
  conflict and must be confirmed by Gavin before launch. Nothing is deployed yet.
- Address, phone, email and all social URLs are blank on purpose. The JSON-LD omits the
  address entirely unless street, city, state and ZIP are all filled in — partial NAP is
  worse than none.

## Repo layout

```
content/         Content files edited via Tina
public/uploads/  Images uploaded via Tina (committed to git)
src/
  layouts/       Base layout
  lib/           Content loaders (content.ts) + hours formatting (hours.ts)
  pages/         Routes
  styles/        Global CSS + Tailwind theme tokens
tina/            Tina schema + generated files
```
