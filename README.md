# pembervillefrontstreetcafe.com

The site for [Pemberville Front Street Cafe](https://pembervillefrontstreetcafe.com), Pemberville, Ohio.
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
stays the canonical host: `site:` in [astro.config.mjs](astro.config.mjs) and the sitemap URL
in [public/robots.txt](public/robots.txt) both agree on the apex.

There is **no `public/CNAME` file**, deliberately. GitHub's docs are explicit that with
Actions publishing "no `CNAME` file is created, and any existing `CNAME` file is ignored and
is not required" — the custom domain lives in the repository's Pages settings instead. The
reference repo's `public/CNAME` is for branch-based publishing, which this project does not
use.

## Deploying

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds and publishes to GitHub
Pages. **Manual trigger only** (`workflow_dispatch`) so a content edit cannot publish before
anyone has looked at it; the `push` trigger is written but commented out, to be enabled after
the DNS cutover.

Repository settings → Pages → Source must be **GitHub Actions**, not a branch.

Secrets it reads, all optional — the build succeeds without any of them:

| Secret | Without it |
|---|---|
| `TINA_CLIENT_ID`, `TINA_TOKEN` | The Tina admin build is **skipped entirely**, so `/admin` does not exist. The site itself is unaffected |
| `WEB3FORMS_KEY` | The contact form renders its "not switched on yet" notice and posts nothing |
| `GA4_ID` | No analytics script at all |

`npx astro check` runs before the artifact is uploaded, so a type error stops a deploy rather
than landing on the live site.

Two memory notes, both measured rather than guessed, because the first deploy died with
"JavaScript heap out of memory":

- **`public` is excluded in [tsconfig.json](tsconfig.json).** It holds no TypeScript, but
  `include: ["**/*"]` made the compiler enumerate all 200 files in it — mostly generated
  image variants — and that pushed `astro check` from 663MB to **4.4GB**, over a runner's
  default heap. The responsive-image work is what tipped it over, which is why this only
  started failing recently.
- **`tinacms build` gets `--max-old-space-size=4096`.** It OOMs at a 1GB heap and passes at
  2GB, close enough to a runner's default to be worth stating outright.

`public/.nojekyll` is insurance only. Actions-based Pages does not run Jekyll, but if anyone
ever switches to branch publishing, Jekyll would silently strip `_astro/` and `uploads/_r/`
— which is to say, every stylesheet and every responsive image.

### Verifying before the DNS flip

GitHub serves a configured custom domain from its own edge regardless of where DNS points,
so the deployed site can be checked on its real hostname **before** the registrar is
touched:

```bash
curl -sS -k --resolve pembervillefrontstreetcafe.com:443:185.199.108.153 \
  https://pembervillefrontstreetcafe.com/menu | head -20
```

`-k` is needed only because the TLS certificate cannot be issued until DNS resolves.

## Content model

[`tina/config.ts`](tina/config.ts) is the source of truth;
[`src/content.config.ts`](src/content.config.ts) mirrors it as Zod schemas so bad content
fails the build instead of rendering blank.

| Type          | Storage                      | Notes                                       |
| ------------- | ---------------------------- | ------------------------------------------- |
| Site Settings | `content/settings/site.json` | Singleton. NAP, socials and opening hours   |
| Home page     | `content/pages/home.md`      | Singleton. Hero, intro, signature dishes    |
| Menu page     | `content/pages/menu.md`      | Singleton. Headline + intro above the menu  |
| About page    | `content/pages/about.md`     | Singleton. Body = the story, plus a photo   |
| Gallery page  | `content/pages/gallery.md`   | Singleton. Photo list with alt text         |
| Contact page  | `content/pages/contact.md`   | Singleton. Intro + what the map looks up    |
| Menu Sections | `content/menu-sections/*.md` | `order` + `published`. Body = section blurb |
| Menu Items    | `content/menu-items/*.md`    | `order` + `available`, `section` reference   |
| Guest Reviews | `content/testimonials/*.md`  | `order` + `published`. Google sync writes here |

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

## Design

The entire brand surface is [src/styles/global.css](src/styles/global.css): six colour
tokens and two fonts. Change them there and the whole site follows.

| Token | Value | Role |
|---|---|---|
| `--color-cream` | `#fbf7f0` | Page background, warm rather than white |
| `--color-crust` | `#ead9bf` | Panels, borders, footer |
| `--color-brick` | `#a03c27` | Links, buttons, prices |
| `--color-door` | `#2c3550` | Headings, hero overlay — the navy front door |
| `--color-ink` | `#241d18` | Body text |
| `--color-ink-soft` | `#6b5f54` | Secondary text |

Display font is Bricolage Grotesque, body is Manrope — both already in use on the old site,
so the cafe still looks like itself. All text pairings clear WCAG AA on cream: brick 6.2:1,
ink-soft 5.8:1, door 11.3:1, ink 15.9:1.

**The wordmark** is a third face, Pinyon Script, used by exactly one element. It was chosen
by rendering four candidate scripts against a photo of the cafe's hanging sign; Pinyon's
engraved copperplate look is the closest to the lettering painted on it. The header stacks
it the way the sign does — "Pemberville" on one line, "Front Street Cafe" larger beneath,
"FOOD · DRINK" in small caps under that — which is also what lets the full 29-character
business name sit in the header without squeezing the type.

Two notes on it:

- It is **subset to the letters in the business name**: `public/fonts/pinyon-script-wordmark.woff2`
  is 6.5KB against 38KB for the full Latin face. Regenerate with
  `node scripts/make-brand-assets.mjs --wordmark-font` if the name ever changes — that needs
  `fonttools` and the `@fontsource/pinyon-script` package, neither of which a normal build
  or a fresh clone requires, since the font is committed.
- It is preloaded alongside the display font. Without that, the wordmark visibly flips from
  serif to script as the page loads, and it is the first thing anyone sees.

A script face is harder to read than a sans, so it is sized larger than the sans wordmark it
replaced (1.6rem rising to 2.3rem on desktop, against 1.35/2rem before) — at the old size
Pinyon's hairlines disappeared.

**Mobile is the design target.** Most of this traffic is someone on Front Street deciding
where to eat, so:

- The header carries a `tel:` **Call** button and, under it on phones only, a strip with
  today's opening hours and the town. Hours, phone and address are therefore above the fold
  on every page, not just the ones with a "Find us" card.
- `summarizeHours()` in [src/lib/hours.ts](src/lib/hours.ts) collapses the seven stored days
  into `Tue–Sat 10:30 am – 8 pm` + `Mon & Sun Closed` for the header and footer. The full
  per-day data still goes to Google in the JSON-LD.
- `/menu` leads with jump links to each section, because people arrive looking for one thing.

Routes: `/`, `/menu`, `/about`, `/gallery`, `/contact`, and `/reviews`, which redirects to
`/` via `redirects` in [astro.config.mjs](astro.config.mjs) — all six of the old site's
paths resolve. Astro emits a meta-refresh page with a canonical link for it in a static
build; phase 5 should decide whether that is the final answer for that URL.

To look at it:

```bash
npm run build && npx astro preview --port 4332
google-chrome --headless --window-size=390,844 \
  --screenshot=/tmp/home.png --user-data-dir=/tmp/chrome-prof http://localhost:4332/
```

## Guest reviews

Three touchpoints, all of which disappear completely when there is nothing to show. That
is the whole design rule here: zero reviews is a normal state for a restaurant site, not an
error, so nothing renders an empty shell and nothing throws.

| Where | What shows | When it disappears |
|---|---|---|
| Home, after the signature dishes | Up to 6 quotes + score line | No published reviews **and** no score |
| Footer strip, above the copyright | "Liked it? Tell someone" + review buttons | Both `socials.google` and `socials.yelp` empty |
| Contact, between Call and the form | Same component, "Already been in?" | Same |

- The home page shows the **first 6 published reviews by `order`**
  (`HOME_REVIEW_LIMIT` in [src/pages/index.astro](src/pages/index.astro)), not all of them —
  70 are published and a review grid that long is not a home page. The score line carries
  the rest. A long quote is also line-clamped so one essay cannot run a card away.
- **Bulk approval**: `node scripts/publish-reviews.mjs` publishes everything rated 4+ and
  assigns `order` by rating, then quotability (under ~280 characters, so pithy quotes reach
  the home page ahead of five-paragraph ones), then recency. `--dry-run` to preview,
  `--min-rating 5`, `--all` to include the unhappy ones, `--none` to hide everything,
  `--exclude "Name"` to skip someone. Running it is the human approval step; it just does
  not require 80 clicks.
- `getTestimonials()` filters on `published` and sorts by `order`, the same hide-by-flag
  pattern as menu sections and items. Unlike `getMenu()` it returns an empty array rather
  than throwing: an empty menu is a bug, no reviews yet is just Tuesday.
- The score line (`reviewsSummary` in settings) is **all or nothing** — blank out either the
  rating or the count and the whole line vanishes, the same rule the postal address follows
  in the JSON-LD. Half a statistic is worse than none.
- [ReviewAsk.astro](src/components/ReviewAsk.astro) is shaped like `VisitInfo.astro`:
  settings-driven, `heading` prop, caller supplies the background. It renders nothing at all
  until at least one listing URL exists, so a review box never appears with no link in it.
- Google reviews arrive via the sync below, unpublished until approved. Yelp and Facebook
  quotes are **typed out by hand**: Yelp's terms restrict reproducing review text outside
  their own widget.
- The platform is shown by [SourceBadge.astro](src/components/SourceBadge.astro), which
  looks for a mark at `public/logos/{google,yelp,facebook}.svg` and falls back to a plain
  text label when one is missing. `google.svg` is the **official four-colour G**, taken from
  Google's own `gstatic.com` asset and kept at its original fills — `multicolour: true` in
  [logos.ts](src/lib/logos.ts) stops `BrandGlyph` tinting it, because Google's rules say the
  G is not to be recoloured. `yelp.svg` and `facebook.svg` are still absent; drop them in
  from each platform's brand page and they appear with no code change.
- **Reviewer photos** are Google's, hotlinked rather than copied into the repo. The sync
  rewrites the URL's size spec to `=s96-c-rw`, which returns a ~3KB WebP instead of the
  ~30KB PNG the old site used. They are `loading="lazy"` with `referrerpolicy="no-referrer"`,
  and the reviewer's initial is rendered *behind* the photo so a URL that rots degrades to a
  lettered circle rather than a broken image. Clearing `avatar` on a review does the same.
  Self-hosting them would mean keeping 80 strangers' profile pictures in git and re-fetching
  them whenever someone changes their picture; hotlinking avoids both.
- About is deliberately untouched — it would only duplicate the home page.

`aggregateRating` on the `Restaurant` JSON-LD is deliberately deferred. It is worth real
SEO, but only once the numbers are real and somebody has committed to keeping them current;
a stale rating in structured data is its own problem.

### Pulling reviews from Google

`scripts/sync-google-reviews.mjs` writes Google reviews into `content/testimonials/`. It
never publishes anything: every review arrives `published: false` and waits for a human to
turn it on in the admin. Yelp stays hand-typed — their terms restrict reproducing review
text outside their own widget.

**Prerequisites, in order.** The first one has a lead time measured in days:

1. **Request access to the Business Profile APIs.** Google grants it manually. Their stated
   criteria include a verified, active profile at least 60 days old with a website attached.
   You can tell whether it came through by looking at the API quota in Cloud Console:
   **0 QPM means still pending, 300 QPM means approved.**
2. Enable all **seven** Business Profile APIs that Google's setup guide lists, in the same
   project. "Google My Business API" is the one that serves reviews (the legacy v4 host),
   and it is **invisible in the API Library until your access request is approved** — if you
   cannot find it, approval has not landed.
3. On the OAuth consent screen, **publish the app**. An external app left in "Testing"
   status is issued refresh tokens that **expire after 7 days**, which quietly breaks the
   sync a week after you set it up.
4. Create an OAuth client of type "Desktop app".
5. `GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… node scripts/google-oauth-setup.mjs`, signed
   in **as the profile owner or a manager**. It prints a refresh token.
6. Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` in `.env.local`
   and in the repository secrets. `GOOGLE_LOCATION_NAME` is optional and skips discovery.

A refresh token also dies after **six months unused**, so a sync that only ever runs
manually can go stale on its own. If the sync starts failing with a token error, rerun
step 5.

Run it from [.github/workflows/sync-reviews.yml](.github/workflows/sync-reviews.yml) — manual
only for now, with the nightly `schedule` present but commented out until the deploy pipeline
exists. The workflow builds and type-checks before committing, and writes a summary listing
what is waiting for approval.

**What it does and does not touch.** This writes into content a person also edits, so the
rules matter:

| Situation | What happens |
|---|---|
| New review with text | New file, `published: false`, `order: 99` |
| Review edited on Google | Text, rating and date refreshed; **your published/hidden choice and `order` are kept** |
| Review gone from Google | Unpublished, `syncNote` added, file kept, flagged in the summary |
| Star-only review, no text | Skipped — it would be an empty quote. Still counts in the score |
| Anonymous reviewer | Author becomes "A Google user" |
| Hand-typed Yelp/Facebook review | Never touched; the sync only looks at `source: google` |
| Google review already here by hand, no `googleReviewId` | **Adopted**, not duplicated: the ID is stamped on the existing file and your approval is kept. Matched on the words |
| `reviewsSummary.platform` is `yelp` | Rating and count left alone — those are your numbers |

Matching is on `googleReviewId`, never on filename or author — except for the adoption
case above, which is what makes it safe to type reviews in by hand now and switch the API
on later without ending up with two of everything. Change detection compares the
**words**, ignoring YAML formatting, because Tina re-encodes files when it saves them — an
exact comparison made the two fight over quote formatting on every run.

Two honest limitations. Google's API returns no public URL for an individual review — only
`reviewReplyUrl`, which is the owner's reply screen — so a synced review links to the
listing as a whole, which is what every review widget does. And Tina can't filter a
collection by a field, so there's no "pending" view in the admin — find new reviews from the
workflow summary.

`getReviewLink()` in [src/lib/content.ts](src/lib/content.ts) resolves where a card points,
in order: that review's own `sourceUrl` if someone has pasted a real permalink into it, then
the platform URL from `socials`, then — for Google only — a Maps search for the business by
name and address. That last one uses the documented Maps URL API, the same call behind "Get
directions", so it cannot point somewhere wrong the way an unverified listing ID could. The
badge's tooltip says "Read this review on Google" only when the link really is that one
review; otherwise "See our reviews on Google".

**Importing without API access**, which is where the reviews in `content/testimonials/`
actually came from. The old GoDaddy site's reviews widget receives the same Google data, so:

1. Open the old site's `/reviews` page with DevTools → Network → XHR, and reload.
2. Find the response carrying the review text and copy it.
3. Save it and run the sync against it:

```bash
node scripts/sync-google-reviews.mjs --fixture _seed/fixtures/godaddy-reviews-export.json
```

`normalise()` in the script detects that shape and maps it to the API's. Crucially the
`reviewId` values in it are **Google's real ones**, so when API access arrives the live sync
recognises every imported review instead of duplicating it. The captured export is kept at
[_seed/fixtures/godaddy-reviews-export.json](_seed/fixtures/godaddy-reviews-export.json).

That export also handed over two things worth keeping:

- `GOOGLE_LOCATION_NAME=accounts/110350157233702095324/locations/202947831027575165`, which
  skips account/location discovery once credentials exist.
- `metadata.pageId` `3320731339812246583`, which is almost certainly the Google Maps CID —
  so `https://www.google.com/maps?cid=3320731339812246583` is very likely the listing URL.
  Unconfirmed, because Maps renders in JavaScript and returns a generic shell to a fetch,
  so it is **not** in settings yet. Open it once; if it is the cafe, paste it into
  `socials.google`.

**Testing edge cases** uses a separate synthetic fixture covering an anonymous reviewer, a
star-only review with no text, and a translated one:

```bash
node scripts/sync-google-reviews.mjs --fixture _seed/fixtures/google-reviews-sample.json --dry-run
```

Delete anything that fixture writes — invented reviews must never be committed.

## Order online

`settings.ordering` holds DoorDash, Uber Eats and Grubhub URLs.
[OrderOnline.astro](src/components/OrderOnline.astro) renders a direct button for one
platform, or a `<details>` disclosure listing several — no JavaScript, keyboard-operable. It
appears in the header on every page (in the hours strip on phones, beside the nav on
desktop) and as the footer's "Order online" column, and **renders nothing at all** until at
least one URL is set.

The footer's columns are built from what exists: name and tagline on their own row, then
Hours, Visit, Explore, and — only when settings have them — Order online and Follow us.
`columnClass` in [Footer.astro](src/components/Footer.astro) picks the grid width to match,
so an empty `ordering` means four columns rather than five with a hole in it.
Each URL also becomes an `OrderAction` in the structured data.

The header menu shows each platform's own mark in its own colour, from
`public/logos/{doordash,ubereats,grubhub}.svg` via
[BrandGlyph.astro](src/components/BrandGlyph.astro) and [src/lib/logos.ts](src/lib/logos.ts).
Three things about those files worth knowing before touching them:

- They are **Simple Icons glyphs**, re-cropped. Simple Icons packs every mark into a 24×24
  box, which leaves the two wordmark-style ones as a thin band floating in a square and
  illegible at icon size; the committed files have tight `viewBox` values derived by
  rasterising each mark and trimming. They carry `fill="currentColor"` so the colour comes
  from CSS.
- The brand hex values in `logos.ts` are each platform's own (`#FF3008`, `#06C167`,
  `#F63440` — the last from an older Simple Icons release, since Grubhub has been dropped
  from the current dataset). The marks are never recoloured, only reversed to cream when
  they sit on the brick-coloured button.
- `menuHeight` in `logos.ts` is **optical, not geometric**. Sized to the same box height,
  Grubhub's single-line wordmark towers over Uber Eats' stacked one; those heights give
  them all roughly the same cap height. A wordmark also suppresses the printed platform
  name, because the mark already says it.

These are third-party trademarks, used to link to the cafe's own listing on each platform.
If any platform objects or changes its guidelines, delete the file and the badge degrades
to text by itself.

Making room for it on a phone meant the hours strip gave up its address slot, so the
wordmark's "Pemberville, Ohio" is now visible on mobile too. Hours, phone and the town are
still above the fold on every page; the full street address is above the fold on the home
page and the contact page.

### A build gotcha this phase turned up

`npm run build` now runs `astro build --force`, which clears the content-layer cache on
every build. Without it, Astro 5.18's glob loader does not prune an entry from
`node_modules/.astro/data-store.json` when its file is deleted between builds — so a review
deleted in the admin kept appearing on locally rebuilt pages until the cache was cleared by
hand. I reproduced it with a plain markdown file and no Tina involved. CI starts from a
clean checkout so it was never a production risk, but it made local builds lie. The build
still takes under a second.

## Contact form

[src/pages/contact.astro](src/pages/contact.astro) posts to
[Web3Forms](https://web3forms.com), which emails the submission on. No server, no database.

- The access key is read at **build time** from `PUBLIC_WEB3FORMS_KEY`, so it has to be set
  in `.env.local` locally and as a repository secret for the deploy (phase 7). Rebuilding is
  what picks up a change.
- **Submissions go to whichever inbox created the key** at web3forms.com. That inbox is the
  one decision still outstanding — see COPY-REVIEW.md. Extra recipients can be added in the
  Web3Forms dashboard rather than in this repo.
- Fields: name, email, phone, enquiry type (Catering / Private event / Large party /
  Feedback / Other), date, number of guests, message. Date and headcount are there because
  catering and private-event enquiries are useless without them.
- `botcheck` is a hidden honeypot checkbox. Humans never see it; bots tick it and Web3Forms
  drops the submission.

### Failing loudly

A broken form that silently eats enquiries is worse than no form, so there are two guards:

1. With no key set, the page renders a visible notice above the form — "This form isn't
   switched on yet", pointing the customer at the phone number, plus a line telling the
   developer which variable is missing.
2. The submit handler checks the key before going near the network. With no key it posts
   nothing, shows an error, and **leaves the typed message in the box** so nothing is lost.
   The same applies when Web3Forms rejects the request or the network fails.

### Testing it without a real key

Web3Forms refuses server-side requests, so `curl` can't exercise this; it has to be a
browser. Both response branches were checked against a local stub that returns
Web3Forms-shaped JSON:

| Case | What the visitor sees | Form contents |
|---|---|---|
| No key configured | "This form isn't switched on yet… please call the cafe instead" | kept |
| `{"success": false}` | "Sorry — we couldn't send that (Invalid Access Key)…" | kept |
| Network failure | "Sorry — we couldn't send that (Failed to fetch)…" | kept |
| `{"success": true}` | "Thank you — your message is on its way." | cleared |

In every case the page does not navigate away and the button re-enables.

**Not yet verified: that a real submission lands in the right inbox.** That needs a real
access key and Gavin's chosen address, and it is the first thing to check in phase 7.

## SEO

The old site served the entire menu on all six pages, so every page competed with every
other. The fix is per-page titles and descriptions, one structured-data entity, and no
dead URLs.

- **Titles and descriptions** are content, not code: `seoTitle` and `description` on each
  page singleton, passed to `Base`. All five pages differ; titles land between 33 and 60
  characters with the cafe name appended. Keep hours and prices out of descriptions — they
  go stale and nothing checks them.
- **One `Restaurant` entity**, in [Base.astro](src/layouts/Base.astro), carrying a stable
  `@id` of `/#restaurant`. It appears on every page, and the shared `@id` tells Google the
  pages describe one restaurant rather than five. It emits `address` as a `PostalAddress`,
  `geo`, `telephone`, `openingHoursSpecification` built from the settings hours, `hasMenu`,
  `servesCuisine`, `priceRange`, `image` and `sameAs`.
- Anything unconfirmed is **omitted rather than guessed**. `acceptsReservations` stays out
  until Gavin says yes or no, and the whole `address` block drops out unless street, city,
  state and ZIP are all filled in.
- **Old URLs**: all six of the old paths resolve — `/gallery` stays singular, deliberately
  unlike the reference site's `/galleries`, and `/reviews` is the only redirect.
- **Sitemap** lists exactly the five real pages; the `/reviews` redirect stub is excluded
  automatically, and `robots.txt` points at `sitemap-index.xml`.
- Favicon is a placeholder monogram, [public/favicon.svg](public/favicon.svg), because the
  cafe has no logo artwork. The OG image is a 1200×630 crop of the storefront photo in which
  the hanging sign is legible. Both PNG sizes and the OG crop are regenerated by
  `node scripts/make-brand-assets.mjs`.

### Pages and what each one targets

| Page | Intent it answers |
|---|---|
| `/` | branded + "scratch kitchen Pemberville" |
| `/menu` | dish and price queries, plus the full `Menu` graph |
| `/about` | the story, "since 2023", Wood County context |
| `/reviews` | "front street cafe reviews" — 70 published reviews |
| `/catering` | catering, private events, large parties |
| `/gallery` | photos |
| `/contact` | hours, address, phone, drive times from nearby towns |
| `/404` | not in the sitemap, links back to everything |

Geography is woven into real copy rather than split into town landing pages: Google treats
near-duplicate location pages as doorway pages. The drive times on `/contact` and
`/catering` were **measured with OSRM** against the cafe's coordinates — re-measure rather
than re-estimate if the address changes.

### Images

`public/` is never optimised by Astro ("Images stored in the `public/` folder are never
optimized"), and Tina uploads land there, so variants are pre-generated:

```bash
node scripts/build-responsive-images.mjs          # after adding photos
node scripts/build-responsive-images.mjs --force  # re-encode everything
```

It writes `public/uploads/_r/<name>-<width>.{webp,jpg}` plus a `manifest.json` of intrinsic
sizes, which [src/components/Photo.astro](src/components/Photo.astro) reads at build time
via [src/lib/photos.ts](src/lib/photos.ts). Quality falls as the variant grows (80 at 480px
down to 68 at 1600px) because a big hero sits behind a dark gradient where nobody can see
the difference. A photo uploaded through Tina since the last run still renders — `Photo`
falls back to a plain `<img>` — it just is not responsive until the script runs again.

### Photos on the menu — two ways, use either or both

Both exist because it is not obvious in advance which reads better, and the answer may
differ per dish.

| | Where it lives | How it renders |
|---|---|---|
| **Per dish** | `image` on a menu item | A thumbnail on `/menu` (56px on a phone, 80px above it), on the **right** of the row so dishes with and without a photo keep the same left edge. If the dish is also a home-page signature, the same photo becomes a banner on its card |
| **Per page** | `images` on the menu page singleton | A captioned grid above the menu sections. Caption each one with the dish it shows |

Neither is required. A dish with no photo renders exactly as it always did, and the page
grid disappears when the list is empty. Shipped examples: the 10 oz Ribeye has a per-dish
photo, and the menu page has two captioned ones.

Two things worth knowing:

- The home-page signature grid uses `items-start`. A card with a photo is taller, and
  stretching its neighbour to match left a large empty panel.
- **Run `node scripts/build-responsive-images.mjs` after uploading a dish photo.** The 160
  and 320px variants exist for these thumbnails — without them a 56px thumbnail would pull
  a 480px file, which on a 51-item menu is not acceptable. A photo uploaded through Tina
  still renders before the script runs, just unoptimised.

With one thumbnail and two captioned photos, `/menu` scrolled to the bottom is 227KB, 55KB
of it images.

Measured effect on the home page, headless Chrome at 390×844:

| | before | after |
|---|---|---|
| Total transferred | 851KB | **188KB** |
| Images | 705KB | **39KB** |
| LCP element | `IMG_7110.jpg`, 705KB | `IMG_7110-480.webp`, 39KB |

Desktop at 1440×900 went 857KB → 424KB.

### What has actually been checked

Google's Rich Results Test can't be driven from here, so the structured data was validated
against the real schema.org vocabulary instead: every property emitted on every built page
was checked for existence and for validity on `Restaurant` (walking the type hierarchy),
and against Google's required and recommended field lists for a local business. Result:
all properties valid, all required fields present, all recommended fields present except
`acceptsReservations`, which is deliberately absent.

Still worth pasting the live URL into the Rich Results Test and the Schema Markup Validator
after the DNS cutover, since only Google can speak for Google.

### Deliberately not done, and why

- **`aggregateRating` / `review` markup.** Google: "If the entity that's being reviewed
  controls the reviews about itself, their pages that use `LocalBusiness` or any other type
  of `Organization` structured data are ineligible for star review feature." 206 reviews at
  4.4★ earn nothing in markup. The stars in search come from the Business Profile.
- **`FAQPage` markup** — FAQ is no longer in Google's rich-results gallery. An FAQ is worth
  writing as content; the markup is not worth maintaining.
- **Town landing pages** — doorway-page risk, see above.
- **Claims the cafe has not made.** Guests describe the place as organic and farm-to-table
  (3% and 8% of 80 written reviews). The site does not say either in its own voice —
  "organic" is USDA-regulated. Those words still appear on the page, inside guest quotes,
  which is the guest speaking and is fine.

### Measurement

- `verification.google` / `verification.bing` in settings render the Search Console and Bing
  meta tags, and nothing at all when empty.
- **Titles use the full business name.** Since "Pemberville Front Street Cafe" already
  contains the town, the page-specific halves no longer repeat it — "Menu", "Our story",
  "Photos" — which keeps every title inside the ~60 characters Google shows. `shortName` in
  settings is no longer displayed anywhere; its only job now is `alternateName` in the
  structured data, so a search for the short form still matches.
- GA4 loads only when `PUBLIC_GA4_ID` is set at build time. **It sets cookies**, so if it is
  switched on, the site needs a privacy note — the old GoDaddy site had a cookie banner and
  this one does not yet.

After the DNS cutover: submit `sitemap-index.xml` in Search Console and Bing Webmaster
Tools, URL-inspect each page, run the live URL through the Rich Results Test, and watch for
404s from old GoDaddy paths.

[NAP.md](NAP.md) holds the exact name, address, phone and hours strings the site emits,
where each came from and how confident it is, plus the listings checklist. **That audit is
not done** — it needs Gavin's Google, Apple and Bing logins.

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
_seed/validate-jsonld.py checks the built JSON-LD against the schema.org vocabulary
_seed/fixtures/        synthetic API responses for testing the review sync offline
```

The JSON-LD validator needs a copy of the vocabulary:

```bash
curl -o /tmp/schemaorg.jsonld https://schema.org/version/latest/schemaorg-current-https.jsonld
npm run build && python3 -I _seed/validate-jsonld.py dist /tmp/schemaorg.jsonld
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
- A Reviews page with a heading and **no reviews**. Its GoDaddy widget config
  (`_seed/raw/reviews.html` → the `@widget/REVIEWS` props in the page's `gpub` script) has
  `sourceType: "dynamic"`, `providerType: "gmb"`, and a `manualReviews` array still holding
  GoDaddy's shipped placeholders ("Review 1", "Anonymous", rating 0). So the page was
  pointed at Google and rendered nothing — there is no stored review text to migrate.
  The same config exposed the Facebook page ID `663507927121014`, which is how
  `socials.facebook` got filled.
- Every page served the entire menu, which is why the old site reads as duplicate content.

### Open items on the content

- [COPY-REVIEW.md](COPY-REVIEW.md) is the list for Gavin: five copy fixes already applied,
  and the questions that need his answer. **All of it is pending his sign-off**, including
  whether the prices are current at all.
- **Hours in `site.json` are provisional** — Tue–Sat 10:30–20:00, from the Facebook
  snippet in [plan.md](plan.md). The live site's contact page says 09:00–17:00, and the
  cafe serves breakfast, which fits neither. Must be confirmed before launch. Nothing is
  deployed yet.
- The street address `210 E. Front St.` and the map coordinates are in settings on the
  strength of two agreeing public sources (the Facebook listing and OpenStreetMap), not
  Gavin's word. See [NAP.md](NAP.md) for the provenance and how to pull them back out.
- Email and all social URLs are still blank. Adding the Google Business Profile and Yelp
  URLs would put them in `sameAs` in the structured data.
- Home page copy ("Made From Scratch and handled with Care.", "Join us and discover what we
  can do for you.") is recorded in `_seed/text/home.txt` but has no home in the content
  model yet — phase 4 builds the home page and should pull it from there.
- The old menu groups sections under Breakfast / Lunch & Dinner / Bar. The model stays flat;
  section `order` already produces the same reading order, so grouping is a phase 4 layout
  decision, not a content one.
- Photos: two is not enough. The storefront shot carries the home hero and the gallery, and
  the bar shot carries About and the gallery — every photo on the site is doing two jobs.
  Chased in COPY-REVIEW.md.
- The contact page has no enquiry form yet; phase 6 adds it. There is a marker comment in
  [src/pages/contact.astro](src/pages/contact.astro) where it goes. A form that posts
  nowhere would be worse than the phone button that's there now.

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
public/logos/    Third-party brand marks for the order buttons and review badges
src/
  layouts/       Base layout
  lib/           Content loaders (content.ts) + hours formatting (hours.ts)
  pages/         Routes
  styles/        Global CSS + Tailwind theme tokens
tina/            Tina schema + generated files
scripts/         One-shot maintenance scripts
_seed/           The old GoDaddy site as scraped (reference only)
COPY-REVIEW.md   Copy changes and open questions for Gavin
NAP.md           Name/address/phone strings + the listings audit checklist
```
