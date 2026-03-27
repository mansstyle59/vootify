import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HomeSection {
  id: string;
  title: string;
  visible: boolean;
  order: number;
}

export interface HomeConfig {
  sections: HomeSection[];
  heroTitle?: string;
  heroSubtitle?: string;
  heroBgColor?: string;
  heroBgImage?: string;
}

const DEFAULT_SECTIONS: HomeSection[] = [
  { id: "recently_added", title: "Ajoutés récemment 🆕", visible: true, order: 0 },
  { id: "recently_listened", title: "Écoutés récemment 🕐", visible: true, order: 1 },
  { id: "most_played", title: "Les plus écoutés 🔥", visible: true, order: 2 },
  { id: "recommended", title: "Recommandés pour vous ✨", visible: true, order: 3 },
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
        return { sections: DEFAULT_SECTIONS };
      }

      const raw = data.sections as any;
      // Support both { sections: [...], heroTitle, heroSubtitle } and plain array
      if (Array.isArray(raw)) {
        return { sections: mergeSections(raw) };
      }
      return {
        sections: mergeSections(raw.sections || []),
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

  // Add saved sections in their order
  for (const s of saved) {
    if (DEFAULT_SECTIONS.some((d) => d.id === s.id)) {
      merged.push(s);
    }
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
        heroTitle: config.heroTitle,
        heroSubtitle: config.heroSubtitle,
        heroBgColor: config.heroBgColor,
        heroBgImage: config.heroBgImage,
      };

      // Check if a row exists
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
