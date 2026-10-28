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

/*
 * public/social/wordmark.png — the white name that gets composited onto every social card.
 *
 *   node scripts/make-brand-assets.mjs --wordmark
 *
 * It has to be pre-rendered rather than drawn at card-build time: the wordmark face is a
 * woff2, which sharp's SVG text rendering cannot load, and CI has no browser. So we render
 * it once here with the browser that is already on this machine and commit the PNG.
 *
 * Only re-run if the cafe's name changes. Chrome draws the page with a transparent
 * background and sharp trims the result down to the ink.
 */
if (process.argv.includes("--wordmark")) {
  const { existsSync } = await import("node:fs");
  const { writeFile, mkdir, rm } = await import("node:fs/promises");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  const SANS = new URL(
    "../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
    import.meta.url,
  ).pathname;
  const script = `${PUBLIC}fonts/pinyon-script-wordmark.woff2`;
  const chrome = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(
    (path) => existsSync(path),
  );

  if (!chrome) {
    console.error("\n  No Chrome or Chromium found — install one, or edit the paths above.");
  } else if (!existsSync(script) || !existsSync(SANS)) {
    console.error(`\n  Need both ${script} and ${SANS} (run --wordmark-font first).`);
  } else {
    const [town, ...rest] = WORDMARK_TEXT.split(" ");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: "Script"; src: url("file://${script}") format("woff2"); }
  @font-face { font-family: "Sans"; src: url("file://${SANS}") format("woff2");
               font-weight: 100 900; }
  html, body { margin: 0; background: transparent; }
  #wm { display: inline-block; padding: 8px 10px; color: #fff; }
  .town { font-family: "Script"; font-size: 46px; line-height: 1; }
  .name { font-family: "Script"; font-size: 76px; line-height: 1.05; }
  .where { font-family: "Sans"; font-weight: 600; font-size: 20px; letter-spacing: .28em;
           text-transform: uppercase; margin-top: 10px; opacity: .92; }
</style></head><body><div id="wm">
  <div class="town">${town}</div>
  <div class="name">${rest.join(" ")}</div>
  <div class="where">Pemberville, Ohio</div>
</div></body></html>`;

    const work = join(tmpdir(), `pfsc-wordmark-${process.pid}`);
    await mkdir(work, { recursive: true });
    await writeFile(join(work, "wordmark.html"), html);
    await promisify(execFile)(chrome, [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      "--default-background-color=00000000",
      "--window-size=900,400",
      "--allow-file-access-from-files",
      `--screenshot=${join(work, "shot.png")}`,
      `file://${join(work, "wordmark.html")}`,
    ]);

    await mkdir(`${PUBLIC}social`, { recursive: true });
    // Trim the transparent margin so the card generator can place the wordmark by its ink
    // rather than by an arbitrary window size.
    const trimmed = await sharp(join(work, "shot.png")).trim({ threshold: 1 }).png().toBuffer();
    await sharp(trimmed).toFile(`${PUBLIC}social/wordmark.png`);
    await rm(work, { recursive: true, force: true });

    const meta = await sharp(`${PUBLIC}social/wordmark.png`).metadata();
    console.log(
      `  social/wordmark.png: ${meta.width}x${meta.height}, alpha=${meta.hasAlpha}` +
        (meta.hasAlpha ? "" : "  <- expected transparency, check the Chrome flags"),
    );
  }
}
