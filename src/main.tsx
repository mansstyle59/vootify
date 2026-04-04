import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { guardServiceWorker } from "@/lib/swGuard";

// Prevent SW issues in preview/iframe contexts
guardServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);

// Defer non-critical modules to idle time
const deferInit = (fn: () => void) => {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(fn, { timeout: 3000 });
  } else {
    setTimeout(fn, 1500);
  }
};

deferInit(() => {
  import("@/lib/prefetchRoutes").then((m) => m.initRoutePrefetch());
  import("@/lib/offlineQueue").then((m) => m.initOfflineSync());
});
