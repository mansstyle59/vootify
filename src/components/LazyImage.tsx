import { useState, useCallback, useEffect, ImgHTMLAttributes } from "react";
import { Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { offlineCache } from "@/lib/offlineCache";

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
 * offline cache resolution, and optional music-icon fallback.
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
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState(src);

  // Resolve cover from offline cache if songId provided
  useEffect(() => {
    setResolvedSrc(src);
    setErrored(false);
    setLoaded(false);

    if (!songId) return;

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
      }
    }).catch(() => {});

    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [songId, src]);

  // On network error, try offline cache as fallback
  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (songId && resolvedSrc === src) {
        // Try offline cache before giving up
        offlineCache.getCachedCoverUrl(songId).then((cached) => {
          if (cached) {
            setResolvedSrc(cached);
          } else {
            setErrored(true);
          }
        }).catch(() => setErrored(true));
      } else {
        setErrored(true);
      }
      onError?.(e);
    },
    [onError, songId, resolvedSrc, src]
  );

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true);
      onLoad?.(e);
    },
    [onLoad]
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
    <img
      src={resolvedSrc || src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={handleLoad}
      onError={handleError}
      className={cn(
        "transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
      {...props}
    />
  );
}
