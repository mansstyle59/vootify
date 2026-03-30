import { Play, Shuffle, Download, Loader2 } from "lucide-react";
import React from "react";

/* ── Shared glass button styles ── */
const glassStyle: React.CSSProperties = {
  background: "linear-gradient(145deg, hsl(var(--card) / 0.55), hsl(var(--card) / 0.3))",
  backdropFilter: "blur(24px) saturate(1.6)",
  WebkitBackdropFilter: "blur(24px) saturate(1.6)",
  border: "0.5px solid hsl(var(--foreground) / 0.06)",
  boxShadow:
    "0 2px 8px hsl(0 0% 0% / 0.12), inset 0 0.5px 0 hsl(var(--foreground) / 0.04)",
};

const primaryStyle: React.CSSProperties = {
  background: "linear-gradient(145deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))",
  color: "hsl(var(--primary-foreground))",
  boxShadow:
    "0 4px 16px hsl(var(--primary) / 0.35), inset 0 0.5px 0 hsl(0 0% 100% / 0.15)",
};

interface ActionBarProps {
  onPlay: () => void;
  onShuffle: () => void;
  onDownload?: () => void;
  downloading?: boolean;
  disabled?: boolean;
  extra?: React.ReactNode;
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
  const h = compact ? "h-11" : "h-[52px]";
  const iconSize = compact ? "w-4 h-4" : "w-[18px] h-[18px]";
  const fontSize = compact ? "text-[13px]" : "text-[15px]";
  const circleSize = compact ? "w-11 h-11" : "w-[52px] h-[52px]";

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {/* ▶ Lecture — primary pill */}
      <button
        onClick={onPlay}
        disabled={disabled}
        className={`flex items-center justify-center gap-2 ${h} px-6 rounded-full font-bold ${fontSize} shrink-0 active:scale-[0.96] transition-transform disabled:opacity-40`}
        style={primaryStyle}
      >
        <Play className={`${iconSize} fill-current`} />
        Lecture
      </button>

      {/* 🔀 Aléatoire — glass pill */}
      <button
        onClick={onShuffle}
        disabled={disabled}
        className={`flex items-center justify-center gap-2 ${h} px-5 rounded-full font-semibold ${fontSize} text-foreground shrink-0 active:scale-[0.96] transition-transform disabled:opacity-40`}
        style={glassStyle}
      >
        <Shuffle className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        Aléatoire
      </button>

      {/* ⬇ Download — glass circle */}
      {onDownload && (
        <button
          onClick={onDownload}
          disabled={downloading || disabled}
          className={`${circleSize} shrink-0 flex items-center justify-center rounded-full transition-transform active:scale-[0.93] text-muted-foreground hover:text-primary disabled:opacity-40`}
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
