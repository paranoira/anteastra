import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://anteastra.space",
  output: "static",
  trailingSlash: "never",
  i18n: {
    locales: ["hu", "en"],
    defaultLocale: "hu",
    routing: {
      prefixDefaultLocale: false
    }
  }
});
