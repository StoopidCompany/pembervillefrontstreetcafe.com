import { defineCollection, z } from "astro:content";
import { file } from "astro/loaders";

const settings = defineCollection({
  loader: file("content/settings/site.json", {
    parser: (text) => [{ id: "site", ...JSON.parse(text) }],
  }),
  schema: z.object({
    businessName: z.string(),
    tagline: z.string().nullable().optional(),
    contactEmail: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    socials: z.object({
      facebook: z.string().nullable().optional(),
      instagram: z.string().nullable().optional(),
    }),
    footerText: z.string().nullable().optional(),
  }),
});

export const collections = { settings };
