import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { Play, ListPlus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { AddToPlaylistMenu } from "@/components/AddToPlaylistMenu";
import type { Song } from "@/data/mockData";

interface SectionProps {
  title: string;
  children: ReactNode;
  songs?: Song[];
  onPlayAll?: () => void;
}

export function Section({ title, children, songs, onPlayAll }: SectionProps) {
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [playlistPickerIndex, setPlaylistPickerIndex] = useState(0);

  const hasSongs = songs && songs.length > 0;

  const handleAddAllToPlaylist = () => {
    if (!songs || songs.length === 0) return;
    setPlaylistPickerIndex(0);
    setShowPlaylistPicker(true);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center justify-between px-4 md:px-8 mb-3">
        <h2 className="text-lg md:text-xl font-display font-bold text-foreground">{title}</h2>
        {hasSongs && (
          <div className="flex items-center gap-1.5 relative">
            {onPlayAll && (
              <button
                onClick={onPlayAll}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
              >
                <Play className="w-3 h-3" />
                Tout lire
              </button>
            )}
            <button
              onClick={handleAddAllToPlaylist}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors"
            >
              <ListPlus className="w-3 h-3" />
              Playlist
            </button>
            <AnimatePresence>
              {showPlaylistPicker && songs && playlistPickerIndex < songs.length && (
                <AddToPlaylistMenu
                  song={songs[playlistPickerIndex]}
                  onClose={() => {
                    // Add next song or close
                    if (playlistPickerIndex < songs.length - 1) {
                      setPlaylistPickerIndex((i) => i + 1);
                    } else {
                      setShowPlaylistPicker(false);
                    }
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      {children}
    </motion.section>
  );
}
