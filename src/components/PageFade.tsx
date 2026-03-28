import { useRef, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * iOS-style page transition: subtle fade + slide for native feel.
 * Non-blocking — the new page renders immediately and animates in.
 * Also scrolls to top on every navigation for consistency.
 */
export function PageFade({ children }: { children: ReactNode }) {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    // Scroll to top on every navigation — native app feel
    window.scrollTo({ top: 0, left: 0 });
    ref.current?.parentElement?.scrollTo?.({ top: 0, left: 0 });

    const el = ref.current;
    if (!el) return;
    // Start: invisible + slightly shifted
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    // Force reflow then animate in
    void el.offsetHeight;
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  }, [location.pathname]);

  return (
    <div
      ref={ref}
      className="min-h-screen will-change-[opacity,transform]"
      style={{
        transition: "opacity 120ms cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 120ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}
    >
      {children}
    </div>
  );
}
