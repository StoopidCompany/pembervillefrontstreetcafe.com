import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Apex, no www — that is what is currently indexed. See README "Domain".
  site: "https://pembervillefrontstreetcafe.com",
  integrations: [mdx(), sitemap()],
  // The old site's /reviews page had a heading and no reviews under it, and the new site
  // has no reviews page. Keep the URL alive so the link isn't a 404. Static builds emit
  // a meta-refresh page with a canonical link to the target.
  redirects: {
    "/reviews": "/",
  },
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    responsiveStyles: true,
  },
});
