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

/*
 * The wordmark script, subset to the letters in the business name. The full Latin face is
 * 38KB for a font used by exactly one element; this is about 6.5KB. Needs fonttools:
 *
 *   python3 -m pip install fonttools brotli
 *   npm install --no-save @fontsource/pinyon-script
 *
 * Only re-run when the business name changes — public/fonts/ is committed, so a normal
 * build and a fresh clone need neither tool.
 */
const WORDMARK_TEXT = "Pemberville Front Street Cafe";
const SCRIPT_SOURCE =
  "node_modules/@fontsource/pinyon-script/files/pinyon-script-latin-400-normal.woff2";

if (process.argv.includes("--wordmark-font")) {
  const { existsSync } = await import("node:fs");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  if (!existsSync(SCRIPT_SOURCE)) {
    console.error(`\n  ${SCRIPT_SOURCE} is missing — see the comment above.`);
  } else {
    await promisify(execFile)("python3", [
      "-I", "-m", "fontTools.subset", SCRIPT_SOURCE,
      `--text=${WORDMARK_TEXT}`,
      "--flavor=woff2",
      "--layout-features=kern,liga,calt",
      `--output-file=${PUBLIC}fonts/pinyon-script-wordmark.woff2`,
    ]);
    const { size: subsetSize } = await stat(`${PUBLIC}fonts/pinyon-script-wordmark.woff2`);
    console.log(`  pinyon-script-wordmark.woff2: ${(subsetSize / 1024).toFixed(1)}KB`);
  }
}
