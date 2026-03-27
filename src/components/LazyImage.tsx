import { useState, useCallback, ImgHTMLAttributes } from "react";
import { Music } from "lucide-react";
import { cn } from "@/lib/utils";

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Show music icon placeholder on error/missing src */
  fallback?: boolean;
  /** Additional wrapper class (only used when fallback enabled) */
  wrapperClassName?: string;
}

/**
 * Lazy-loaded image with native loading="lazy", fade-in on load,
 * and optional music-icon fallback for missing covers.
 */
export function LazyImage({
  src,
  alt,
  className,
  fallback = true,
  wrapperClassName,
  onLoad,
  onError,
  ...props
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true);
      onLoad?.(e);
    },
    [onLoad]
  );

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setErrored(true);
      onError?.(e);
    },
    [onError]
  );

  if (!src || errored) {
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
      src={src}
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
