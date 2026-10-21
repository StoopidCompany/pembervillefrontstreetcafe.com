import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

/** 24-hour HH:MM. Matches the validator in tina/config.ts so a bad time fails the build. */
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be 24-hour HH:MM");

const optionalString = z.string().nullable().optional();

const hoursEntry = z
  .object({
    day: z.enum([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]),
    closed: z
      .boolean()
      .nullish()
      .transform((v) => v ?? false),
    open: time.nullable().optional(),
    close: time.nullable().optional(),
  })
  .superRefine((entry, ctx) => {
    if (entry.closed) return;
    if (!entry.open || !entry.close) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${entry.day}: needs both open and close times, or "closed all day"`,
      });
    }
  });

const settings = defineCollection({
  loader: file("content/settings/site.json", {
    parser: (text) => [{ id: "site", ...JSON.parse(text) }],
  }),
  schema: z.object({
    businessName: z.string(),
    tagline: optionalString,
    address: z.object({
      street: optionalString,
      city: optionalString,
      state: optionalString,
      zip: optionalString,
      latitude: optionalString,
      longitude: optionalString,
    }),
    phone: optionalString,
    email: optionalString,
    servesCuisine: optionalString,
    priceRange: optionalString,
    acceptsReservations: z.enum(["unknown", "yes", "no"]).default("unknown"),
    socials: z.object({
      facebook: optionalString,
      instagram: optionalString,
      twitter: optionalString,
      tiktok: optionalString,
      google: optionalString,
      yelp: optionalString,
    }),
    hours: z.array(hoursEntry).default([]),
    footerText: optionalString,
  }),
});

/**
 * One file per singleton page: home.md, menu.md, about.md, gallery.md, contact.md.
 * Prose lives in the markdown body. Everything past `headline` belongs to one page or
 * another, so it is all optional — same shape as the Tina collections above it.
 */
const pages = defineCollection({
  loader: glob({ pattern: "*.md", base: "content/pages" }),
  schema: z.object({
    headline: z.string(),
    // every page: distinct title and meta description, editable in the admin
    seoTitle: optionalString,
    description: optionalString,
    // home
    heroSubtext: optionalString,
    heroImage: optionalString,
    signatures: z
      .array(z.object({ item: z.string() }))
      .default([]),
    ctaText: optionalString,
    ctaHref: optionalString,
    // about
    image: optionalString,
    // gallery
    images: z
      .array(
        z.object({
          image: z.string(),
          alt: z.string().min(1, "every photo needs a description"),
          caption: optionalString,
        }),
      )
      .default([]),
    // contact
    mapQuery: optionalString,
    responseTime: optionalString,
  }),
});

const menuSections = defineCollection({
  loader: glob({ pattern: "*.md", base: "content/menu-sections" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    order: z.number().default(99),
    published: z.boolean().default(true),
  }),
});

const menuItems = defineCollection({
  loader: glob({ pattern: "*.md", base: "content/menu-items" }),
  schema: z.object({
    name: z.string(),
    // Tina writes a path, e.g. "content/menu-sections/handhelds.md" — not an Astro
    // collection id, so this cannot use reference(). getMenu() resolves it and throws
    // on a dangling section.
    section: z.string(),
    description: optionalString,
    price: z.string().min(1, "price is required — use 'Market price' if it varies"),
    priceNote: optionalString,
    altPrice: optionalString,
    altPriceNote: optionalString,
    order: z.number().default(99),
    available: z.boolean().default(true),
  }),
});

export const collections = { settings, pages, menuSections, menuItems };
