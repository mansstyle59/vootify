import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Check, X, ListMusic, Music } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface PendingPlaylist {
  id: string;
  playlist_name: string;
  cover_url: string | null;
  created_at: string;
  songCount?: number;
}

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-shared-playlists", user?.id],
    queryFn: async (): Promise<PendingPlaylist[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("shared_playlists")
        .select("id, playlist_name, cover_url, created_at")
        .eq("shared_to", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get song counts
      const ids = (data || []).map((p) => p.id);
      if (ids.length === 0) return [];

      const { data: songs } = await supabase
        .from("shared_playlist_songs")
        .select("shared_playlist_id")
        .in("shared_playlist_id", ids);

      const countMap: Record<string, number> = {};
      for (const s of songs || []) {
        countMap[s.shared_playlist_id] = (countMap[s.shared_playlist_id] || 0) + 1;
      }

      return (data || []).map((p) => ({
        ...p,
        songCount: countMap[p.id] || 0,
      }));
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const handleAccept = async (id: string) => {
    const { error } = await supabase
      .from("shared_playlists")
      .update({ status: "accepted" })
      .eq("id", id);
    if (error) {
      toast.error("Erreur lors de l'acceptation");
      return;
    }
    toast.success("Playlist acceptée !");
    queryClient.invalidateQueries({ queryKey: ["pending-shared-playlists"] });
    queryClient.invalidateQueries({ queryKey: ["shared-playlists"] });
  };

  const handleReject = async (id: string) => {
    // Delete the shared playlist and its songs
    await supabase.from("shared_playlist_songs").delete().eq("shared_playlist_id", id);
    const { error } = await supabase.from("shared_playlists").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors du refus");
      return;
    }
    toast.success("Playlist refusée");
    queryClient.invalidateQueries({ queryKey: ["pending-shared-playlists"] });
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-secondary transition-colors"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {pending.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
            {pending.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden"
            >
              <div className="p-3 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Notifications</h3>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {pending.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Aucune notification</p>
                  </div>
                ) : (
                  pending.map((pl) => (
                    <motion.div
                      key={pl.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-3 border-b border-border/50 last:border-0"
                    >
                      <div className="flex gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-secondary">
                          {pl.cover_url ? (
                            <img src={pl.cover_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                              <Music className="w-5 h-5 text-primary/30" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            Nouvelle playlist partagée
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            « {pl.playlist_name} » · {pl.songCount} titre{(pl.songCount || 0) > 1 ? "s" : ""}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleAccept(pl.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:brightness-110 transition-all"
                            >
                              <Check className="w-3 h-3" />
                              Accepter
                            </button>
                            <button
                              onClick={() => handleReject(pl.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-[11px] font-semibold hover:bg-destructive/20 transition-all"
                            >
                              <X className="w-3 h-3" />
                              Refuser
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
