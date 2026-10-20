import { getEntry } from "astro:content";

export async function getSettings() {
  const entry = await getEntry("settings", "site");
  if (!entry) throw new Error("Site settings not found at content/settings/site.json");
  return entry.data;
}
