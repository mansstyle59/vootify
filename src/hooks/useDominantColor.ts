import { useState, useEffect } from "react";

/**
 * Extracts the dominant color from an image URL using a canvas.
 * Returns an HSL-like string suitable for CSS backgrounds.
 */
export function useDominantColor(imageUrl: string | undefined): string | null {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) { setColor(null); return; }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 50; // small for speed
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        // Weighted average skipping very dark/bright pixels
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          const brightness = (pr + pg + pb) / 3;
          if (brightness > 20 && brightness < 230) {
            r += pr; g += pg; b += pb; count++;
          }
        }

        if (count === 0) { setColor(null); return; }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Boost saturation slightly for a richer look
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2 / 255;
        let s = 0;
        if (max !== min) {
          s = l > 0.5 ? (max - min) / (2 * 255 - max - min) : (max - min) / (max + min);
        }
        let h = 0;
        if (max !== min) {
          if (max === r) h = ((g - b) / (max - min)) % 6;
          else if (max === g) h = (b - r) / (max - min) + 2;
          else h = (r - g) / (max - min) + 4;
          h = Math.round(h * 60);
          if (h < 0) h += 360;
        }

        // Clamp lightness to keep it moody (15-35%)
        const finalL = Math.max(12, Math.min(30, Math.round(l * 100)));
        const finalS = Math.max(30, Math.min(80, Math.round(s * 100 * 1.3)));

        setColor(`hsl(${h}, ${finalS}%, ${finalL}%)`);
      } catch {
        setColor(null);
      }
    };

    img.onerror = () => setColor(null);
  }, [imageUrl]);

  return color;
}
