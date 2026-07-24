"use client";

import React from "react";
import { FILAMENT_MATERIALS, FILAMENT_COLOR_PRESETS, HEX_COLOR_PATTERN, isValidHex } from "@/lib/filament-options";

const SELECT_CLASSNAME =
  "mt-1 block w-full rounded-md border border-border bg-background text-foreground px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

type FilamentMaterialSelectProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

export function FilamentMaterialSelect({ id, value, onChange }: FilamentMaterialSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASSNAME}
    >
      <option value="">No material set</option>
      {FILAMENT_MATERIALS.map((material) => (
        <option key={material} value={material}>
          {material}
        </option>
      ))}
    </select>
  );
}

type FilamentColorPickerProps = {
  idPrefix: string;
  value: string;
  onChange: (hex: string) => void;
};

export function FilamentColorPicker({ idPrefix, value, onChange }: FilamentColorPickerProps) {
  const presetHex = isValidHex(value) ? value.toLowerCase() : "";
  const matchesPreset = FILAMENT_COLOR_PRESETS.some((p) => p.hex.toLowerCase() === presetHex);

  return (
    <div className="mt-1 space-y-2">
      <select
        id={`${idPrefix}-preset`}
        value={matchesPreset ? presetHex : ""}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        className={SELECT_CLASSNAME}
      >
        <option value="">Custom colour...</option>
        {FILAMENT_COLOR_PRESETS.map((preset) => (
          <option key={preset.hex} value={preset.hex}>
            {preset.name}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <input
          type="color"
          id={`${idPrefix}-swatch`}
          value={isValidHex(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Filament colour swatch"
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-border bg-background p-0.5"
        />
        <input
          type="text"
          id={`${idPrefix}-hex`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB (optional)"
          pattern={HEX_COLOR_PATTERN}
          title="Hex colour, e.g. #FF5733"
          className="block w-full rounded-md border border-border bg-background text-foreground px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
