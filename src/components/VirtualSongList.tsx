import { useRef, useCallback, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SongCard } from "@/components/MusicCards";
import type { Song } from "@/data/mockData";

const ROW_HEIGHT = 56; // px – matches SongCard py-2.5 + gap

interface VirtualSongListProps {
  songs: Song[];
  showIndex?: boolean;
  onClickSong?: (song: Song, index: number) => void;
  /** Render a wrapper around each SongCard row (e.g. for drag handles, delete buttons) */
  renderRow?: (song: Song, index: number, songCard: ReactNode) => ReactNode;
  /** Extra element rendered after the last row (e.g. infinite scroll sentinel) */
  footer?: ReactNode;
  className?: string;
}

export function VirtualSongList({
  songs,
  showIndex,
  onClickSong,
  renderRow,
  footer,
  className,
}: VirtualSongListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: songs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  });

  const items = virtualizer.getVirtualItems();

  const handleClick = useCallback(
    (song: Song, i: number) => {
      onClickSong?.(song, i);
    },
    [onClickSong]
  );

  // For short lists (< 80), skip virtualization overhead
  if (songs.length < 80) {
    return (
      <div className={className}>
        {songs.map((song, i) => {
          const card = (
            <div
              key={song.id}
              onClick={() => handleClick(song, i)}
              className="border-b border-white/[0.04] last:border-b-0"
            >
              <SongCard song={song} index={i} showIndex={showIndex} />
            </div>
          );
          return renderRow ? (
            <div key={song.id}>{renderRow(song, i, <SongCard song={song} index={i} showIndex={showIndex} />)}</div>
          ) : (
            card
          );
        })}
        {footer}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={className}
      style={{ maxHeight: "calc(100vh - 200px)", overflow: "auto" }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((virtualRow) => {
          const song = songs[virtualRow.index];
          const i = virtualRow.index;
          const songCard = (
            <SongCard song={song} index={i} showIndex={showIndex} />
          );

          return (
            <div
              key={song.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onClick={() => handleClick(song, i)}
              className="border-b border-white/[0.04]"
            >
              {renderRow ? renderRow(song, i, songCard) : songCard}
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
