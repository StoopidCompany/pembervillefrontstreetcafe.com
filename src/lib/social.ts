import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface SocialCard {
  /** Site-root-relative path, e.g. "/social/storefront-top-1a2b3c4d.jpg" */
  src: string;
  width: number;
  height: number;
  alt: string;
}

/** The three crops the admin offers, mirrored from tina/config.ts. */
export type Focus = "top" | "centre" | "bottom";

interface Entry {
  file: string;
  width: number;
  height: number;
}

/**
 * Written by scripts/build-social-cards.mjs. Read once per build, and tolerated as missing
 * the same way the photo manifest is: a fresh clone that has not run the script still
 * builds, and every page falls back to the committed og-default.jpg.
 */
const MANIFEST = join(process.cwd(), "public/social/manifest.json");

/**
 * The card used when nothing has been chosen in the admin and no generated card exists.
 * Committed at 1200x630 by scripts/make-brand-assets.mjs, so these dimensions are known
 * rather than measured.
 */
const FALLBACK: SocialCard = {
  src: "/og-default.jpg",
  width: 1200,
  height: 630,
  alt: "The Pemberville Front Street Cafe storefront on Front Street",
};

let cache: Record<string, Entry> | null = null;

function manifest(): Record<string, Entry> {
  if (cache) return cache;
  cache = existsSync(MANIFEST)
    ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, Entry>)
    : {};
  return cache;
}

interface Choice {
  image?: string | null;
  alt?: string | null;
  focus?: Focus | null;
}

/**
 * Resolve a page's sharing card: the page's own choice, else the sitewide default from Site
 * Settings, else the committed storefront card.
 *
 * A chosen image only wins if its card has actually been generated — otherwise the tag
 * would point at a photo of the wrong shape, which looks worse in a feed than the generic
 * card does. Re-run `node scripts/build-social-cards.mjs` after choosing a new photo; the
 * deploy workflow does it automatically.
 */
export function resolveSocialCard(page: Choice, site: Choice): SocialCard {
  for (const choice of [page, site]) {
    if (!choice.image) continue;
    const entry = manifest()[`${choice.image}|${choice.focus ?? "centre"}`];
    if (!entry) continue;
    return {
      src: entry.file,
      width: entry.width,
      height: entry.height,
      // An empty alt on a social card is not decorative — it is a missing description, so
      // fall through to the sitewide one and then to the generic text.
      alt: choice.alt?.trim() || site.alt?.trim() || FALLBACK.alt,
    };
  }
  return FALLBACK;
}
