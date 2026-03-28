import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ListMusic, Play } from "lucide-react";
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
        .limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  if (!playlists || playlists.length === 0) return null;

  const displayed = playlists.slice(0, 6);

  return (
    <div className="px-4 md:px-8 pb-1 pt-1">
      <div className="grid grid-cols-2 gap-2">
        {displayed.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={() => navigate(`/playlist/${p.id}`)}
            whileTap={{ scale: 0.97 }}
            className="group flex items-center gap-2.5 rounded-xl overflow-hidden h-[50px] transition-all duration-200"
            style={{
              background: "hsl(var(--card) / 0.5)",
              backdropFilter: "blur(12px)",
              border: "1px solid hsl(var(--border) / 0.08)",
            }}
          >
            <div className="w-[50px] h-[50px] flex-shrink-0 overflow-hidden relative bg-secondary/50">
              {p.cover_url ? (
                <LazyImage src={p.cover_url} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                  <ListMusic className="w-4 h-4 text-primary/30" />
                </div>
              )}
              {/* Play overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Play className="w-4 h-4 text-white fill-white" />
              </div>
            </div>
            <span className="text-[11px] font-semibold text-foreground truncate pr-3 leading-tight group-hover:text-primary transition-colors">
              {p.name}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
