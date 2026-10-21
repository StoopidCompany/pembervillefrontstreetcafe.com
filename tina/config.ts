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
            ],
          },
          { type: "string", name: "phone", label: "Phone" },
          { type: "string", name: "email", label: "Email" },
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
