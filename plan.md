# Front Street Cafe — site rebuild plan

Written 20 Oct 2026. Model: `~/Code/courtneyanton.com` (Astro 5 + Tailwind 4 + TinaCMS on GitHub Pages).
Target: replace `pembervillefrontstreetcafe.com`, currently GoDaddy Website Builder 8.0.
Owner: Gavin Shank (The Front Street Cafe, Pemberville OH).

## Why this stack fits

- Static output, free hosting on GitHub Pages, no server to maintain.
- TinaCMS is git-based: content is JSON/MD committed to the repo (`README.md:13`), media to
  `public/uploads` (`tina/config.ts:17-22`). Admin SPA builds to `public/admin`
  (`tina/config.ts:13-16`) and runs fine on a static host because Tina Cloud brokers auth and
  writes through the GitHub API. That's how "hosted on GitHub and still has a CMS" works.
- Every price on this site is going to change. The photography site solved the same problem
  with a `packages` collection the owner edits herself. Menu items are the same shape.

## Verified facts — reference repo

| Thing | Where |
|---|---|
| Astro 5, Tailwind 4 (vite plugin), TinaCMS 2.6, sharp | `package.json:14-24` |
| `site:` + mdx + sitemap + `image.responsiveStyles` | `astro.config.mjs:6-15` |
| Singletons use `allowedActions: {create:false, delete:false}` | `tina/config.ts:30,56,96,110` |
| Collections: galleries, packages, testimonials | `tina/config.ts:126-213` |
| Astro collections mirror Tina schema; `file()` loader + parser for settings singleton | `src/content.config.ts:9-26,101` |
| Loaders throw on missing content | `src/lib/content.ts:3-13` |
| JSON-LD `LocalBusiness` generated from settings | `src/layouts/Base.astro:32-44` |
| Web3Forms: hidden access_key, `botcheck` honeypot, JS intercept, degrades with warning | `src/pages/contact.astro:22-31,99-103,136-162` |
| Deploy manual-only until DNS cutover; push trigger commented out | `.github/workflows/deploy.yml:3-8` |
| 3 CI secrets: TINA_TOKEN, TINA_CLIENT_ID, WEB3FORMS_KEY | `.github/workflows/deploy.yml:35-41` |
| Custom domain via `public/CNAME` | `public/CNAME:1` |
| Whole brand = 6 colours + 2 fonts in `@theme` | `src/styles/global.css:3-13` |
| `~/*` → `src/*` | `tsconfig.json:7-9` |
| Bulk image optimiser, 2400px q82 mozjpeg | `README.md:60-68` |
| `_seed/` = scraped content from the previous live site | `README.md:83` |
| Non-technical editor guide exists and is good | `ONBOARDING.md` |

## Verified facts — current live site

- Generator: `Go Daddy Website Builder 8.0.0000` (meta generator tag).
- Pages: `/`, `/menu`, `/gallery`, `/reviews`, `/contact`, `/about` (`sitemap.website.xml`).
- Second sitemap `sitemap.ols.xml` exists but returns **HTTP 401** — GoDaddy Online Store.
  Whether ordering/store is actually configured is UNVERIFIED.
- theme-color `#2b3063` (navy). Logo: `img1.wsimg.com/isteam/ip/948d1a97-3d79-49c3-a882-485fa8245bc8/blob-a0a5c77.png`.
- Fonts in use: Bricolage Grotesque, Manrope, Montserrat (body class).
- Pages serve near-identical full-site text — menu dumped onto every page. Bad for SEO.
- Opened **27 Sept 2023**, historic brick building on Front Street. "True scratch kitchen",
  nut-oil free, bakes own bread, churns own butter, beef-tallow fries. Signatures named on
  /about: Italian Grinder, Fettuccine Alfredo, 10oz Ribeye, Peppercorn Pork Chop.
- Full menu with prices + bar/wine/whiskey/cocktail/mocktail lists already written.
- Copy errors live: "We have are own Blend sugar cane soda's", stray ". ." after "nut-oil free".

## CONFLICT to resolve before launch

- Site `/contact`: "Open today | 09:00 am – 05:00 pm".
- Facebook search snippet: "Tuesday–Saturday | 10:30 AM–8 PM".
These disagree. Hours must come from Gavin, once, and then live in one place.

## Unverified / needs Gavin

1. 210 E. Front St., Pemberville, OH 43450 and (419) 287-7016 — from a Facebook search
   snippet only. Confirm before they go into JSON-LD.
2. Real hours (see conflict).
3. Who owns the domain registration and where DNS is hosted. Assumed GoDaddy, not checked.
4. Whether any email (@pembervillefrontstreetcafe.com) runs on that GoDaddy plan. If yes,
   cancelling the builder subscription could kill mail. Check MX before touching anything.
5. Is the GoDaddy Online Store live / taking orders? (the 401 sitemap)
6. DoorDash listing exists (store 37582213) — is it the only delivery channel, and should
   the site link to it?
7. Tina Cloud seat limits/pricing on the free tier — how many editors (Gavin, chef, Jason?)
   Not verified; check before promising logins.
8. Logo source file. The only copy I can see is a GoDaddy-hosted PNG blob.

## Phases

0. `chore/inventory` — credentials + facts, no code.
1. `scaffold/astro-tina` — clone the reference skeleton, prove `dev` + `dev:cms` run.
2. `content-model/menu` — menu sections/items, hours, settings. The real work.
3. `content/migrate-live-site` — scrape to `_seed/`, transcribe, copy-edit, photos.
4. `design/brand` — theme tokens, layout, pages at parity with old URLs.
5. `seo/local-business` — Restaurant JSON-LD, per-page meta, redirect stubs for old paths.
6. `forms/contact` — Web3Forms, catering/private-event enquiry.
7. `ci/pages-deploy` — Actions, Tina Cloud prod, secrets.
8. `launch/dns-cutover` — CNAME, DNS flip, verify, then decommission GoDaddy.
9. `docs/onboarding` — Gavin's editor guide, modelled on `ONBOARDING.md`.
10. `content-model/reviews` — testimonial collection + review-ask, built out of order
    (before 7–9) on request. Ships dormant: needs Gavin's listing URLs and real quotes.
11. `reviews/google-sync` + ordering CTA — pull Google reviews with manual approval, source
    badges, and an Order Online button in the header. Also dormant: needs Google API
    approval, an owner OAuth grant, and the delivery URLs.

## Never cut

- Correct NAP (name/address/phone) + hours, consistent with Google/Apple/Bing listings.
- Restaurant JSON-LD with openingHoursSpecification and hasMenu.
- Working Tina admin Gavin can actually use without calling Jason.
- Keep the GoDaddy subscription paid until the new site is verified live.
- Check MX records before cancelling anything at GoDaddy.

## Cut first

Podcast hooks, events collection, reviews page, gallery page, online ordering integration.

A standalone reviews page is still cut. Phase 10 puts guest quotes on the home page instead,
which is where they do some good, and leaves `/reviews` redirecting to `/`.