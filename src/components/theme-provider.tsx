"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dim" | "dark";
const THEMES: Theme[] = ["light", "dim", "dark"];
const STORAGE_KEY = "theme";

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "dim");
  if (theme !== "light") root.classList.add(theme);
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Reads the class the inline boot script (see layout.tsx) already applied
// before hydration, rather than defaulting to "light" and flashing - the
// script and this provider must agree on the same storage key/classes.
function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (document.documentElement.classList.contains("dim")) return "dim";
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    setThemeState(readInitialTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can throw in locked-down browser contexts - theme just
      // won't persist across reloads, not worth surfacing to the user.
    }
    applyThemeClass(next);
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  }, [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

// Inlined into <head> in layout.tsx so the right class is on <html> before
// first paint - without this there's a flash of the light theme on every
// load for anyone who's picked dim or dark.
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='dark'||t==='dim')document.documentElement.classList.add(t);}catch(e){}})();`;
