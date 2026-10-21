#!/usr/bin/env node
/**
 * Bulk-approve imported reviews, so nobody has to click through them one at a time.
 *
 *   node scripts/publish-reviews.mjs --dry-run              # show what would change
 *   node scripts/publish-reviews.mjs                        # publish 4 and 5 star
 *   node scripts/publish-reviews.mjs --min-rating 5         # only 5 star
 *   node scripts/publish-reviews.mjs --all                  # everything, warts and all
 *   node scripts/publish-reviews.mjs --exclude "Jane Doe"   # skip someone (repeatable)
 *   node scripts/publish-reviews.mjs --none                 # unpublish everything again
 *
 * Also assigns `order` by rating then recency, so the strongest, most recent reviews are
 * the ones the home page shows — it displays the first few, not all of them.
 *
 * Reviews with no rating are treated as publishable: a quote typed in by hand without
 * stars is a deliberate act, unlike an imported one.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const DIR = new URL("../content/testimonials", import.meta.url).pathname;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ALL = args.includes("--all");
const NONE = args.includes("--none");
const MIN_RATING = args.includes("--min-rating")
  ? Number(args[args.indexOf("--min-rating") + 1])
  : 4;
const EXCLUDE = args.reduce((acc, arg, i) => {
  if (arg === "--exclude" && args[i + 1]) acc.push(args[i + 1].toLowerCase());
  return acc;
}, []);

const files = (await readdir(DIR)).filter((name) => name.endsWith(".md"));
if (files.length === 0) {
  console.log("No reviews in content/testimonials/.");
  process.exit(0);
}

const entries = [];
for (const name of files) {
  const text = await readFile(join(DIR, name), "utf8");
  const field = (key) => {
    // Values may be double-quoted, single-quoted, bare, or a folded block if Tina saved it.
    const inline = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(text);
    if (!inline) return null;
    let value = inline[1].trim();
    if (/^[|>][+-]?$/.test(value)) {
      const block = new RegExp(`^${key}:[ \\t]*[|>][+-]?\\n((?:[ \\t]+.*\\n?)+)`, "m").exec(text);
      return block ? block[1].replace(/\s+/g, " ").trim() : "";
    }
    if (value.startsWith('"')) {
      try {
        return JSON.parse(value);
      } catch {
        return value.slice(1, -1);
      }
    }
    if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
    return value;
  };

  entries.push({
    name,
    text,
    author: String(field("author") ?? ""),
    rating: field("rating") === null ? null : Number(field("rating")),
    reviewedAt: String(field("reviewedAt") ?? ""),
    length: String(field("quote") ?? "").length,
    published: field("published") === "true" || field("published") === true,
  });
}

function wanted(entry) {
  if (NONE) return false;
  if (EXCLUDE.includes(entry.author.toLowerCase())) return false;
  if (ALL) return true;
  if (entry.rating === null) return true;
  return entry.rating >= MIN_RATING;
}

/*
 * Best first, then quotable, then most recent. "Quotable" means it fits on a card: the
 * five-paragraph reviews are the most flattering ones to read but they swamp the grid, so
 * they rank behind the pithy ones and end up further down the list rather than on the
 * home page.
 */
const QUOTABLE = 280;
const ranked = entries
  .filter(wanted)
  .sort(
    (a, b) =>
      (b.rating ?? 0) - (a.rating ?? 0) ||
      Number(a.length > QUOTABLE) - Number(b.length > QUOTABLE) ||
      b.reviewedAt.localeCompare(a.reviewedAt),
  );
const order = new Map(ranked.map((entry, i) => [entry.name, (i + 1) * 10]));

let published = 0;
let hidden = 0;
const changed = [];

for (const entry of entries) {
  const shouldPublish = wanted(entry);
  const newOrder = order.get(entry.name);

  let text = entry.text.replace(
    /^published:.*$/m,
    `published: ${shouldPublish}`,
  );
  if (newOrder !== undefined) {
    text = text.replace(/^order:.*$/m, `order: ${newOrder}`);
  }

  if (shouldPublish) published++;
  else hidden++;

  if (text !== entry.text) {
    changed.push(entry);
    if (!DRY_RUN) await writeFile(join(DIR, entry.name), text);
  }
}

const skipped = entries.filter((e) => !wanted(e));
console.log(
  `${published} published, ${hidden} hidden, ${changed.length} file(s) ${DRY_RUN ? "would change" : "changed"}`,
);
if (skipped.length > 0 && !NONE) {
  console.log("\nleft hidden:");
  for (const entry of skipped.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))) {
    const why = EXCLUDE.includes(entry.author.toLowerCase())
      ? "excluded"
      : `${entry.rating ?? "no"}★`;
    console.log(`  ${entry.author} — ${why}`);
  }
}
console.log(
  `\nThe home page shows the first few by order, not all of them. Re-run with --all to ` +
    `include the unhappy ones, or --none to hide everything.`,
);
if (DRY_RUN) console.log("--dry-run: nothing was written.");
