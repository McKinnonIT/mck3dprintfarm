import React from "react";
import { hexToColorName, isValidHex } from "@/lib/filament-options";

export function MaterialChip({ material }: { material: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
      {material}
    </span>
  );
}

export function ColorChip({ hex }: { hex: string }) {
  const label = hexToColorName(hex) ?? hex.toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
      <span
        className="h-2.5 w-2.5 rounded-full border border-border"
        style={isValidHex(hex) ? { backgroundColor: hex } : undefined}
      />
      {label}
    </span>
  );
}
