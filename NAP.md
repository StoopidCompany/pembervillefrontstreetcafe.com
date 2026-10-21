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
| Name | `The Front Street Cafe` |
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
| Street, city, ZIP | OpenStreetMap node for "Front Street Cafe", which agrees with the Facebook listing in [plan.md](plan.md) | **Two independent sources agree, but Gavin has not confirmed it** |
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
      `sameAs` in the structured data

## The name question

The old site uses two names: the header says **Front Street Cafe**, the page titles say
**Pemberville Front Street Cafe**, and the Facebook page (ID `663507927121014`, linked from
`socials.facebook`) is titled **Pemberville Front Street Cafe**. The new site uses *The Front Street Cafe* as
the business name and *Front Street Cafe* in the header wordmark. The listings should all
carry whichever single form Gavin wants, and `businessName` in settings should match it
exactly. Worth settling at the same time as the rest of this.

## After launch

- [ ] Submit `https://pembervillefrontstreetcafe.com/sitemap-index.xml` in Google Search
      Console and Bing Webmaster Tools
- [ ] Run the live site through the Rich Results Test and the Schema Markup Validator
      (see the SEO section of [README.md](README.md) for what has already been checked)
- [ ] Watch Search Console for 404s coming from the old GoDaddy URLs
