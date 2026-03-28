import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ListMusic, Play } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";

interface QuickItem {
  id: string;
  label: string;
  sublabel: string;
  imageUrl: string;
  type: "playlist" | "album";
  action: () => void;
}

export function QuickAccess() {
  const navigate = useNavigate();
  const userId = usePlayerStore((s) => s.userId);
  const { play, setQueue } = usePlayerStore();

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

  const items: QuickItem[] = [];

  for (const p of playlists || []) {
    items.push({
      id: `playlist-${p.id}`,
      label: p.name,
      sublabel: "Playlist",
      imageUrl: p.cover_url || "",
      type: "playlist",
      action: () => navigate(`/playlist/${p.id}`),
    });
  }

  if (items.length === 0) return null;

  const displayed = items.slice(0, 6);

  return (
    <div className="px-4 md:px-8 pb-2 pt-2">
      <div className="grid grid-cols-2 gap-2.5">
        {displayed.map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={item.action}
            whileTap={{ scale: 0.97 }}
            className="group flex items-center gap-3 rounded-xl transition-all duration-200 overflow-hidden h-[56px] hover:ring-1 hover:ring-primary/20"
            style={{
              background: "hsl(var(--secondary) / 0.5)",
              border: "1px solid hsl(var(--border) / 0.15)",
              boxShadow: "0 2px 8px hsl(0 0% 0% / 0.1)",
            }}
          >
            <div className="w-[56px] h-[56px] flex-shrink-0 overflow-hidden rounded-l-xl relative" style={{ background: "hsl(var(--secondary) / 0.8)" }}>
              {item.imageUrl ? (
                <LazyImage
                  src={item.imageUrl}
                  alt={item.label}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                  <ListMusic className="w-5 h-5 text-primary/40" />
                </div>
              )}
              {/* Play overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Play className="w-4 h-4 text-white" fill="white" />
              </div>
            </div>
            <span className="text-[12px] font-semibold text-foreground truncate pr-3 leading-tight group-hover:text-primary transition-colors">
              {item.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
