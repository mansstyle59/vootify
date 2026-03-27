import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "pwa-icon-192.png",
        "pwa-icon-512.png",
        "placeholder.svg",
        "favicon.png",
      ],
      devOptions: { enabled: false },
      manifest: {
        name: "Vootify",
        short_name: "Vootify",
        description: "Découvrez et écoutez de la musique en streaming",
        theme_color: "#0b0e14",
        background_color: "#0b0e14",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        // Pre-cache ALL built assets for instant offline loading
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff,ttf,json}"],
        // Increase pre-cache size limit for larger JS chunks
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          // Google Fonts stylesheets
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Google Fonts webfonts — cache first, they never change
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Unsplash images
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "unsplash-images",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Saavn covers — aggressive cache, large pool
          {
            urlPattern: /^https:\/\/c\.saavncdn\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "saavn-covers",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Deezer covers — aggressive cache
          {
            urlPattern: /^https:\/\/cdns-images\.dzcdn\.net\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "deezer-covers",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Deezer API images (e.g. artist images)
          {
            urlPattern: /^https:\/\/api\.deezer\.com\/.*\/image$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "deezer-api-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase Edge Functions — network first with fast fallback
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-functions",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 2 },
              networkTimeoutSeconds: 2,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase REST API — stale-while-revalidate for snappy UX
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
