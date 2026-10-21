import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type LogoSlug =
  | "doordash"
  | "ubereats"
  | "grubhub"
  | "google"
  | "yelp"
  | "facebook";

/**
 * Third-party brand marks, which live in public/logos/ rather than in this file.
 *
 * `color` is each brand's own hex; the marks are never recoloured, only placed on cream or
 * reversed to cream on a dark button, which both platforms' brand rules allow.
 *
 * `kind` decides whether the platform's name is printed next to the mark. A wordmark
 * already says the name — printing it again reads as a stutter — whereas a symbol needs
 * the label. Anything missing from public/logos/ falls back to the name alone.
 *
 * `menuHeight` is optical, not geometric. Sizing these to the same box height makes
 * Grubhub's single-line wordmark tower over Uber Eats' stacked one; these heights give
 * them all roughly the same cap height, so no brand shouts over its neighbours.
 */
const BRANDS: Record<
  LogoSlug,
  { color: string; kind: "symbol" | "wordmark"; menuHeight: string; multicolour?: boolean }
> = {
  doordash: { color: "#FF3008", kind: "symbol", menuHeight: "h-4" },
  ubereats: { color: "#06C167", kind: "wordmark", menuHeight: "h-8" },
  grubhub: { color: "#F63440", kind: "wordmark", menuHeight: "h-3" },
  // The G is a four-colour mark and Google's rules say not to recolour it, so the file
  // keeps its own fills and nothing here tints it.
  google: { color: "#4285F4", kind: "symbol", menuHeight: "h-4", multicolour: true },
  yelp: { color: "#FF1A1A", kind: "symbol", menuHeight: "h-4" },
  facebook: { color: "#0866FF", kind: "symbol", menuHeight: "h-4" },
};

export interface Logo {
  svg: string;
  color: string;
  kind: "symbol" | "wordmark";
  menuHeight: string;
  /** True when the mark carries its own colours and must not be tinted. */
  multicolour?: boolean;
}

/** Read at build time. Returns null when the mark has not been dropped in yet. */
export function getLogo(slug: LogoSlug): Logo | null {
  const brand = BRANDS[slug];
  if (!brand) return null;
  const file = join(process.cwd(), "public", "logos", `${slug}.svg`);
  if (!existsSync(file)) return null;
  return { svg: readFileSync(file, "utf8"), ...brand };
}

export function hasLogo(slug: LogoSlug) {
  return getLogo(slug) !== null;
}
