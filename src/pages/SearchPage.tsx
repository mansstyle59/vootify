import { useState, useMemo } from "react";
import { songs, albums, radioStations } from "@/data/mockData";
import { SongCard, ContentCard } from "@/components/MusicCards";
import { usePlayerStore } from "@/stores/playerStore";
import { Search as SearchIcon, X } from "lucide-react";
import { motion } from "framer-motion";

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const { play, setQueue } = usePlayerStore();

  const results = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return {
      songs: songs.filter(
        (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
      ),
      albums: albums.filter(
        (a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
      ),
      radio: radioStations.filter(
        (r) => r.name.toLowerCase().includes(q) || r.genre.toLowerCase().includes(q)
      ),
    };
  }, [query]);

  const genres = ["Electronic", "Indie", "Lo-Fi", "Hip Hop", "Classical", "Rock", "Pop", "Jazz"];

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      <div className="relative mb-8">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists, radio..."
          className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!results ? (
        <div>
          <h2 className="text-xl font-display font-semibold text-foreground mb-4">Browse Genres</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {genres.map((genre, i) => (
              <motion.button
                key={genre}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setQuery(genre)}
                className="glass-panel-light rounded-xl p-6 text-left hover-glass"
              >
                <span className="font-display font-semibold text-foreground">{genre}</span>
              </motion.button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {results.songs.length > 0 && (
            <section>
              <h2 className="text-lg font-display font-semibold text-foreground mb-3">Songs</h2>
              <div className="glass-panel-light rounded-xl p-2">
                {results.songs.map((song, i) => (
                  <SongCard key={song.id} song={song} index={i} />
                ))}
              </div>
            </section>
          )}
          {results.albums.length > 0 && (
            <section>
              <h2 className="text-lg font-display font-semibold text-foreground mb-3">Albums</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {results.albums.map((album) => (
                  <ContentCard
                    key={album.id}
                    title={album.title}
                    subtitle={album.artist}
                    imageUrl={album.coverUrl}
                    onClick={() => {
                      const albumSongs = songs.filter((s) => album.songs.includes(s.id));
                      if (albumSongs.length) { setQueue(albumSongs); play(albumSongs[0]); }
                    }}
                  />
                ))}
              </div>
            </section>
          )}
          {results.radio.length > 0 && (
            <section>
              <h2 className="text-lg font-display font-semibold text-foreground mb-3">Radio Stations</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {results.radio.map((r) => (
                  <ContentCard key={r.id} title={r.name} subtitle={r.genre} imageUrl={r.coverUrl} />
                ))}
              </div>
            </section>
          )}
          {results.songs.length === 0 && results.albums.length === 0 && results.radio.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No results found for "{query}"</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
