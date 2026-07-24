export const FILAMENT_MATERIALS = [
  "PLA",
  "PETG",
  "ABS",
  "ASA",
  "PA (Nylon)",
  "PC (Polycarbonate)",
  "PEEK",
  "HIPS",
  "TPE",
  "TPU",
  "PVA",
  "PP (Polypropylene)",
] as const;

export const FILAMENT_COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Grey", hex: "#808080" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Red", hex: "#E53935" },
  { name: "Orange", hex: "#FB8C00" },
  { name: "Yellow", hex: "#FDD835" },
  { name: "Green", hex: "#43A047" },
  { name: "Blue", hex: "#1E88E5" },
  { name: "Purple", hex: "#8E24AA" },
  { name: "Pink", hex: "#EC407A" },
  { name: "Brown", hex: "#6D4C41" },
  { name: "Gold", hex: "#D4AF37" },
  { name: "Natural", hex: "#F0E6D2" },
];

export const HEX_COLOR_PATTERN = "^#([0-9A-Fa-f]{6})$";

export function isValidHex(value: string | null | undefined): value is string {
  return !!value && /^#[0-9a-f]{6}$/i.test(value);
}

export function hexToColorName(hex: string | null | undefined): string | null {
  if (!isValidHex(hex)) return null;
  const match = FILAMENT_COLOR_PRESETS.find((p) => p.hex.toLowerCase() === hex.toLowerCase());
  return match ? match.name : null;
}
