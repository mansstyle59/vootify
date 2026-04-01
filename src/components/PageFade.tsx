import { useRef, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

// Main tab routes for directional transition
const tabOrder = ["/", "/search", "/library", "/radio", "/add", "/admin"];

/**
 * Premium page transition: directional slide for tabs,
 * vertical slide + scale for detail pages.
 * Uses native CSS transitions for 60fps performance.
 */
export function PageFade({ children }: { children: ReactNode }) {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const prevPath = useRef(location.pathname);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip animation on first mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevPath.current = location.pathname;
      return;
    }

    if (location.pathname === prevPath.current) return;

    const prevIndex = tabOrder.indexOf(prevPath.current);
    const nextIndex = tabOrder.indexOf(location.pathname);
    const isTabNav = prevIndex !== -1 && nextIndex !== -1;
    const goingForward = isTabNav ? nextIndex > prevIndex : true;

    prevPath.current = location.pathname;

    // Scroll to top on every navigation
    window.scrollTo({ top: 0, left: 0 });
    const scrollContainer = document.getElementById("main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;

    const el = ref.current;
    if (!el) return;

    // Disable transition for instant "exit" state
    el.style.transition = "none";

    if (isTabNav) {
      const offsetX = goingForward ? 32 : -32;
      el.style.opacity = "0";
      el.style.transform = `translateX(${offsetX}px)`;
      el.style.filter = "blur(4px)";
    } else {
      el.style.opacity = "0";
      el.style.transform = "translateY(16px) scale(0.98)";
      el.style.filter = "blur(2px)";
    }

    // Force reflow then animate in
    void el.offsetHeight;

    // Re-enable transition — fast & snappy
    el.style.transition = isTabNav
      ? "opacity 140ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms cubic-bezier(0.22, 1, 0.36, 1), filter 140ms ease-out"
      : "opacity 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 240ms cubic-bezier(0.22, 1, 0.36, 1), filter 180ms ease-out";

    el.style.opacity = "1";
    el.style.transform = "translateX(0) translateY(0) scale(1)";
    el.style.filter = "blur(0px)";
  }, [location.pathname]);

  return (
    <div
      ref={ref}
      className="min-h-screen will-change-[opacity,transform,filter]"
    >
      {children}
    </div>
  );
}
