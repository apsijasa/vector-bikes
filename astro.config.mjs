import node from "@astrojs/node";
import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://vectorbikes.cl",
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [
    preact(),
    sitemap({
      filter: (page) => !page.includes("/admin") && !page.includes("/reservas"),
    }),
  ],
  security: {
    checkOrigin: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
