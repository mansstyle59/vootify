import { useRef, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * Pure-CSS page fade: triggers a 80ms opacity transition on route change.
 * Non-blocking — the new page renders immediately and fades in.
 */
export function PageFade({ children }: { children: ReactNode }) {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    // Force reflow then fade in
    void el.offsetHeight;
    el.style.opacity = "1";
  }, [location.pathname]);

  return (
    <div
      ref={ref}
      className="min-h-screen"
      style={{ transition: "opacity 40ms ease-out" }}
    >
      {children}
    </div>
  );
}
