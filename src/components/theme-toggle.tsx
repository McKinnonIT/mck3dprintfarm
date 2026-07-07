"use client";

import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const LABELS = {
  light: "Light",
  dim: "Dim",
  dark: "Dark",
} as const;

// Heroicons has no half-shaded "dim" glyph, so this fills the right half
// of the same circle-plus-rays sun/moon silhouette convention by hand -
// small enough not to be worth a dependency.
function DimIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, cycleTheme } = useTheme();
  const Icon = theme === "light" ? SunIcon : theme === "dim" ? DimIcon : MoonIcon;

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`Appearance: ${LABELS[theme]} - click to switch`}
      aria-label={`Appearance: ${LABELS[theme]}. Click to switch theme.`}
      className={cn(
        "rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
