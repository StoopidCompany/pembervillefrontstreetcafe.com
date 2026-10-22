# NAP — name, address, phone

Mismatched name/address/phone across listings is the most common reason a local business
underperforms in search. Google, Apple and Bing each compare what they already hold against
what the site says, and disagreement costs ranking.

This file is the single reference for what the site emits, and a checklist for making the
listings agree. **It is not done.** Nobody has yet compared these strings against the live
listings, which needs Gavin's logins.

## What the site emits today

Source of truth: `content/settings/site.json`, rendered into the `Restaurant` JSON-LD by
[src/layouts/Base.astro](src/layouts/Base.astro) and into the visible page by
[src/components/VisitInfo.astro](src/components/VisitInfo.astro).

| Field | Exact string |
|---|---|
| Name | `Pemberville Front Street Cafe` |
| Street | `210 E. Front St.` |
| City | `Pemberville` |
| State | `OH` |
| ZIP | `43450` |
| Phone | `419-287-7016` |
| Latitude, longitude | `41.4103148`, `-83.4593456` |
| Hours | Tue–Sat 10:30–20:00; Mon, Sun closed |
| Cuisine | `American` |
| Price range | `$$` |
| Takes reservations | not stated — omitted from the structured data |

## Where each of those came from

| Field | Source | Confidence |
|---|---|---|
| Name | The old site's own header | Certain. Note the old site also writes "Pemberville Front Street Cafe" — see below |
| Phone | The old site's contact page | Certain |
| Street, city, ZIP | OpenStreetMap node for "Pemberville Front Street Cafe", which agrees with the Facebook listing in [plan.md](plan.md) | **Two independent sources agree, but Gavin has not confirmed it** |
| Latitude, longitude | Same OpenStreetMap node | As above |
| Hours | Facebook listing. The old site's contact page says 09:00–17:00 instead | **Unresolved conflict — see COPY-REVIEW.md question 5** |
| Cuisine, price range | Inferred from the menu ($3–$25, mains $17–$24) | Reasonable, worth a glance |
| Reservations | Nothing anywhere says | Unknown, so it says nothing |

The street address appears nowhere on the old website. It is in the structured data now
because the phase needed it and two independent sources agree; it is still waiting on
Gavin. To pull it back out, blank `address.street` in `content/settings/site.json` — the
JSON-LD drops the whole `address` block automatically rather than publishing a partial one.

## Checklist — do this before launch (phase 8)

Compare **character for character**, not "close enough". `St.` vs `Street` and
`419-287-7016` vs `(419) 287-7016` are both mismatches as far as these systems care.

- [ ] Google Business Profile — name, address, phone, hours, category, website URL
- [ ] Apple Business Connect — same
- [ ] Bing Places — same
- [ ] Facebook page — same, plus the website link
- [ ] Yelp, if the listing exists
- [ ] DoorDash listing (store 37582213) — address and hours only; it is a third-party page
- [ ] Uber Eats and Grubhub listings, if they exist — same check. Their URLs also belong in
      `settings.ordering`, which is what puts the Order button in the header
- [ ] Decide **one** written form of the street (`210 E. Front St.` or `210 East Front
      Street`) and use it everywhere, including this site
- [ ] Decide **one** written form of the phone and use it everywhere
- [ ] Set the website URL in every listing to `https://pembervillefrontstreetcafe.com`
      (apex, no `www`, no trailing path)
- [ ] Add the Google Business Profile and Yelp URLs to `socials` in settings so they go into
      `sameAs` in the structured data and switch on the review-ask buttons

### Social and listing URLs — what is in settings and what is missing

| Platform | In settings | How it was established |
|---|---|---|
| Facebook | `https://www.facebook.com/663507927121014` | Linked from the old site's own pages; the page resolves to "Pemberville Front Street Cafe" |
| Instagram | `https://www.instagram.com/pembervillefrontstreetcafe` | Linked from the old site's own pages; profile confirmed (bio mentions house-churned butter and the full bar) |
| Google | **blank** | Needs the real listing URL. Fastest route: Business Profile dashboard → "Ask for reviews" → copy link, or open the listing in Maps → Share → copy link. A Maps *search* URL is not the same thing and would make the "Review us on Google" button lie |
| Yelp | **blank** | Yelp blocks automated requests (403 on every URL, existing or not), so the slug cannot be confirmed from here. Open the listing in a browser and copy the address bar |
| TikTok | **blank** | Unconfirmed. `tiktok.com/@pembervillefrontstreetcafe` returns HTTP 200, but TikTok returns 200 for handles that do not exist, so that proves nothing |
| Twitter/X | **blank** | No evidence the cafe has one |
| DoorDash | **blank** (`ordering`) | Store id 37582213 appears in plan.md from an unverified note; DoorDash also 403s automated requests |

Only verified URLs belong in settings: a wrong one would point the footer links, the
`sameAs` in the structured data and the review-ask buttons at the wrong place.

## The name question

The old site uses two names: the header says **Pemberville Front Street Cafe**, the page titles say
**Pemberville Front Street Cafe**, and the Facebook page (ID `663507927121014`, linked from
`socials.facebook`) is titled **Pemberville Front Street Cafe**. The new site uses *Pemberville Front Street Cafe* as
the business name and *Pemberville Front Street Cafe* in the header wordmark. The listings should all
carry whichever single form Gavin wants, and `businessName` in settings should match it
exactly. Worth settling at the same time as the rest of this.

## Off-site: where local ranking actually comes from

The website supports the Business Profile; it does not replace it. For "food near me" in
Wood County the local pack is drawn from the profile, so this list outranks anything in the
repo. None of it is code.

**Google Business Profile**

- [ ] **Primary category.** This single field moves more than any markup on the site.
      "Restaurant", "Cafe" and "Breakfast restaurant" compete for different queries — pick
      the one that matches what the cafe wants to be found for, then add the others as
      secondary categories.
- [ ] Every attribute filled in: service options, dining options, accessibility, parking,
      payments, "good for kids", bar on site.
- [ ] Menu link pointed at `https://pembervillefrontstreetcafe.com/menu`, order links set.
- [ ] **Photos on a cadence.** Profiles with recent photos surface more often. A phone is
      enough; interior, food, and the storefront in daylight.
- [ ] **Posts**, roughly weekly. The chef's weekly special is a natural fit and takes a
      minute.
- [ ] **Q&A seeded** with the same questions as the site FAQ, answered by the owner.
- [ ] **Reply to reviews — all 206 of them**, including the nine unhappy ones. A visible
      response rate is a trust signal, and prospective customers read the replies to 1★
      reviews more closely than the reviews themselves.
- [ ] Hours kept in step with `content/settings/site.json`, including holiday hours.

**Other surfaces**

- [ ] Apple Business Connect and Bing Places — far less contested than Google and, as far as
      we know, unclaimed.
- [ ] Review velocity: the "Review us on Google" button is built and waiting on
      `socials.google`. A card on the table or a line on the receipt does more than a
      website button ever will.

## After launch

- [ ] Submit `https://pembervillefrontstreetcafe.com/sitemap-index.xml` in Google Search
      Console and Bing Webmaster Tools
- [ ] Run the live site through the Rich Results Test and the Schema Markup Validator
      (see the SEO section of [README.md](README.md) for what has already been checked)
- [ ] Watch Search Console for 404s coming from the old GoDaddy URLs
