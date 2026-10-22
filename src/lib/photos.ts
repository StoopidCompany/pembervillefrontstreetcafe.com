import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface PhotoMeta {
  width: number;
  height: number;
  /** Variant widths that exist on disk, smallest first. Empty for small sources. */
  widths: number[];
}

/**
 * Written by scripts/build-responsive-images.mjs. Read once per build rather than per
 * component, and tolerated as missing: a fresh clone that has not run the script still
 * builds, images just come out unoptimised.
 */
const MANIFEST = join(process.cwd(), "public/uploads/_r/manifest.json");

let cache: Record<string, PhotoMeta> | null = null;

function manifest(): Record<string, PhotoMeta> {
  if (cache) return cache;
  cache = existsSync(MANIFEST)
    ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, PhotoMeta>)
    : {};
  return cache;
}

export function getPhoto(src: string): PhotoMeta | null {
  return manifest()[src] ?? null;
}
