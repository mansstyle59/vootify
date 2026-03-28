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

export function useAppSettings<T>(key: string, defaultValue: T) {
  return useQuery({
    queryKey: ["app-settings", key],
    queryFn: async (): Promise<T> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      if (!data) return defaultValue;
      return data.value as T;
    },
    staleTime: 60_000,
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
