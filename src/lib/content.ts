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

export async function getPage(slug: "about" | "menu") {
  const entry = await getEntry("pages", slug);
  if (!entry) throw new Error(`Page not found: content/pages/${slug}.md`);
  return entry;
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

export type MenuSectionEntry = CollectionEntry<"menuSections">;
export type MenuItemEntry = CollectionEntry<"menuItems">;
