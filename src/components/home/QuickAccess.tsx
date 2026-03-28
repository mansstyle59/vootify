import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ListMusic } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";

interface QuickItem {
  id: string;
  label: string;
  imageUrl: string;
  action: () => void;
}

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

  const items: QuickItem[] = [];
  for (const p of playlists || []) {
    items.push({
      id: `playlist-${p.id}`,
      label: p.name,
      imageUrl: p.cover_url || "",
      action: () => navigate(`/playlist/${p.id}`),
    });
  }

  if (items.length === 0) return null;

  const displayed = items.slice(0, 6);

  return (
    <div className="px-4 md:px-8 pb-1 pt-1">
      <div className="grid grid-cols-2 gap-2">
        {displayed.map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={item.action}
            whileTap={{ scale: 0.97 }}
            className="group flex items-center gap-2.5 rounded-lg overflow-hidden h-[48px] transition-colors"
            style={{
              background: "hsl(var(--secondary) / 0.45)",
              border: "1px solid hsl(var(--border) / 0.1)",
            }}
          >
            <div
              className="w-[48px] h-[48px] flex-shrink-0 overflow-hidden relative"
              style={{ background: "hsl(var(--secondary) / 0.7)" }}
            >
              {item.imageUrl ? (
                <LazyImage
                  src={item.imageUrl}
                  alt={item.label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/12 to-primary/5">
                  <ListMusic className="w-4 h-4 text-primary/35" />
                </div>
              )}
            </div>
            <span className="text-[11px] font-semibold text-foreground truncate pr-3 leading-tight group-hover:text-primary transition-colors">
              {item.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
