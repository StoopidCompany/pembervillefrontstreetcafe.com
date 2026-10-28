#!/usr/bin/env node
/**
 * Generate responsive variants for everything in public/uploads/.
 *
 *   node scripts/build-responsive-images.mjs            # only what's missing or stale
 *   node scripts/build-responsive-images.mjs --force     # rebuild everything
 *
 * Astro cannot help here: "Images stored in the public/ folder are never optimized", and
 * Tina uploads land in public/uploads/. So the variants are pre-generated, and
 * src/components/Photo.astro reads the manifest this writes.
 *
 * Writes:
 *   public/uploads/_r/<path>/<name>-<width>.webp   and .jpg
 *   public/uploads/_r/manifest.json                 what exists, plus intrinsic sizes
 *
 * Re-run after adding photos. Committed output, so a plain `npm run build` needs nothing.
 */
import { readdir, stat, mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname, relative, extname, basename } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const UPLOADS = join(ROOT, "public/uploads");
const OUT = join(UPLOADS, "_r");
const MANIFEST = join(OUT, "manifest.json");

// 160 and 320 exist for menu-item thumbnails: a 64px square pulling a 480px file was
// 39KB per dish, which on a 51-item menu is not acceptable.
const WIDTHS = [160, 320, 480, 800, 1200, 1600];

/**
 * Quality falls as the variant grows. A 1600px hero is viewed at arm's length behind a
 * dark gradient, where 68 is indistinguishable from 80 and roughly half the bytes; a 480px
 * variant on a phone held close keeps the higher setting.
 */
const QUALITY = { 160: 82, 320: 82, 480: 80, 800: 78, 1200: 72, 1600: 68 };
const FORCE = process.argv.includes("--force");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "_r") continue; // never recurse into our own output
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

/** Newer than its source? Then there is nothing to do. */
async function isFresh(target, sourceMtime) {
  try {
    return (await stat(target)).mtimeMs >= sourceMtime;
  } catch {
    return false;
  }
}

const manifest = {};
let built = 0;
let originalBytes = 0;
let smallestBytes = 0;

for await (const file of walk(UPLOADS)) {
  const ext = extname(file).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(ext)) continue;

  const source = await stat(file);
  const image = sharp(file);
  const { width, height } = await image.metadata();
  if (!width || !height) continue;

  const rel = relative(UPLOADS, file);
  const key = `/uploads/${rel.split("\\").join("/")}`;
  const name = basename(rel, ext);
  const dir = join(OUT, dirname(rel));
  await mkdir(dir, { recursive: true });

  // Never upscale: a 900px-wide source gets 480 and 800 only.
  const widths = WIDTHS.filter((w) => w < width);
  if (widths.length === 0) {
    manifest[key] = { width, height, widths: [] };
    continue;
  }

  for (const w of widths) {
    const quality = QUALITY[w] ?? 75;
    for (const [format, options] of [
      ["webp", { quality }],
      ["jpg", { quality, mozjpeg: true }],
    ]) {
      const target = join(dir, `${name}-${w}.${format}`);
      if (!FORCE && (await isFresh(target, source.mtimeMs))) continue;
      const pipeline = sharp(file).resize({ width: w, withoutEnlargement: true });
      await (format === "webp" ? pipeline.webp(options) : pipeline.jpeg(options)).toFile(target);
      built++;
    }
  }

  manifest[key] = { width, height, widths };

  // Report the win on the size a phone actually downloads.
  originalBytes += source.size;
  try {
    smallestBytes += (await stat(join(dir, `${name}-${widths[0]}.webp`))).size;
  } catch {}
}

const previous = await readFile(MANIFEST, "utf8").catch(() => "");
const next = `${JSON.stringify(manifest, null, 2)}\n`;
if (previous !== next) await writeFile(MANIFEST, next);

const count = Object.keys(manifest).length;
console.log(`${count} source image(s), ${built} variant(s) ${FORCE ? "rebuilt" : "written"}`);
if (originalBytes > 0) {
  console.log(
    `smallest variant vs original: ${(smallestBytes / 1024).toFixed(0)}KB vs ` +
      `${(originalBytes / 1024).toFixed(0)}KB across ${count} images`,
  );
}
