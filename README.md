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
| About page    | `content/pages/about.md`     | Singleton. Body = the story                 |
| Menu page     | `content/pages/menu.md`      | Singleton. Headline + intro above the menu  |
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
- **Item filenames are section-prefixed** (`sides-german-potato-cakes.md`) because item
  names repeat across sections — German Potato Cakes is both an à la carte breakfast item
  and a side, at different prices. Tina names new files after the title, so watch for
  collisions when adding an item that already exists elsewhere on the menu.

## Migrating the old site

`_seed/` holds the old GoDaddy site exactly as it was scraped on 21 Oct 2026, for reference
only. It is excluded from the TypeScript build and never read at runtime.

```
_seed/raw/*.html        the six live pages, verbatim
_seed/text/*.txt        the same pages stripped to readable text
_seed/images/           the two photos the live site had, as served
_seed/image-urls.txt    where they came from, and what they are
_seed/extract.py        raw/*.html -> text/*.txt
_seed/build-content.py  text/menu.txt -> content/menu-sections + content/menu-items
_seed/verify-content.py checks content/ back against text/menu.txt, item by item
```

The menu was parsed out of the scrape rather than retyped, so prices and descriptions
can't drift from the source. To re-check the transcription at any time:

```bash
python3 -I _seed/verify-content.py .
```

It compares all 51 items by name, price and description and exits non-zero on any
difference. Hand edits to `content/menu-items/` will show up there as expected drift once
Gavin starts changing prices — at that point the check has done its job and can go.

### What the old site actually had

- The full menu: 51 items across 11 sections, all with prices, most with descriptions.
- A good four-paragraph About story, migrated verbatim.
- A bar menu that is **categories only** — Wine, Cocktails, Bourbon, Rye and so on, with no
  drinks and no prices. Transcribed into the `bar` section body and left unpublished.
- **Two photos in total**: the storefront (which the site also used as its logo) and a
  ribeye at the bar. The Gallery page has zero `<img>` tags. Both photos are
  GoDaddy-compressed copies, not originals.
- No street address anywhere on the site. Phone `419-287-7016` is on the contact page.
- A Reviews page with a heading and no reviews under it.
- Every page served the entire menu, which is why the old site reads as duplicate content.

### Open items on the content

- [COPY-REVIEW.md](COPY-REVIEW.md) is the list for Gavin: five copy fixes already applied,
  and the questions that need his answer. **All of it is pending his sign-off**, including
  whether the prices are current at all.
- **Hours in `site.json` are provisional** — Tue–Sat 10:30–20:00, from the Facebook
  snippet in [plan.md](plan.md). The live site's contact page says 09:00–17:00, and the
  cafe serves breakfast, which fits neither. Must be confirmed before launch. Nothing is
  deployed yet.
- Street address, email and all social URLs are still blank. The JSON-LD omits the address
  entirely unless street, city, state and ZIP are all filled in — partial NAP is worse
  than none.
- Home page copy ("Made From Scratch and handled with Care.", "Join us and discover what we
  can do for you.") is recorded in `_seed/text/home.txt` but has no home in the content
  model yet — phase 4 builds the home page and should pull it from there.
- The old menu groups sections under Breakfast / Lunch & Dinner / Bar. The model stays flat;
  section `order` already produces the same reading order, so grouping is a phase 4 layout
  decision, not a content one.
- Photos: two is not enough for the design phase. Chased in COPY-REVIEW.md.

## Bulk image optimization

After dropping a batch of photos into `public/uploads/`:

```bash
node scripts/optimize-images.mjs
```

Resizes to 2400px max width and re-encodes JPEGs at quality 82 with mozjpeg, in place,
skipping anything under 400KB. The two scraped photos gained only ~2% — GoDaddy's CDN had
already compressed them — so the originals from Gavin will benefit more than these did.

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
scripts/         One-shot maintenance scripts
_seed/           The old GoDaddy site as scraped (reference only)
COPY-REVIEW.md   Copy changes and open questions for Gavin
```
