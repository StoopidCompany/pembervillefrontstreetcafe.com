#!/usr/bin/env node
/**
 * Build the 1200x630 link-preview cards that X, Facebook, iMessage and Slack show.
 *
 *   node scripts/build-social-cards.mjs            # only what's missing or stale
 *   node scripts/build-social-cards.mjs --force     # rebuild everything
 *
 * Reads the photo and crop chosen in the admin — `social` in content/settings/site.json for
 * the sitewide default, and `socialImage` / `socialImageFocus` on each page in
 * content/pages/*.md — and writes one card per distinct photo-and-crop pair:
 *
 *   public/social/<name>-<focus>-<hash>.jpg
 *   public/social/manifest.json      what exists, read at build time by src/lib/social.ts
 *
 * Each card is the photo cropped to 1200x630, darkened toward the bottom, with
 * public/social/wordmark.png composited over it so the card carries the cafe's name.
 *
 * The filename carries a hash of the source photo, the crop and the wordmark. That is
 * deliberate: platforms cache card images hard, so a changed photo has to produce a changed
 * URL or the old card keeps showing for days.
 *
 * Re-run after changing a card photo in the admin. The deploy workflow runs it too, so a
 * photo uploaded through Tina is correct in production without anyone remembering.
 */
import { readFile, writeFile, readdir, mkdir, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename, extname } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const PUBLIC = join(ROOT, "public");
const OUT = join(PUBLIC, "social");
const MANIFEST = join(OUT, "manifest.json");
const WORDMARK = join(OUT, "wordmark.png");

const WIDTH = 1200;
const HEIGHT = 630;
const QUALITY = 82;
const FOCUS = { top: "top", centre: "centre", bottom: "bottom" };
const FORCE = process.argv.includes("--force");

/** sharp's gravity names for our three admin choices. */
const GRAVITY = { top: "top", centre: "centre", bottom: "bottom" };

// ---------------------------------------------------------------- content

/** Enough frontmatter parsing to read a few scalar fields, as in scripts/publish-reviews.mjs. */
function frontMatter(text) {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split("\n")) {
    const pair = /^([A-Za-z0-9_]+):[ \t]*(.*)$/.exec(line);
    if (!pair) continue;
    let value = pair[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replace(/''/g, "'");
    }
    data[pair[1]] = value;
  }
  return data;
}

async function wantedCards() {
  const wanted = new Map(); // "src|focus" -> { src, focus }
  const add = (src, focus) => {
    if (!src) return;
    const key = `${src}|${FOCUS[focus] ?? "centre"}`;
    if (!wanted.has(key)) wanted.set(key, { src, focus: FOCUS[focus] ?? "centre" });
  };

  const settings = JSON.parse(await readFile(join(ROOT, "content/settings/site.json"), "utf8"));
  add(settings.social?.image, settings.social?.imageFocus);

  const dir = join(ROOT, "content/pages");
  for (const name of (await readdir(dir)).filter((n) => n.endsWith(".md"))) {
    const data = frontMatter(await readFile(join(dir, name), "utf8"));
    add(data.socialImage, data.socialImageFocus);
  }
  return [...wanted.values()];
}

// ---------------------------------------------------------------- rendering

/**
 * Darkened toward the bottom so white type stays legible over a bright photo. Pure SVG
 * gradient with no text in it, so this needs no fonts — which matters because the wordmark
 * font is a woff2 that sharp cannot see.
 */
const scrim = Buffer.from(
  `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
     <defs>
       <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0%" stop-color="#241d18" stop-opacity="0.15"/>
         <stop offset="45%" stop-color="#241d18" stop-opacity="0.35"/>
         <stop offset="100%" stop-color="#241d18" stop-opacity="0.82"/>
       </linearGradient>
     </defs>
     <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
   </svg>`,
);

async function renderCard({ src, focus }, wordmark) {
  const source = join(PUBLIC, src.replace(/^\//, ""));
  if (!existsSync(source)) return { skipped: `missing source: ${src}` };

  // Everything that can change a pixel goes into the hash — the photo, the crop, and the
  // overlay as actually prepared — so editing the scrim or the wordmark size invalidates
  // every card without anyone remembering to pass --force.
  const hash = createHash("sha1")
    .update(await readFile(source))
    .update(focus)
    .update(wordmark.resized)
    .update(wordmark.shadow)
    .update(scrim)
    .digest("hex")
    .slice(0, 8);
  const file = `${basename(src, extname(src))}-${focus}-${hash}.jpg`;
  const target = join(OUT, file);
  const entry = { file: `/social/${file}`, width: WIDTH, height: HEIGHT };

  if (!FORCE && existsSync(target)) return { entry, reused: true };

  const base = await sharp(source)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: GRAVITY[focus] })
    .toBuffer();

  const left = 56 - wordmark.pad;
  const top = HEIGHT - wordmark.height + wordmark.pad - 48;

  await sharp(base)
    .composite([
      { input: scrim, top: 0, left: 0 },
      // Twice, for density: one pass of a blurred silhouette is too weak to carry white
      // script over a bright window frame.
      { input: wordmark.shadow, left, top },
      { input: wordmark.shadow, left, top },
      { input: wordmark.resized, left, top },
    ])
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(target);

  return { entry, built: true };
}

// ---------------------------------------------------------------- main

await mkdir(OUT, { recursive: true });

if (!existsSync(WORDMARK)) {
  console.error(
    `  ${WORDMARK} is missing. Regenerate it with:\n` +
      `    node scripts/make-brand-assets.mjs --wordmark\n` +
      `  (needs a local Chrome; the file is committed so builds do not.)`,
  );
  process.exit(1);
}

/*
 * The wordmark, prepared once for every card: scaled to 42% of the card's width — which
 * keeps the script legible at the ~500px most feeds actually render a card at — and given a
 * blurred dark silhouette to sit on.
 *
 * The shadow is what makes the overlay work on an arbitrary photo. The scrim alone is not
 * enough: white script over a sunlit window frame disappears. Rather than tune the scrim per
 * photo, the type carries its own contrast.
 */
const PAD = 14; // transparent margin so the blur has somewhere to go instead of being clipped
const wordmarkBytes = await readFile(WORDMARK);
const resizedWordmark = await sharp(wordmarkBytes)
  .resize({ width: Math.round(WIDTH * 0.42) })
  .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: "#00000000" })
  .png()
  .toBuffer();
const { width: wmWidth, height: wmHeight } = await sharp(resizedWordmark).metadata();
const shadowAlpha = await sharp(resizedWordmark).extractChannel("alpha").blur(5).toBuffer();
const wordmarkShadow = await sharp({
  create: { width: wmWidth, height: wmHeight, channels: 3, background: "#241d18" },
})
  .joinChannel(shadowAlpha)
  .png()
  .toBuffer();

const wordmark = {
  resized: resizedWordmark,
  shadow: wordmarkShadow,
  height: wmHeight,
  pad: PAD,
};

const cards = await wantedCards();
const manifest = {};
let built = 0;
let reused = 0;
const skipped = [];

for (const card of cards) {
  const result = await renderCard(card, wordmark);
  if (result.skipped) {
    skipped.push(result.skipped);
    continue;
  }
  manifest[`${card.src}|${card.focus}`] = result.entry;
  if (result.built) built++;
  else reused++;
}

// Drop cards whose photo or crop is no longer referenced, so public/social does not silently
// accumulate every image anyone ever tried.
const live = new Set(Object.values(manifest).map((e) => basename(e.file)));
let pruned = 0;
for (const name of await readdir(OUT)) {
  if (!name.endsWith(".jpg") || live.has(name)) continue;
  await unlink(join(OUT, name));
  pruned++;
}

const next = `${JSON.stringify(manifest, null, 2)}\n`;
if ((await readFile(MANIFEST, "utf8").catch(() => "")) !== next) await writeFile(MANIFEST, next);

console.log(
  `${cards.length} card(s) wanted: ${built} built, ${reused} already current` +
    (pruned ? `, ${pruned} stale removed` : ""),
);
for (const entry of Object.values(manifest)) {
  const { size } = await stat(join(PUBLIC, entry.file.replace(/^\//, "")));
  console.log(`  ${entry.file}  ${(size / 1024).toFixed(0)}KB`);
}
for (const note of skipped) console.warn(`  skipped — ${note}`);
