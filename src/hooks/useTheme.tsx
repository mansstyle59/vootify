import { createContext, useContext, ReactNode } from "react";

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
  // Always dark — no light mode
  const root = document.documentElement;
  root.classList.remove("light");
  if (!root.classList.contains("dark")) root.classList.add("dark");

  return (
    <ThemeContext.Provider value={{ theme: "dark", resolved: "dark", setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}
