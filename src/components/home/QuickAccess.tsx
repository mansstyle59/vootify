import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Radio, ListMusic, Music } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";

interface QuickItem {
  id: string;
  label: string;
  sublabel: string;
  imageUrl: string;
  type: "radio" | "playlist" | "album";
  action: () => void;
}

export function QuickAccess() {
  const navigate = useNavigate();
  const userId = usePlayerStore((s) => s.userId);
  const { play, setQueue } = usePlayerStore();

  // Recent radios from recently_played
  const { data: recentRadios } = useQuery({
    queryKey: ["quick-recent-radios", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("recently_played")
        .select("*")
        .eq("user_id", userId)
        .eq("album", "Radio en direct")
        .order("played_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      // Deduplicate by station name
      const seen = new Set<string>();
      const unique: typeof data = [];
      for (const r of data || []) {
        if (!seen.has(r.title)) {
          seen.add(r.title);
          unique.push(r);
        }
        if (unique.length >= 4) break;
      }
      return unique;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  // User playlists
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

  const items: QuickItem[] = [];

  // Add recent radios
  for (const r of recentRadios || []) {
    items.push({
      id: `radio-${r.song_id}`,
      label: r.title,
      sublabel: "Radio",
      imageUrl: r.cover_url || "",
      type: "radio",
      action: () => navigate("/radio"),
    });
  }

  // Add playlists
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

  // Show max 6 items
  const displayed = items.slice(0, 6);

  return (
    <div className="px-4 md:px-8 pb-1 pt-1">
      <div className="grid grid-cols-2 gap-2">
        {displayed.map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={item.action}
            className="flex items-center gap-3 rounded-xl bg-secondary/50 hover:bg-secondary/80 active:scale-[0.97] transition-all duration-150 overflow-hidden h-[52px]"
          >
            <div className="w-[52px] h-[52px] flex-shrink-0 bg-secondary/80 overflow-hidden rounded-l-xl">
              {item.imageUrl ? (
                <LazyImage
                  src={item.imageUrl}
                  alt={item.label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                  {item.type === "radio" ? (
                    <Radio className="w-5 h-5 text-primary/40" />
                  ) : (
                    <ListMusic className="w-5 h-5 text-primary/40" />
                  )}
                </div>
              )}
            </div>
            <span className="text-[12px] font-semibold text-foreground truncate pr-3 leading-tight">
              {item.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
