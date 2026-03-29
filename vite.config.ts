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
        categories: ["music", "entertainment"],
        lang: "fr",
        dir: "ltr",
        prefer_related_applications: false,
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "Rechercher",
            short_name: "Rechercher",
            url: "/search",
            icons: [{ src: "/pwa-icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Ma Bibliothèque",
            short_name: "Bibliothèque",
            url: "/library",
            icons: [{ src: "/pwa-icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Radio",
            short_name: "Radio",
            url: "/radio",
            icons: [{ src: "/pwa-icon-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        importScripts: ["/sw-push.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff,ttf,json}"],
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
              cacheableResponse: { statuses: [200] },
            },
          },
          // Deezer covers — aggressive cache (both cdn-images and cdn-images subdomains)
          {
            urlPattern: /^https:\/\/cdn[s-]*images\.dzcdn\.net\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "deezer-covers",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [200] },
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
          // Supabase Edge Functions — network first with 1.5s timeout
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-functions",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 4 },
              networkTimeoutSeconds: 1.5,
              cacheableResponse: { statuses: [200] },
            },
          },
          // Supabase REST API — stale-while-revalidate for instant UX
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 3 },
              cacheableResponse: { statuses: [200] },
            },
          },
          // Supabase Auth — network first, short cache
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-auth",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase Storage (covers, avatars, audio thumbnails) — cache aggressively
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/(covers|avatars)\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-images",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // JioSaavn audio streams — cache for offline playback
          {
            urlPattern: /^https:\/\/.*\.saavncdn\.com\/.*\.(mp4|mp3|m4a)/i,
            handler: "CacheFirst",
            options: {
              cacheName: "audio-streams",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          // Any other image CDN — catch-all for covers
          {
            urlPattern: /\.(?:png|jpg|jpeg|webp|avif|gif|svg)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-generic",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react/jsx-runtime"],
          "vendor-router": ["react-router-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-zustand": ["zustand"],
        },
      },
    },
    target: "esnext",
    minify: "esbuild",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
