import { defineConfig } from "astro/config";

const cardLayoutAssets = {
  name: "timee-card-layout-assets",
  transformIndexHtml() {
    return [
      {
        tag: "link",
        attrs: { rel: "stylesheet", href: "/card-layout.css" },
        injectTo: "head"
      },
      {
        tag: "script",
        attrs: { type: "module", src: "/card-layout.js" },
        injectTo: "body"
      }
    ];
  }
};

export default defineConfig({
  site: "https://timee.hu",
  output: "static",
  trailingSlash: "never",
  vite: {
    plugins: [cardLayoutAssets]
  }
});
