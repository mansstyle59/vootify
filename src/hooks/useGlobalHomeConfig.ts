import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HomeSection } from "@/components/home/HomeCustomizer";
import { DEFAULT_SECTIONS } from "@/components/home/HomeCustomizer";

const QUERY_KEY = ["global-home-config"];

export function useGlobalHomeConfig() {
  const queryClient = useQueryClient();

  const { data: sections, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<HomeSection[]> => {
      const { data, error } = await supabase
        .from("home_config")
        .select("sections")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Failed to load home config:", error);
        return DEFAULT_SECTIONS;
      }

      if (!data || !data.sections) return DEFAULT_SECTIONS;

      if (!Array.isArray(data.sections)) return DEFAULT_SECTIONS;

      return data.sections as unknown as HomeSection[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (newSections: HomeSection[]) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("home_config")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("home_config")
          .update({ sections: newSections as any, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("home_config")
          .insert({ sections: newSections as any, updated_by: user.id });
        if (error) throw error;
      }

      return newSections;
    },
    onMutate: async (newSections) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<HomeSection[]>(QUERY_KEY);
      queryClient.setQueryData<HomeSection[]>(QUERY_KEY, newSections);
      return { previous };
    },
    onError: (_error, _newSections, context) => {
      if (context?.previous) {
        queryClient.setQueryData<HomeSection[]>(QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    sections: sections ?? DEFAULT_SECTIONS,
    isLoading,
    saveConfig: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
