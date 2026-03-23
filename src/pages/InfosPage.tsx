import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { ContentCard, SongCard, CardSkeleton, SongSkeleton } from "@/components/MusicCards";
import { motion } from "framer-motion";
import { TrendingUp, Users, Music2, Disc3, BarChart3 } from "lucide-react";
import type { Song } from "@/data/mockData";

interface DeezerArtist {
  id: number;
  name: string;
  picture_medium: string;
  picture_big: string;
  nb_fan: number;
}

async function callDeezer(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("deezer-proxy", { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

function mapTrackToSong(track: any): Song {
  return {
    id: `dz-${track.id}`,
    title: track.title,
    artist: track.artist?.name || "Inconnu",
    album: track.album?.title || "",
    duration: track.duration || 0,
    coverUrl: track.album?.cover_medium || track.album?.cover_big || "",
    streamUrl: track.preview || "",
    liked: false,
  };
}

function formatFans(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M fans`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K fans`;
  return `${n} fans`;
}

const frenchArtistQueries = [
  "Aya Nakamura", "Jul", "Ninho", "Angèle", "Stromae",
  "Gazo", "Orelsan", "Soprano", "Indila", "Maître Gims",
];

const InfosPage = () => {
  const { play, setQueue } = usePlayerStore();

  // Top French artists via search
  const { data: frenchArtists, isLoading: loadingArtists } = useQuery({
    queryKey: ["french-artists-chart"],
    queryFn: async () => {
      const results: DeezerArtist[] = [];
      for (const name of frenchArtistQueries) {
        try {
          const data = await callDeezer({ action: "search", query: name, limit: 1 });
          const track = data.data?.[0];
          if (track?.artist) {
            const artistData = await callDeezer({ action: "artist", id: track.artist.id });
            results.push(artistData);
          }
        } catch { /* skip */ }
      }
      return results.sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0));
    },
    staleTime: 15 * 60 * 1000,
  });

  // French top tracks (search "top france")
  const { data: frenchTracks, isLoading: loadingTracks } = useQuery({
    queryKey: ["french-top-tracks"],
    queryFn: async () => {
      const data = await callDeezer({ action: "search", query: "top france 2025", limit: 15 });
      return (data.data || []).map(mapTrackToSong);
    },
    staleTime: 10 * 60 * 1000,
  });

  // French rap tracks
  const { data: rapTracks, isLoading: loadingRap } = useQuery({
    queryKey: ["french-rap-tracks"],
    queryFn: async () => {
      const data = await callDeezer({ action: "search", query: "rap français 2025", limit: 10 });
      return (data.data || []).map(mapTrackToSong);
    },
    staleTime: 10 * 60 * 1000,
  });

  // French pop
  const { data: popTracks, isLoading: loadingPop } = useQuery({
    queryKey: ["french-pop-tracks"],
    queryFn: async () => {
      const data = await callDeezer({ action: "search", query: "pop française variété", limit: 10 });
      return (data.data || []).map(mapTrackToSong);
    },
    staleTime: 10 * 60 * 1000,
  });

  const handlePlayTrack = (song: Song, allSongs: Song[]) => {
    setQueue(allSongs);
    play(song);
  };

  const handleArtistClick = async (artistId: number) => {
    try {
      const data = await callDeezer({ action: "artist_top", id: artistId, limit: 10 });
      const songs = (data.data || []).map(mapTrackToSong);
      if (songs.length > 0) {
        setQueue(songs);
        play(songs[0]);
      }
    } catch (e) {
      console.error("Failed to load artist tracks:", e);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-6 md:p-10 mb-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
        <div className="relative z-10">
          <p className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Tendances musicales
          </p>
          <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-2">
            🇫🇷 Musique Française
          </h1>
          <p className="text-muted-foreground max-w-md">
            Artistes populaires, hits du moment et classements français.
          </p>
        </div>
      </motion.div>

      {/* Top French Artists */}
      <section className="mb-10">
        <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Artistes Français Populaires
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {loadingArtists
            ? Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
            : frenchArtists?.slice(0, 10).map((artist) => (
                <motion.div
                  key={artist.id}
                  whileHover={{ scale: 1.03 }}
                  className="glass-panel-light rounded-xl p-3 cursor-pointer text-center transition-all hover:bg-secondary/60"
                  onClick={() => handleArtistClick(artist.id)}
                >
                  <img
                    src={artist.picture_medium || artist.picture_big}
                    alt={artist.name}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full mx-auto mb-3 object-cover ring-2 ring-primary/20"
                  />
                  <p className="font-medium text-sm text-foreground truncate">{artist.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFans(artist.nb_fan || 0)}</p>
                </motion.div>
              ))}
        </div>
      </section>

      {/* Top FR Tracks */}
      <section className="mb-10">
        <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Hits Français du Moment
        </h2>
        <div className="glass-panel-light rounded-xl p-2">
          {loadingTracks
            ? Array.from({ length: 6 }).map((_, i) => <SongSkeleton key={i} />)
            : frenchTracks?.slice(0, 8).map((song, i) => (
                <div key={song.id} onClick={() => handlePlayTrack(song, frenchTracks)}>
                  <SongCard song={song} index={i} showIndex />
                </div>
              ))}
        </div>
      </section>

      {/* Rap FR */}
      <section className="mb-10">
        <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Music2 className="w-5 h-5 text-primary" /> Rap Français
        </h2>
        <div className="glass-panel-light rounded-xl p-2">
          {loadingRap
            ? Array.from({ length: 4 }).map((_, i) => <SongSkeleton key={i} />)
            : rapTracks?.slice(0, 6).map((song, i) => (
                <div key={song.id} onClick={() => handlePlayTrack(song, rapTracks)}>
                  <SongCard song={song} index={i} showIndex />
                </div>
              ))}
        </div>
      </section>

      {/* Pop/Variété FR */}
      <section className="mb-10">
        <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Disc3 className="w-5 h-5 text-primary" /> Pop & Variété Française
        </h2>
        <div className="glass-panel-light rounded-xl p-2">
          {loadingPop
            ? Array.from({ length: 4 }).map((_, i) => <SongSkeleton key={i} />)
            : popTracks?.slice(0, 6).map((song, i) => (
                <div key={song.id} onClick={() => handlePlayTrack(song, popTracks)}>
                  <SongCard song={song} index={i} showIndex />
                </div>
              ))}
        </div>
      </section>
    </div>
  );
};

export default InfosPage;
