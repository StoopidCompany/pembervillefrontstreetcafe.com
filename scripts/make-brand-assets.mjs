#!/usr/bin/env node
/**
 * Regenerates the derived brand assets in public/ from their sources.
 *
 *   public/favicon.svg                -> favicon-32.png, apple-touch-icon.png
 *   public/uploads/photos/<hero>.jpg  -> og-default.jpg (1200x630, cropped from the top)
 *
 * Run: node scripts/make-brand-assets.mjs
 *
 * Re-run after changing the favicon or swapping the hero photo. The outputs are committed
 * so the site builds without this step.
 */
import { stat } from "node:fs/promises";
import sharp from "sharp";

const PUBLIC = new URL("../public/", import.meta.url).pathname;
const FAVICON = `${PUBLIC}favicon.svg`;
const HERO = `${PUBLIC}uploads/photos/storefront.jpg`;

const icons = [
  { out: "favicon-32.png", size: 32 },
  { out: "apple-touch-icon.png", size: 180 },
];

for (const { out, size } of icons) {
  await sharp(FAVICON, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(`${PUBLIC}${out}`);
  console.log(`  ${out}: ${size}x${size}`);
}

// The only photo of the building is portrait and the sign sits high in it, so crop from
// the top — same reasoning as the hero on the home page.
await sharp(HERO)
  .resize(1200, 630, { fit: "cover", position: "top" })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(`${PUBLIC}og-default.jpg`);
const { size } = await stat(`${PUBLIC}og-default.jpg`);
console.log(`  og-default.jpg: 1200x630, ${(size / 1024).toFixed(0)}KB`);
