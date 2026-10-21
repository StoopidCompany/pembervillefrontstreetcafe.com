import { getCollection, getEntry, type CollectionEntry } from "astro:content";
import { sortHours } from "~/lib/hours";

export async function getSettings() {
  const entry = await getEntry("settings", "site");
  if (!entry) throw new Error("Site settings not found at content/settings/site.json");
  return entry.data;
}

/** Opening hours, Monday first. One source of truth for both the page and the JSON-LD. */
export async function getHours() {
  const { hours } = await getSettings();
  return sortHours(hours);
}

export async function getPage(slug: "home" | "menu" | "about" | "gallery" | "contact") {
  const entry = await getEntry("pages", slug);
  if (!entry) throw new Error(`Page not found: content/pages/${slug}.md`);
  return entry;
}

/**
 * Resolve the home page's signature-dish references to real menu items, so a price only
 * ever lives in one file. Throws on a dangling reference, like getMenu().
 */
export async function getSignatureDishes(refs: readonly { item: string }[]) {
  if (refs.length === 0) return [];
  const items = await getCollection("menuItems");
  return refs.map(({ item }) => {
    const id = item.replace(/^content\/menu-items\//, "").replace(/\.md$/, "");
    const found = items.find((entry) => entry.id === id);
    if (!found) {
      throw new Error(`Home page signature dish references a missing menu item: ${item}`);
    }
    return found;
  });
}

/**
 * Published guest reviews in display order. Unlike getMenu(), an empty result is fine and
 * returns an empty array: a menu with no items is a bug, no reviews yet is just Tuesday.
 */
export async function getTestimonials() {
  const all = await getCollection("testimonials", ({ data }) => data.published);
  return all.sort((a, b) => a.data.order - b.data.order);
}

/** Resolve a Tina reference path (e.g. "content/menu-sections/handhelds.md") to its entry id. */
function sectionId(refPath: string) {
  return refPath.replace(/^content\/menu-sections\//, "").replace(/\.md$/, "");
}

export interface MenuSection {
  section: CollectionEntry<"menuSections">;
  items: CollectionEntry<"menuItems">[];
}

/**
 * Published sections in display order, each with its available items in display order.
 * Items pointing at a section that does not exist throw — a typo in a reference should
 * break the build, not quietly drop a dish off the menu.
 */
export async function getMenu(): Promise<MenuSection[]> {
  const allSections = await getCollection("menuSections");
  if (allSections.length === 0) {
    throw new Error("No menu sections found in content/menu-sections/");
  }

  const known = new Set(allSections.map((s) => s.id));
  const items = await getCollection("menuItems");
  for (const item of items) {
    const id = sectionId(item.data.section);
    if (!known.has(id)) {
      throw new Error(
        `Menu item "${item.id}" references a section that does not exist: ${item.data.section}`,
      );
    }
  }

  const byOrder = (a: { data: { order: number } }, b: { data: { order: number } }) =>
    a.data.order - b.data.order;

  return allSections
    .filter((section) => section.data.published)
    .sort(byOrder)
    .map((section) => ({
      section,
      items: items
        .filter((item) => item.data.available && sectionId(item.data.section) === section.id)
        .sort(byOrder),
    }));
}

/** "$8.99", or "Half $8.99 / Full $11.99" when a second size is set. */
export function formatPrice(item: CollectionEntry<"menuItems">["data"]): string {
  const label = (note: string | null | undefined, price: string) =>
    note ? `${note} ${price}` : price;
  const primary = label(item.priceNote, item.price);
  if (!item.altPrice) return primary;
  return `${primary} / ${label(item.altPriceNote, item.altPrice)}`;
}

/**
 * Delivery links in a fixed order, skipping whatever is unset. Empty until Gavin supplies
 * the URLs, which is what keeps the Order button out of the header until then.
 */
export async function getOrderingLinks() {
  const { ordering } = await getSettings();
  return [
    { label: "DoorDash", href: ordering.doordash },
    { label: "Uber Eats", href: ordering.ubereats },
    { label: "Grubhub", href: ordering.grubhub },
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));
}

/**
 * Where a review card points. There is no public per-review permalink: Google's API
 * returns only `reviewReplyUrl`, which is the owner's reply screen, so every review widget
 * in the world links to the listing instead. Order of preference:
 *
 *   1. that review's own `sourceUrl`, if someone has pasted a real permalink into it
 *   2. the platform URL in settings (`socials.google` and friends)
 *   3. for Google, a Maps search for the business by name and address — the documented
 *      Maps URL API, the same one "Get directions" uses, so it cannot point somewhere
 *      wrong the way an unverified listing ID could
 */
export async function getReviewLink(
  source: "google" | "yelp" | "facebook" | "direct",
): Promise<string | null> {
  const settings = await getSettings();
  const configured = {
    google: settings.socials.google,
    yelp: settings.socials.yelp,
    facebook: settings.socials.facebook,
    direct: null,
  }[source];
  if (configured) return configured;

  if (source !== "google") return null;
  const address = formatAddress(settings.address);
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${settings.businessName}, ${address}`,
  )}`;
}

/** "419-287-7016" -> "tel:+14192877016". Returns null when no phone is set. */
export function telHref(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return null;
  return `tel:${digits.length === 10 ? `+1${digits}` : `+${digits}`}`;
}

interface Address {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

/**
 * One line, skipping whatever is still blank — the street address is not confirmed yet,
 * so this has to read sensibly as just "Pemberville, OH".
 */
export function formatAddress(address: Address) {
  const cityLine = [address.city, address.state].filter(Boolean).join(", ");
  const tail = [cityLine, address.zip].filter(Boolean).join(" ");
  return [address.street, tail].filter(Boolean).join(", ") || null;
}

export type MenuSectionEntry = CollectionEntry<"menuSections">;
export type MenuItemEntry = CollectionEntry<"menuItems">;
