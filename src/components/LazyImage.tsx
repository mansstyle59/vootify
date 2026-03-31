import { useState, useCallback, useEffect, useRef, ImgHTMLAttributes } from "react";
import { Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { offlineCache } from "@/lib/offlineCache";
import { getCachedCover, setCachedCover, markCoverLoaded, isCoverLoaded } from "@/lib/coverMemoryCache";

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Show music icon placeholder on error/missing src */
  fallback?: boolean;
  /** Additional wrapper class (only used when fallback enabled) */
  wrapperClassName?: string;
  /** If provided, will try to resolve cover from offline cache */
  songId?: string;
}

/**
 * Lazy-loaded image with native loading="lazy", fade-in on load,
 * in-memory LRU cache, offline cache resolution, shimmer skeleton,
 * and optional music-icon fallback.
 */
export function LazyImage({
  src,
  alt,
  className,
  fallback = true,
  wrapperClassName,
  songId,
  onLoad,
  onError,
  ...props
}: LazyImageProps) {
  const cacheKey = songId || src || "";
  const memCached = cacheKey ? getCachedCover(cacheKey) : null;
  const alreadyLoaded = cacheKey ? isCoverLoaded(cacheKey) : false;

  const [loaded, setLoaded] = useState(alreadyLoaded);
  const [errored, setErrored] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState(memCached || src);
  const imgRef = useRef<HTMLImageElement>(null);

  // Resolve cover from offline cache if songId provided
  useEffect(() => {
    const memHit = cacheKey ? getCachedCover(cacheKey) : null;
    if (memHit) {
      setResolvedSrc(memHit);
      setLoaded(isCoverLoaded(cacheKey));
      setErrored(false);
      return;
    }

    setResolvedSrc(src);
    setErrored(false);
    setLoaded(false);

    if (!songId) {
      // Cache the network URL for future hits
      if (src && cacheKey) setCachedCover(cacheKey, src);
      return;
    }

    let revoked = false;
    let blobUrl: string | null = null;

    offlineCache.getCachedCoverUrl(songId).then((cached) => {
      if (revoked) {
        if (cached) URL.revokeObjectURL(cached);
        return;
      }
      if (cached) {
        blobUrl = cached;
        setResolvedSrc(cached);
        setCachedCover(cacheKey, cached);
      } else if (src) {
        setCachedCover(cacheKey, src);
      }
    }).catch(() => {});

    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [songId, src, cacheKey]);

  // On network error, try offline cache as fallback
  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (songId && resolvedSrc === src) {
        offlineCache.getCachedCoverUrl(songId).then((cached) => {
          if (cached) {
            setResolvedSrc(cached);
            setCachedCover(cacheKey, cached);
          } else {
            setErrored(true);
          }
        }).catch(() => setErrored(true));
      } else {
        setErrored(true);
      }
      onError?.(e);
    },
    [onError, songId, resolvedSrc, src, cacheKey]
  );

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true);
      if (cacheKey) markCoverLoaded(cacheKey);
      onLoad?.(e);
    },
    [onLoad, cacheKey]
  );

  if ((!resolvedSrc && !src) || errored) {
    if (!fallback) return null;
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5",
          wrapperClassName || className
        )}
      >
        <Music className="w-1/3 h-1/3 text-primary/40" />
      </div>
    );
  }

  return (
    <>
      {/* Shimmer skeleton while loading */}
      {!loaded && (
        <div
          className={cn("absolute inset-0 overflow-hidden", className)}
          style={{ background: "hsl(var(--foreground) / 0.04)" }}
          aria-hidden
        >
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        </div>
      )}
      <img
        ref={imgRef}
        src={resolvedSrc || src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        {...props}
      />
    </>
  );
}
