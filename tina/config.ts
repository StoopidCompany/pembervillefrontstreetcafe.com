import { defineConfig } from "tinacms";

const branch =
  process.env.GITHUB_REF_NAME ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

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
    // Scaffold only. Menu sections/items, hours and the rest of the model land in
    // phase 2 (content-model/menu). Address, phone and hours stay out of here until
    // Gavin confirms them — see plan.md "Unverified / needs Gavin".
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
          { type: "string", name: "contactEmail", label: "Contact Email" },
          { type: "string", name: "phone", label: "Phone" },
          {
            type: "object", name: "socials", label: "Social Links",
            fields: [
              { type: "string", name: "facebook", label: "Facebook URL" },
              { type: "string", name: "instagram", label: "Instagram URL" },
            ],
          },
          { type: "string", name: "footerText", label: "Footer Text",
            description: "e.g. © The Front Street Cafe 2026" },
        ],
      },
    ],
  },
});
