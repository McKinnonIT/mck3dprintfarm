/**
 * Which resolved OrcaSlicer settings show under each tab in the Slice
 * panel. Confirmed against a real `--export-settings` export (OrcaSlicer
 * 2.4.1, Bambu A1 profiles) - every field below was present with a
 * sensible value. Values come back as a mix of numbers, percentage
 * strings ("20%"), and enum strings ("no ironing") - render/edit them as
 * plain text, don't assume a type.
 *
 * Single source of truth: used both by the resolve-settings API route (to
 * shape its response) and the Files-page Slice panel (to render it).
 */
export const SLICER_SETTING_CATEGORIES = {
  Quality: ["layer_height", "initial_layer_print_height", "line_width", "seam_position", "ironing_type"],
  Strength: ["wall_loops", "top_shell_layers", "bottom_shell_layers", "sparse_infill_density", "sparse_infill_pattern"],
  Supports: ["enable_support", "support_type", "support_style", "support_threshold_angle", "support_interface_top_layers"],
  Other: ["skirt_loops", "brim_type", "brim_width", "fuzzy_skin", "default_acceleration"],
} as const;

export type SlicerSettingCategory = keyof typeof SLICER_SETTING_CATEGORIES;

export function categorizeSettings(resolved: Record<string, unknown>): Record<SlicerSettingCategory, Record<string, unknown>> {
  const result = {} as Record<SlicerSettingCategory, Record<string, unknown>>;
  for (const category of Object.keys(SLICER_SETTING_CATEGORIES) as SlicerSettingCategory[]) {
    result[category] = {};
    for (const field of SLICER_SETTING_CATEGORIES[category]) {
      result[category][field] = resolved[field];
    }
  }
  return result;
}
