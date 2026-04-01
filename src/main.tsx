import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { guardServiceWorker } from "@/lib/swGuard";
import { initRoutePrefetch } from "@/lib/prefetchRoutes";
import { initOfflineSync } from "@/lib/offlineQueue";

// Prevent SW issues in preview/iframe contexts
guardServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);

// Prefetch route chunks on interaction hints (after render)
initRoutePrefetch();

// Start offline action sync listener
initOfflineSync();
