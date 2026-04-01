import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ThemeSettings {
  primaryHue: number;
  primarySaturation: number;
  primaryLightness: number;
  accentHue: number;
  accentSaturation: number;
  accentLightness: number;
  backgroundHue: number;
  backgroundSaturation: number;
  backgroundLightness: number;
  fontFamily: string;
}

const DEFAULT_THEME: ThemeSettings = {
  primaryHue: 152,
  primarySaturation: 82,
  primaryLightness: 34,
  accentHue: 152,
  accentSaturation: 55,
  accentLightness: 22,
  backgroundHue: 220,
  backgroundSaturation: 16,
  backgroundLightness: 5,
  fontFamily: "Nunito",
};

const SETTINGS_CACHE_PREFIX = "vootify-setting-";

function getCachedSetting<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_PREFIX + key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return undefined;
}

function setCachedSetting(key: string, value: unknown) {
  try {
    localStorage.setItem(SETTINGS_CACHE_PREFIX + key, JSON.stringify(value));
  } catch { /* ignore */ }
}

export function useAppSettings<T>(key: string, defaultValue: T) {
  const cached = getCachedSetting<T>(key);
  return useQuery({
    queryKey: ["app-settings", key],
    queryFn: async (): Promise<T> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      const val = data ? (data.value as T) : defaultValue;
      setCachedSetting(key, val);
      return val;
    },
    staleTime: 1000 * 60 * 60, // 1 hour — settings rarely change
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    initialData: cached ?? undefined,
  });
}

export function useSaveAppSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value, userId }: { key: string; value: unknown; userId: string }) => {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: value as any, updated_by: userId })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({ key, value: value as any, updated_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["app-settings", variables.key] });
    },
  });
}

export function useThemeSettings() {
  return useAppSettings<ThemeSettings>("theme", DEFAULT_THEME);
}

export { DEFAULT_THEME };

export interface SearchSectionsConfig {
  artists: boolean;
  genres: boolean;
  stats: boolean;
  suggestions: boolean;
}

export const DEFAULT_SEARCH_SECTIONS: SearchSectionsConfig = {
  artists: true,
  genres: true,
  stats: true,
  suggestions: true,
};

export function useSearchSections() {
  return useAppSettings<SearchSectionsConfig>("search_sections", DEFAULT_SEARCH_SECTIONS);
}

export interface LibraryTabConfig {
  key: string;
  visible: boolean;
}

export const DEFAULT_LIBRARY_TABS: LibraryTabConfig[] = [
  { key: "songs", visible: true },
  { key: "recent", visible: true },
  { key: "albums", visible: true },
  { key: "artists", visible: true },
  { key: "playlists", visible: true },
  { key: "downloads", visible: true },
];

export function useLibraryTabsConfig() {
  return useAppSettings<LibraryTabConfig[]>("library_tabs", DEFAULT_LIBRARY_TABS);
}
