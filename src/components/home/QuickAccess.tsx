import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useNavigate } from "react-router-dom";
import { ListMusic } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";

export function QuickAccess() {
  const navigate = useNavigate();
  const userId = usePlayerStore((s) => s.userId);

  const { data: playlists } = useQuery({
    queryKey: ["quick-playlists", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("playlists")
        .select("id, name, cover_url, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  if (!playlists || playlists.length === 0) return null;

  return (
    <div className="px-5 md:px-9">
      <div className="grid grid-cols-2 gap-2">
        {playlists.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate(`/playlist/${p.id}`)}
            className="group flex items-center gap-2.5 rounded-2xl overflow-hidden h-[56px] active:scale-[0.97] transition-transform duration-150"
            style={{
              background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.25))",
              backdropFilter: "blur(40px) saturate(1.8)",
              WebkitBackdropFilter: "blur(40px) saturate(1.8)",
              border: "0.5px solid hsl(var(--foreground) / 0.06)",
              boxShadow: "0 2px 12px hsl(0 0% 0% / 0.15), inset 0 0.5px 0 hsl(var(--foreground) / 0.04)",
            }}
          >
            <div
              className="w-[56px] h-[56px] flex-shrink-0 overflow-hidden rounded-l-2xl"
              style={{ background: "hsl(var(--foreground) / 0.06)" }}
            >
              {p.cover_url ? (
                <LazyImage src={p.cover_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.03))" }}
                >
                  <ListMusic className="w-4 h-4 text-primary/25" />
                </div>
              )}
            </div>
            <span className="text-[12px] font-semibold text-foreground truncate pr-3 leading-tight">
              {p.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
