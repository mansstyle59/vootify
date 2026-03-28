import { useState, useCallback, useEffect } from "react";
import type { HomeSection } from "@/hooks/useHomeConfig";

const STORAGE_KEY = "user-home-layout";

export interface UserLayoutOverride {
  /** Section ID → visibility override */
  hidden: Record<string, boolean>;
  /** Ordered section IDs (user custom order) */
  order: string[];
}

function loadLayout(): UserLayoutOverride | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveLayout(layout: UserLayoutOverride) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function useUserHomeLayout(adminSections: HomeSection[]) {
  const [editMode, setEditMode] = useState(false);
  const [userLayout, setUserLayout] = useState<UserLayoutOverride | null>(() => loadLayout());

  // Merge admin sections with user overrides
  const mergedSections = useCallback((): HomeSection[] => {
    if (!userLayout || userLayout.order.length === 0) {
      return adminSections;
    }

    // Build map from admin sections
    const adminMap = new Map(adminSections.map((s) => [s.id, s]));

    // Start with user order, only include sections that still exist in admin
    const ordered: HomeSection[] = [];
    for (const id of userLayout.order) {
      const adminSection = adminMap.get(id);
      if (adminSection) {
        ordered.push({
          ...adminSection,
          visible: userLayout.hidden[id] ? false : adminSection.visible,
        });
        adminMap.delete(id);
      }
    }

    // Append any new admin sections not in user order
    for (const [, section] of adminMap) {
      ordered.push(section);
    }

    return ordered.map((s, i) => ({ ...s, order: i }));
  }, [adminSections, userLayout]);

  const sections = mergedSections();

  const toggleVisibility = useCallback((sectionId: string) => {
    setUserLayout((prev) => {
      const current = prev || { hidden: {}, order: adminSections.map((s) => s.id) };
      const newHidden = { ...current.hidden };
      newHidden[sectionId] = !newHidden[sectionId];
      const next = { ...current, hidden: newHidden };
      saveLayout(next);
      return next;
    });
  }, [adminSections]);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setUserLayout((prev) => {
      const currentOrder = prev?.order?.length
        ? [...prev.order]
        : adminSections.map((s) => s.id);
      const [moved] = currentOrder.splice(fromIndex, 1);
      currentOrder.splice(toIndex, 0, moved);
      const next = { hidden: prev?.hidden || {}, order: currentOrder };
      saveLayout(next);
      return next;
    });
  }, [adminSections]);

  const resetLayout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUserLayout(null);
  }, []);

  return {
    editMode,
    setEditMode,
    sections,
    toggleVisibility,
    reorder,
    resetLayout,
    hasCustomLayout: !!userLayout,
  };
}
