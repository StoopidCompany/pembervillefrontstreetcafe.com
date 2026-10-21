import { defineConfig } from "tinacms";

const branch =
  process.env.GITHUB_REF_NAME ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

const DAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

/** Times are stored 24-hour so they can go straight into JSON-LD. Display is formatted in code. */
const validateTime = (value?: string) =>
  !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? undefined
    : "Use 24-hour HH:MM — e.g. 10:30 for 10:30am, 20:00 for 8pm";

export default defineConfig({
  branch,
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",
  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },
  media: {
    tina: {
      mediaRoot: "uploads",
      publicFolder: "public",
    },
  },
  schema: {
    collections: [
      {
        name: "settings",
        label: "Site Settings",
        path: "content/settings",
        format: "json",
        ui: { allowedActions: { create: false, delete: false } },
        fields: [
          { type: "string", name: "businessName", label: "Business Name", required: true },
          { type: "string", name: "tagline", label: "Tagline / Meta Description",
            description: "Short description used in browser tabs and search results" },
          {
            type: "object", name: "address", label: "Address",
            description: "Must match the Google, Apple and Facebook listings exactly",
            fields: [
              { type: "string", name: "street", label: "Street" },
              { type: "string", name: "city", label: "City" },
              { type: "string", name: "state", label: "State", description: "Two letters — e.g. OH" },
              { type: "string", name: "zip", label: "ZIP" },
              { type: "string", name: "latitude", label: "Latitude",
                description: "Optional. Helps Google place the pin exactly — read it off Google Maps." },
              { type: "string", name: "longitude", label: "Longitude", description: "Optional." },
            ],
          },
          { type: "string", name: "phone", label: "Phone" },
          { type: "string", name: "email", label: "Email" },
          { type: "string", name: "servesCuisine", label: "Cuisine",
            description: "What Google lists the cafe as serving, e.g. 'American'" },
          {
            type: "string", name: "priceRange", label: "Price Range",
            description: "Google's shorthand for how expensive the place is",
            options: [
              { value: "$", label: "$ — under $10 a head" },
              { value: "$$", label: "$$ — $10 to $25 a head" },
              { value: "$$$", label: "$$$ — $25 to $50 a head" },
            ],
          },
          {
            type: "string", name: "acceptsReservations", label: "Takes Reservations?",
            description: "Left as 'not stated' until you confirm it — Google would rather be told nothing than told wrong",
            options: [
              { value: "unknown", label: "Not stated" },
              { value: "yes", label: "Yes, we take reservations" },
              { value: "no", label: "No, walk-ins only" },
            ],
          },
          {
            type: "object", name: "socials", label: "Social & Listing Links",
            fields: [
              { type: "string", name: "facebook", label: "Facebook URL" },
              { type: "string", name: "instagram", label: "Instagram URL" },
              { type: "string", name: "twitter", label: "Twitter/X URL" },
              { type: "string", name: "tiktok", label: "TikTok URL" },
              { type: "string", name: "google", label: "Google Business Profile URL" },
              { type: "string", name: "yelp", label: "Yelp URL" },
            ],
          },
          {
            type: "object", name: "hours", label: "Opening Hours",
            description:
              "One row per day. These feed both the hours shown on the site and the " +
              "structured data Google reads — there is nowhere else to change them.",
            list: true,
            ui: {
              itemProps: (item) => ({
                label: item?.closed
                  ? `${item?.day ?? "Day"} — closed`
                  : `${item?.day ?? "Day"} ${item?.open ?? "?"}–${item?.close ?? "?"}`,
              }),
            },
            fields: [
              { type: "string", name: "day", label: "Day", required: true, options: DAYS },
              { type: "boolean", name: "closed", label: "Closed all day" },
              { type: "string", name: "open", label: "Opens", description: "24-hour, e.g. 10:30",
                ui: { validate: validateTime } },
              { type: "string", name: "close", label: "Closes", description: "24-hour, e.g. 20:00",
                ui: { validate: validateTime } },
            ],
          },
          { type: "string", name: "footerText", label: "Footer Text",
            description: "e.g. © The Front Street Cafe 2026" },
        ],
      },
      {
        name: "home",
        label: "Home Page",
        path: "content/pages",
        format: "md",
        match: { include: "home" },
        ui: { allowedActions: { create: false, delete: false } },
        fields: [
          { type: "string", name: "seoTitle", label: "Title for Google / browser tab",
            description: "Shown in search results and the browser tab, with the cafe name added after it. Keep it under about 40 characters." },
          { type: "string", name: "description", label: "Search Description",
            description: "The sentence Google shows under the title. Aim for 150 characters, and avoid hours or prices here — they go stale.",
            ui: { component: "textarea" } },
          { type: "string", name: "headline", label: "Hero Headline", required: true },
          { type: "string", name: "heroSubtext", label: "Hero Subtext" },
          { type: "image", name: "heroImage", label: "Hero Photo" },
          { type: "rich-text", name: "body", label: "Intro", isBody: true,
            description: "The short pitch under the hero" },
          {
            type: "object", name: "signatures", label: "Signature Dishes",
            description: "Shown on the home page. Pick from the menu so the price stays in one place.",
            list: true,
            ui: {
              max: 4,
              itemProps: (item) => ({ label: item?.item || "Choose a dish" }),
            },
            fields: [
              { type: "reference", name: "item", label: "Menu Item", collections: ["menuItem"] },
            ],
          },
          { type: "string", name: "ctaText", label: "Button Text" },
          { type: "string", name: "ctaHref", label: "Button Link" },
        ],
      },
      {
        name: "gallery",
        label: "Gallery Page",
        path: "content/pages",
        format: "md",
        match: { include: "gallery" },
        ui: { allowedActions: { create: false, delete: false } },
        fields: [
          { type: "string", name: "seoTitle", label: "Title for Google / browser tab",
            description: "Shown in search results and the browser tab, with the cafe name added after it. Keep it under about 40 characters." },
          { type: "string", name: "description", label: "Search Description",
            description: "The sentence Google shows under the title. Aim for 150 characters, and avoid hours or prices here — they go stale.",
            ui: { component: "textarea" } },
          { type: "string", name: "headline", label: "Headline", required: true },
          { type: "rich-text", name: "body", label: "Intro", isBody: true },
          {
            type: "object", name: "images", label: "Photos",
            list: true,
            ui: {
              itemProps: (item) => ({ label: item?.alt || item?.image || "Photo" }),
            },
            fields: [
              { type: "image", name: "image", label: "Photo", required: true },
              { type: "string", name: "alt", label: "Describe the photo", required: true,
                description: "For people using a screen reader, and shown if the photo fails to load" },
              { type: "string", name: "caption", label: "Caption (optional)" },
            ],
          },
        ],
      },
      {
        name: "contact",
        label: "Contact Page",
        path: "content/pages",
        format: "md",
        match: { include: "contact" },
        ui: { allowedActions: { create: false, delete: false } },
        fields: [
          { type: "string", name: "seoTitle", label: "Title for Google / browser tab",
            description: "Shown in search results and the browser tab, with the cafe name added after it. Keep it under about 40 characters." },
          { type: "string", name: "description", label: "Search Description",
            description: "The sentence Google shows under the title. Aim for 150 characters, and avoid hours or prices here — they go stale.",
            ui: { component: "textarea" } },
          { type: "string", name: "headline", label: "Headline", required: true },
          { type: "rich-text", name: "body", label: "Intro", isBody: true },
          { type: "string", name: "responseTime", label: "How quickly you reply",
            description: "Shown under the form, e.g. 'We usually reply within a day'. Leave empty to show nothing." },
          { type: "string", name: "mapQuery", label: "Map Search Text",
            description: "What the embedded map should look up, e.g. 'Front Street Cafe, Pemberville, OH'" },
        ],
      },
      {
        name: "about",
        label: "About Page",
        path: "content/pages",
        format: "md",
        match: { include: "about" },
        ui: { allowedActions: { create: false, delete: false } },
        fields: [
          { type: "string", name: "seoTitle", label: "Title for Google / browser tab",
            description: "Shown in search results and the browser tab, with the cafe name added after it. Keep it under about 40 characters." },
          { type: "string", name: "description", label: "Search Description",
            description: "The sentence Google shows under the title. Aim for 150 characters, and avoid hours or prices here — they go stale.",
            ui: { component: "textarea" } },
          { type: "string", name: "headline", label: "Headline", required: true },
          { type: "image", name: "image", label: "Photo" },
          { type: "rich-text", name: "body", label: "Our Story", isBody: true, required: true },
        ],
      },
      {
        name: "menuPage",
        label: "Menu Page",
        path: "content/pages",
        format: "md",
        match: { include: "menu" },
        ui: { allowedActions: { create: false, delete: false } },
        fields: [
          { type: "string", name: "seoTitle", label: "Title for Google / browser tab",
            description: "Shown in search results and the browser tab, with the cafe name added after it. Keep it under about 40 characters." },
          { type: "string", name: "description", label: "Search Description",
            description: "The sentence Google shows under the title. Aim for 150 characters, and avoid hours or prices here — they go stale.",
            ui: { component: "textarea" } },
          { type: "string", name: "headline", label: "Headline", required: true },
          { type: "rich-text", name: "body", label: "Intro", isBody: true,
            description: "Shown above the menu sections" },
        ],
      },
      {
        name: "menuSection",
        label: "Menu Sections",
        path: "content/menu-sections",
        format: "md",
        defaultItem: () => ({ published: true, order: 99 }),
        fields: [
          { type: "string", name: "title", label: "Title", required: true, isTitle: true,
            description: "e.g. 'Handhelds' or 'Chef Plates'" },
          { type: "string", name: "slug", label: "URL Slug", required: true,
            description: "lowercase-with-dashes, e.g. 'chef-plates'" },
          { type: "rich-text", name: "description", label: "Description", isBody: true,
            description: "Optional blurb shown under the section heading" },
          { type: "number", name: "order", label: "Display Order",
            description: "Low numbers first. Leave gaps (10, 20, 30) so sections are easy to move." },
          { type: "boolean", name: "published", label: "Show on Site",
            description: "Turn off to hide the whole section and everything in it" },
        ],
      },
      {
        name: "menuItem",
        label: "Menu Items",
        path: "content/menu-items",
        format: "md",
        defaultItem: () => ({ available: true, order: 99 }),
        fields: [
          { type: "string", name: "name", label: "Item Name", required: true, isTitle: true },
          {
            type: "reference", name: "section", label: "Section", required: true,
            collections: ["menuSection"],
          },
          { type: "string", name: "description", label: "Description",
            ui: { component: "textarea" } },
          { type: "string", name: "price", label: "Price", required: true,
            description:
              "Typed exactly as it should appear — '$16.99', '$3', 'Market price'. " +
              "For two sizes, put the smaller one here and use the Second Price fields below." },
          { type: "string", name: "priceNote", label: "Price Label (optional)",
            description: "Only for two-size items — e.g. 'Half', 'Cup', 'Single'" },
          { type: "string", name: "altPrice", label: "Second Price (optional)",
            description: "e.g. '$12.99' for the full-size portion" },
          { type: "string", name: "altPriceNote", label: "Second Price Label (optional)",
            description: "e.g. 'Full', 'Bowl', 'Double'" },
          { type: "number", name: "order", label: "Display Order",
            description: "Low numbers first, within the section. Leave gaps (10, 20, 30)." },
          { type: "boolean", name: "available", label: "Show on Site",
            description: "Turn off when an item is off the menu — no need to delete it" },
        ],
      },
    ],
  },
});
