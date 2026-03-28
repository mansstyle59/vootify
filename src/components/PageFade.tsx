import { useRef, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

// Main tab routes for directional transition
const tabOrder = ["/", "/search", "/library", "/radio", "/add", "/admin"];

/**
 * iOS-style page transition: directional slide based on tab order,
 * with a subtle fade and scale for depth. Non-blocking.
 */
export function PageFade({ children }: { children: ReactNode }) {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;

    const prevIndex = tabOrder.indexOf(prevPath.current);
    const nextIndex = tabOrder.indexOf(location.pathname);
    const isTabNav = prevIndex !== -1 && nextIndex !== -1;
    // Direction: positive = slide from right, negative = slide from left
    const goingForward = isTabNav ? nextIndex > prevIndex : true;

    prevPath.current = location.pathname;

    // Scroll to top on every navigation
    window.scrollTo({ top: 0, left: 0 });
    const scrollContainer = document.getElementById("main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;

    const el = ref.current;
    if (!el) return;

    if (isTabNav) {
      // Directional slide for tab navigation
      const offsetX = goingForward ? 40 : -40;
      el.style.opacity = "0";
      el.style.transform = `translateX(${offsetX}px) scale(0.97)`;
    } else {
      // Vertical slide for detail pages
      el.style.opacity = "0";
      el.style.transform = "translateY(12px) scale(0.985)";
    }

    // Force reflow then animate in
    void el.offsetHeight;
    el.style.opacity = "1";
    el.style.transform = "translateX(0) translateY(0) scale(1)";
  }, [location.pathname]);

  return (
    <div
      ref={ref}
      className="min-h-screen will-change-[opacity,transform]"
      style={{
        transition:
          "opacity 180ms cubic-bezier(0.25, 0.1, 0.25, 1), transform 220ms cubic-bezier(0.25, 0.1, 0.25, 1)",
      }}
    >
      {children}
    </div>
  );
}
