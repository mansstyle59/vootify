import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HomeSection {
  id: string;
  title: string;
  visible: boolean;
  order: number;
}

export interface CustomSection {
  id: string;
  title: string;
  songIds: string[]; // custom_songs UUIDs
}

export interface HomeConfig {
  sections: HomeSection[];
  customSections: CustomSection[];
  heroTitle?: string;
  heroSubtitle?: string;
  heroBgColor?: string;
  heroBgImage?: string;
}

const DEFAULT_SECTIONS: HomeSection[] = [
  { id: "recently_added", title: "Ajoutés récemment 🆕", visible: true, order: 0 },
  { id: "most_played", title: "Les plus écoutés 🔥", visible: true, order: 1 },
  { id: "recently_listened", title: "Écoutés récemment 🕐", visible: true, order: 2 },
  { id: "recommended", title: "Recommandés pour vous ✨", visible: true, order: 3 },
  { id: "artists", title: "Artistes 🎤", visible: true, order: 4 },
  { id: "albums", title: "Albums 💿", visible: true, order: 5 },
];

export function useHomeConfig() {
  return useQuery({
    queryKey: ["home-config"],
    queryFn: async (): Promise<HomeConfig> => {
      const { data, error } = await supabase
        .from("home_config")
        .select("sections")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data || !data.sections) {
        return { sections: DEFAULT_SECTIONS, customSections: [] };
      }

      const raw = data.sections as any;
      if (Array.isArray(raw)) {
        return { sections: mergeSections(raw), customSections: [] };
      }
      return {
        sections: mergeSections(raw.sections || []),
        customSections: raw.customSections || [],
        heroTitle: raw.heroTitle,
        heroSubtitle: raw.heroSubtitle,
        heroBgColor: raw.heroBgColor,
        heroBgImage: raw.heroBgImage,
      };
    },
    staleTime: 60_000,
  });
}

/** Ensure all default sections exist, preserving saved order/visibility/title */
function mergeSections(saved: HomeSection[]): HomeSection[] {
  const map = new Map(saved.map((s) => [s.id, s]));
  const merged: HomeSection[] = [];

  for (const s of saved) {
    // Keep both default and custom_ sections
    merged.push(s);
  }

  // Add any missing default sections
  for (const d of DEFAULT_SECTIONS) {
    if (!map.has(d.id)) {
      merged.push({ ...d, order: merged.length });
    }
  }

  return merged.map((s, i) => ({ ...s, order: i }));
}

export function useSaveHomeConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ config, userId }: { config: HomeConfig; userId: string }) => {
      const payload = {
        sections: config.sections,
        customSections: config.customSections,
        heroTitle: config.heroTitle,
        heroSubtitle: config.heroSubtitle,
        heroBgColor: config.heroBgColor,
        heroBgImage: config.heroBgImage,
      };

      const { data: existing } = await supabase
        .from("home_config")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("home_config")
          .update({ sections: payload as any, updated_by: userId })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("home_config")
          .insert({ sections: payload as any, updated_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-config"] });
    },
  });
}

export { DEFAULT_SECTIONS };
