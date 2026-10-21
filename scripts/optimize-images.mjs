#!/usr/bin/env node
/**
 * One-shot image optimizer for public/uploads/.
 *
 * - Resizes any image wider than 2400px down to 2400px (keeps aspect ratio)
 * - Re-encodes JPEG at quality 82, mozjpeg
 * - Replaces the original in place
 *
 * Run: node scripts/optimize-images.mjs
 *
 * Intended as a bulk pass after dropping in a batch of photos. Originals as scraped
 * from the old site are kept untouched in _seed/images/. Going forward Gavin should
 * upload web-sized JPGs via Tina.
 */
import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import sharp from "sharp";

const ROOT = new URL("../public/uploads", import.meta.url).pathname;
const MAX_WIDTH = 2400;
const QUALITY = 82;
const SIZE_THRESHOLD_KB = 400; // skip files smaller than this; not worth touching

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

let processed = 0;
let saved = 0;

for await (const file of walk(ROOT)) {
  const ext = extname(file).toLowerCase();
  if (![".jpg", ".jpeg"].includes(ext)) continue;

  const before = (await stat(file)).size;
  if (before < SIZE_THRESHOLD_KB * 1024) continue;

  const buf = await sharp(file)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer();

  if (buf.length < before) {
    await sharp(buf).toFile(file);
    const after = (await stat(file)).size;
    const pct = ((1 - after / before) * 100).toFixed(0);
    console.log(`  ${file.replace(ROOT, ".")}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB (-${pct}%)`);
    processed++;
    saved += before - after;
  }
}

console.log(`\nDone. Optimized ${processed} files, saved ${(saved / 1024 / 1024).toFixed(1)}MB.`);
