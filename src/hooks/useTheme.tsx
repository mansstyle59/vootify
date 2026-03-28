import { createContext, useContext, ReactNode, useEffect } from "react";
import { useThemeSettings, DEFAULT_THEME } from "@/hooks/useAppSettings";

type Theme = "dark";

interface ThemeContextType {
  theme: Theme;
  resolved: "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  resolved: "dark",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: themeSettings } = useThemeSettings();

  // Always dark — no light mode
  const root = document.documentElement;
  root.classList.remove("light");
  if (!root.classList.contains("dark")) root.classList.add("dark");

  // Apply dynamic theme colors from admin settings
  useEffect(() => {
    if (!themeSettings) return;
    const t = themeSettings;
    const style = root.style;

    style.setProperty("--primary", `${t.primaryHue} ${t.primarySaturation}% ${t.primaryLightness}%`);
    style.setProperty("--primary-foreground", `${t.backgroundHue} ${t.backgroundSaturation}% ${t.backgroundLightness}%`);
    style.setProperty("--accent", `${t.accentHue} ${t.accentSaturation}% ${t.accentLightness}%`);
    style.setProperty("--accent-foreground", `${t.accentHue} ${t.accentSaturation}% 72%`);
    style.setProperty("--background", `${t.backgroundHue} ${t.backgroundSaturation}% ${t.backgroundLightness}%`);
    style.setProperty("--ring", `${t.primaryHue} ${t.primarySaturation}% ${t.primaryLightness}%`);
    style.setProperty("--sidebar-primary", `${t.primaryHue} ${t.primarySaturation}% ${t.primaryLightness}%`);
    style.setProperty("--sidebar-ring", `${t.primaryHue} ${t.primarySaturation}% ${t.primaryLightness}%`);

    // Update font if set
    if (t.fontFamily && t.fontFamily !== DEFAULT_THEME.fontFamily) {
      document.body.style.fontFamily = `'${t.fontFamily}', system-ui, -apple-system, sans-serif`;
    } else {
      document.body.style.fontFamily = "";
    }
  }, [themeSettings, root]);

  return (
    <ThemeContext.Provider value={{ theme: "dark", resolved: "dark", setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}
