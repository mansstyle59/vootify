import { Play, Shuffle, Download, Loader2 } from "lucide-react";
import React from "react";

/* ── Shared glass button styles ── */
const glassStyle: React.CSSProperties = {
  background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.25))",
  backdropFilter: "blur(24px) saturate(1.6)",
  WebkitBackdropFilter: "blur(24px) saturate(1.6)",
  border: "0.5px solid hsl(var(--foreground) / 0.06)",
  boxShadow:
    "0 2px 8px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.04)",
};

const primaryStyle: React.CSSProperties = {
  background: "linear-gradient(145deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))",
  color: "hsl(var(--primary-foreground))",
  boxShadow:
    "0 4px 16px hsl(var(--primary) / 0.3), inset 0 0.5px 0 hsl(0 0% 100% / 0.15)",
};

const btnBase =
  "flex items-center justify-center gap-2 rounded-full font-semibold text-sm active:scale-[0.97] transition-all disabled:opacity-40";

interface ActionBarProps {
  onPlay: () => void;
  onShuffle: () => void;
  onDownload?: () => void;
  downloading?: boolean;
  disabled?: boolean;
  /** Extra icon buttons rendered after download */
  extra?: React.ReactNode;
  /** Compact variant for library sections */
  compact?: boolean;
}

export function ActionBar({
  onPlay,
  onShuffle,
  onDownload,
  downloading,
  disabled,
  extra,
  compact,
}: ActionBarProps) {
  const py = compact ? "py-2.5" : "py-3.5";
  const iconSize = compact ? "w-4 h-4" : "w-5 h-5";
  const fontSize = compact ? "text-[12px]" : "text-sm";

  return (
    <div className="flex items-center gap-3">
      {/* ▶ Lecture — primary filled */}
      <button
        onClick={onPlay}
        disabled={disabled}
        className={`flex-1 ${btnBase} ${py} ${fontSize}`}
        style={primaryStyle}
      >
        <Play className={`${iconSize} fill-current`} />
        Lecture
      </button>

      {/* 🔀 Aléatoire — glass */}
      <button
        onClick={onShuffle}
        disabled={disabled}
        className={`flex-1 ${btnBase} ${py} ${fontSize} text-foreground`}
        style={glassStyle}
      >
        <Shuffle className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        Aléatoire
      </button>

      {/* ⬇ Download — glass icon-only */}
      {onDownload && (
        <button
          onClick={onDownload}
          disabled={downloading || disabled}
          className={`${compact ? "p-2.5" : "p-3.5"} rounded-full transition-all active:scale-[0.95] text-muted-foreground hover:text-primary disabled:opacity-40`}
          style={glassStyle}
        >
          {downloading ? (
            <Loader2 className={`${iconSize} animate-spin text-primary`} />
          ) : (
            <Download className={iconSize} />
          )}
        </button>
      )}

      {extra}
    </div>
  );
}
