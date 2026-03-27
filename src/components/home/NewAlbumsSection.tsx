import { useQuery } from "@tanstack/react-query";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { Section } from "@/components/home/Section";
import { HorizontalScroll, CoverSkeleton } from "@/components/home/HorizontalScroll";
import { memo } from "react";
import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Album } from "@/data/mockData";

interface Props {
  onPlayAlbum?: (album: Album) => void;
}

const AlbumCard = memo(function AlbumCard({
  album,
  index,
}: {
  album: Album;
  index: number;
}) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, type: "spring", stiffness: 260, damping: 24 }}
      whileTap={{ scale: 0.95 }}
      className="flex-shrink-0 w-40 cursor-pointer group"
      onClick={() => navigate(`/album/${album.id}`)}
    >
      <div className="relative w-40 h-40 overflow-hidden mb-2.5 bg-secondary shadow-lg rounded-2xl">
        <img
          src={album.coverUrl}
          alt={album.title}
          loading="lazy"
          className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <h3 className="text-sm font-bold truncate leading-tight text-foreground">{album.title}</h3>
      <p className="text-xs text-muted-foreground truncate mt-0.5">{album.artist}</p>
    </motion.div>
  );
});

export function NewAlbumsSection({ onPlayAlbum }: Props) {
  const { data: albums, isLoading } = useQuery({
    queryKey: ["deezer-chart-albums"],
    queryFn: () => deezerApi.getChartAlbums(15),
    staleTime: 15 * 60 * 1000,
  });

  if (!isLoading && (!albums || albums.length === 0)) return null;

  return (
    <Section title="Nouveautés 💿">
      <HorizontalScroll>
        {isLoading ? (
          <CoverSkeleton />
        ) : (
          albums?.map((album, i) => (
            <AlbumCard key={album.id} album={album} index={i} />
          ))
        )}
      </HorizontalScroll>
    </Section>
  );
}
