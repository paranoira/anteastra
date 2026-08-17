import { defineConfig } from "astro/config";

export default defineConfig({
  // Absolute SEO/canonical generation depends on the production origin.
  site: "https://anteastra.space",
  // Static output is a core deployment constraint; cPanel serves dist directly.
  output: "static",
  trailingSlash: "never",
  i18n: {
    locales: ["hu", "en"],
    defaultLocale: "hu",
    routing: {
      // Hungarian remains `/`; only English receives the `/en` prefix.
      prefixDefaultLocale: false
    }
  }
});
