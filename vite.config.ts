import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // ⚠️ Obligatoire pour GitHub Pages
  base: "/vootify/",

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.png",
        "pwa-icon-192.png",
        "pwa-icon-512.png",
        "splash-screen.png",
      ],
      manifest: {
        name: "Vootify",
        short_name: "Vootify",
        description: "Vootify - Votre application de musique et radio en streaming.",
        theme_color: "#0b0e14",
        background_color: "#0b0e14",
        display: "standalone",
        orientation: "portrait",
        scope: "/vootify/",
        start_url: "/vootify/",
        icons: [
          {
            src: "pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/vootify/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5,
              },
            },
          },
          {
            urlPattern: /^https:\/\/(c\.saavncdn\.com|cdns-images\.dzcdn\.net)\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "cdn-images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
