#!/usr/bin/env node
/**
 * Pull Google Business Profile reviews into content/testimonials/.
 *
 *   node scripts/sync-google-reviews.mjs                      # live, writes files
 *   node scripts/sync-google-reviews.mjs --dry-run            # live, writes nothing
 *   node scripts/sync-google-reviews.mjs --fixture file.json  # no network, writes files
 *   node scripts/sync-google-reviews.mjs --fixture file.json --dry-run
 *
 * Nothing it writes is published. Every review arrives with `published: false` and waits
 * for someone to turn it on in the admin — that is the whole point of the design.
 *
 * Env (see .env.example):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   GOOGLE_LOCATION_NAME   optional, e.g. "accounts/123/locations/456" — skips discovery
 *
 * Reviews still live on the legacy v4 host; the newer split APIs never took them over.
 *   GET https://mybusiness.googleapis.com/v4/{parent=accounts/*\/locations/*}/reviews
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const TESTIMONIALS = join(ROOT, "content/testimonials");
const SETTINGS = join(ROOT, "content/settings/site.json");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FIXTURE = args[args.indexOf("--fixture") + 1] && args.includes("--fixture")
  ? args[args.indexOf("--fixture") + 1]
  : null;

const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

// ---------------------------------------------------------------- google api

async function accessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"].filter(
    (name) => !process.env[name],
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")}. Run scripts/google-oauth-setup.mjs once to get a ` +
        `refresh token, or pass --fixture to work offline.`,
    );
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Token refresh failed (${response.status}): ${body.error_description ?? body.error ?? "unknown"}. ` +
        `A revoked or expired refresh token is the usual cause — rerun google-oauth-setup.mjs.`,
    );
  }
  return body.access_token;
}

async function api(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.error?.message ?? response.statusText;
    const hint =
      response.status === 403
        ? " — a 403 here usually means the Business Profile API access request has not been " +
          "approved yet. Check the quota in Cloud Console: 0 QPM means still pending."
        : "";
    throw new Error(`${response.status} from ${url}: ${detail}${hint}`);
  }
  return body;
}

/** Resolve "accounts/{id}/locations/{id}", which is what the v4 reviews path needs. */
async function resolveLocation(token) {
  if (process.env.GOOGLE_LOCATION_NAME) return process.env.GOOGLE_LOCATION_NAME;

  const accounts = await api(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    token,
  );
  const account = accounts.accounts?.[0];
  if (!account) throw new Error("No Business Profile accounts visible to this login.");

  const locations = await api(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations` +
      `?readMask=name,title&pageSize=100`,
    token,
  );
  const found = locations.locations ?? [];
  if (found.length === 0) throw new Error(`No locations under ${account.name}.`);
  if (found.length > 1) {
    console.warn(
      `  ${found.length} locations found; using "${found[0].title}". Set GOOGLE_LOCATION_NAME ` +
        `to pick a different one:\n` +
        found.map((l) => `    ${account.name}/${l.name} — ${l.title}`).join("\n"),
    );
  }
  // v1 returns "locations/456"; v4 wants it under the account.
  return `${account.name}/${found[0].name}`;
}

async function fetchReviews(token, parent) {
  const reviews = [];
  let averageRating = null;
  let totalReviewCount = null;
  let pageToken = "";

  do {
    const url =
      `https://mybusiness.googleapis.com/v4/${parent}/reviews?pageSize=50` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const page = await api(url, token);
    reviews.push(...(page.reviews ?? []));
    averageRating = page.averageRating ?? averageRating;
    totalReviewCount = page.totalReviewCount ?? totalReviewCount;
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);

  return { reviews, averageRating, totalReviewCount };
}

// ---------------------------------------------------------------- markdown io

function scalar(raw) {
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw !== "" && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

/**
 * Enough YAML to read what this script and Tina each write. Tina re-encodes on save —
 * it turns a long double-quoted string into a folded `>-` block and dates into single
 * quotes — so both forms have to come back out the same way they went in.
 */
function parseFrontMatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) return { data: {}, body: "" };

  const data = {};
  const lines = match[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const pair = /^([A-Za-z0-9_]+):[ \t]*(.*)$/.exec(lines[i]);
    if (!pair) continue;
    const key = pair[1];
    const raw = pair[2].trim();

    if (/^[|>][+-]?$/.test(raw)) {
      const folded = raw.startsWith(">");
      const block = [];
      while (i + 1 < lines.length && (lines[i + 1].trim() === "" || /^\s/.test(lines[i + 1]))) {
        block.push(lines[++i].trim());
      }
      // Folded: single newlines become spaces, blank lines become one newline.
      // Literal: newlines are kept as written.
      data[key] = folded
        ? block
            .reduce((acc, line) => (line === "" ? `${acc}\n` : acc.endsWith("\n") || acc === "" ? acc + line : `${acc} ${line}`), "")
            .trim()
        : block.join("\n").trim();
      continue;
    }

    data[key] = scalar(raw);
  }
  return { data, body: match[2] };
}

const FIELD_ORDER = [
  "author", "quote", "source", "rating", "sourceUrl",
  "order", "published", "googleReviewId", "reviewedAt", "syncNote",
];

function serialise(data) {
  const lines = ["---"];
  for (const key of FIELD_ORDER) {
    const value = data[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "boolean" || typeof value === "number") lines.push(`${key}: ${value}`);
    else lines.push(`${key}: ${JSON.stringify(String(value))}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

/** Same words, ignoring how the YAML wrapped them. */
function sameText(a, b) {
  const flat = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  return flat(a) === flat(b);
}

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
}

function filenameFor(review, author) {
  const short = createHash("sha1").update(review.reviewId).digest("hex").slice(0, 8);
  return `google-${slug(author)}-${short}.md`;
}

// ---------------------------------------------------------------- reconcile

async function readExisting() {
  let names = [];
  try {
    names = (await readdir(TESTIMONIALS)).filter((n) => n.endsWith(".md"));
  } catch {
    throw new Error(`${TESTIMONIALS} does not exist.`);
  }
  const entries = [];
  for (const name of names) {
    const { data } = parseFrontMatter(await readFile(join(TESTIMONIALS, name), "utf8"));
    entries.push({ name, data });
  }
  return entries;
}

function mapReview(review) {
  const anonymous = review.reviewer?.isAnonymous || !review.reviewer?.displayName;
  return {
    id: review.reviewId,
    author: anonymous ? "A Google user" : review.reviewer.displayName,
    // Left exactly as Google returns it, "(Translated by Google)" preamble and all.
    // Tidying someone's words is an editorial act and belongs in the admin, not here.
    quote: (review.comment ?? "").trim(),
    rating: STARS[review.starRating] ?? null,
    reviewedAt: (review.createTime ?? "").slice(0, 10),
    updateTime: review.updateTime ?? review.createTime ?? "",
  };
}

async function reconcile({ reviews, averageRating, totalReviewCount }) {
  const existing = await readExisting();
  const changes = { created: [], updated: [], vanished: [], skipped: [], untouched: 0 };

  // Star-only ratings carry no comment. They count towards the score but make no quote.
  const usable = [];
  for (const raw of reviews) {
    const mapped = mapReview(raw);
    if (!mapped.quote) {
      changes.skipped.push(`${mapped.author} (${mapped.rating ?? "?"}★, no comment)`);
      continue;
    }
    usable.push(mapped);
  }

  const byId = new Map(
    existing.filter((e) => e.data.googleReviewId).map((e) => [e.data.googleReviewId, e]),
  );

  for (const review of usable) {
    const found = byId.get(review.id);

    if (!found) {
      const name = filenameFor({ reviewId: review.id }, review.author);
      const data = {
        author: review.author,
        quote: review.quote,
        source: "google",
        rating: review.rating,
        order: 99,
        published: false, // never auto-publish; a human approves every quote
        googleReviewId: review.id,
        reviewedAt: review.reviewedAt,
      };
      changes.created.push({ name, data, author: review.author });
      continue;
    }

    // Compare the words, not the encoding. Tina's folded YAML cannot represent every
    // newline the way this script writes it, so an exact comparison would rewrite the
    // file on every run and the two would fight forever over formatting.
    const same =
      sameText(found.data.quote, review.quote) &&
      (found.data.rating ?? null) === review.rating &&
      String(found.data.reviewedAt ?? "") === review.reviewedAt &&
      !found.data.syncNote;
    if (same) {
      changes.untouched++;
      continue;
    }

    // Refresh what Google owns; leave alone what a person decided.
    const data = {
      ...found.data,
      author: review.author,
      quote: review.quote,
      rating: review.rating,
      reviewedAt: review.reviewedAt,
      syncNote: undefined,
    };
    changes.updated.push({ name: found.name, data, author: review.author });
  }

  const liveIds = new Set(usable.map((r) => r.id));
  const today = new Date().toISOString().slice(0, 10);
  for (const entry of existing) {
    const id = entry.data.googleReviewId;
    // Hand-typed reviews (Yelp, Facebook, told-us-directly) are none of the sync's business.
    if (!id || entry.data.source !== "google") continue;
    if (liveIds.has(id)) continue;
    if (entry.data.syncNote) continue; // already flagged on an earlier run

    changes.vanished.push({
      name: entry.name,
      author: entry.data.author,
      wasPublished: entry.data.published === true,
      data: {
        ...entry.data,
        published: false,
        syncNote: `No longer on Google as of ${today}`,
      },
    });
  }

  return { changes, averageRating, totalReviewCount };
}

async function updateSummary(averageRating, totalReviewCount) {
  if (averageRating == null || totalReviewCount == null) return null;

  const raw = await readFile(SETTINGS, "utf8");
  const settings = JSON.parse(raw);
  const summary = settings.reviewsSummary ?? {};

  // If Gavin is featuring Yelp's score, these are his numbers, not Google's.
  if (summary.platform && summary.platform !== "google") {
    return `left alone (featuring ${summary.platform})`;
  }

  const rating = (Math.round(Number(averageRating) * 10) / 10).toFixed(1);
  const count = Number(totalReviewCount);
  if (summary.rating === rating && summary.count === count) return null;

  settings.reviewsSummary = { ...summary, platform: "google", rating, count };
  if (!DRY_RUN) await writeFile(SETTINGS, `${JSON.stringify(settings, null, 2)}\n`);
  return `${rating}★ from ${count} reviews`;
}

// ---------------------------------------------------------------- main

const source = FIXTURE
  ? JSON.parse(await readFile(FIXTURE, "utf8"))
  : await (async () => {
      const token = await accessToken();
      const parent = await resolveLocation(token);
      console.log(`  location: ${parent}`);
      return fetchReviews(token, parent);
    })();

const { changes, averageRating, totalReviewCount } = await reconcile({
  reviews: source.reviews ?? [],
  averageRating: source.averageRating ?? null,
  totalReviewCount: source.totalReviewCount ?? null,
});

for (const group of ["created", "updated", "vanished"]) {
  for (const item of changes[group]) {
    if (!DRY_RUN) await writeFile(join(TESTIMONIALS, item.name), serialise(item.data));
  }
}

const summaryNote = await updateSummary(averageRating, totalReviewCount);

// Report. In CI this lands in the job summary, which is where someone notices there is
// something new waiting for approval.
const lines = [];
lines.push(`${changes.created.length} new, ${changes.updated.length} updated, ${changes.vanished.length} gone from Google, ${changes.untouched} unchanged`);
if (changes.created.length > 0) {
  lines.push("", "**Waiting for approval** — turn these on in the admin to put them on the site:");
  lines.push(...changes.created.map((c) => `- ${c.author} — ${c.data.rating ?? "?"}★ (${c.name})`));
}
if (changes.updated.length > 0) {
  lines.push("", "**Updated on Google** (your published/hidden choice was kept):");
  lines.push(...changes.updated.map((c) => `- ${c.author} (${c.name})`));
}
if (changes.vanished.length > 0) {
  lines.push("", "**No longer on Google** — hidden on the site, file kept:");
  lines.push(...changes.vanished.map((c) => `- ${c.author}${c.wasPublished ? " (was live on the site)" : ""}`));
}
if (changes.skipped.length > 0) {
  lines.push("", `Skipped ${changes.skipped.length} star-only review(s) with no text: ${changes.skipped.join(", ")}`);
}
if (summaryNote) lines.push("", `Review score: ${summaryNote}`);
if (DRY_RUN) lines.push("", "_--dry-run: nothing was written._");

const report = lines.join("\n");
console.log(report);

if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, `## Google reviews\n\n${report}\n`, {
    flag: "a",
  });
}
