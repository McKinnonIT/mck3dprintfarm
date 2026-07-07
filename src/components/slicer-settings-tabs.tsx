"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { SLICER_SETTING_CATEGORIES, SlicerSettingCategory } from "@/lib/slicer-setting-categories";

type SettingsByCategory = Record<SlicerSettingCategory, Record<string, unknown>>;

interface SlicerSettingsTabsProps {
  categories: SettingsByCategory;
  editable?: boolean;
  onFieldChange?: (category: SlicerSettingCategory, field: string, value: string) => void;
}

// Quality/Strength/Supports/Other tabs over the curated OrcaSlicer settings
// (see src/lib/slicer-setting-categories.ts) - read-only for reviewing a
// resolved profile, or editable for "Custom Settings" / creating a new
// Slicing Profile. Shared by the Files-page Slice panel and the Settings
// page's Create Slicing Profile modal.
export function SlicerSettingsTabs({ categories, editable = false, onFieldChange }: SlicerSettingsTabsProps) {
  const categoryNames = Object.keys(SLICER_SETTING_CATEGORIES) as SlicerSettingCategory[];

  return (
    <Tabs defaultValue="Quality" className="pt-2">
      <TabsList className="grid w-full grid-cols-4">
        {categoryNames.map((category) => (
          <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
        ))}
      </TabsList>
      {categoryNames.map((category) => (
        <TabsContent key={category} value={category} className="space-y-3 pt-2">
          {SLICER_SETTING_CATEGORIES[category].map((field) => {
            const value = categories[category]?.[field];
            return (
              <div key={field} className="grid grid-cols-2 items-center gap-4">
                <Label htmlFor={`field-${category}-${field}`} className="font-mono text-xs text-muted-foreground">
                  {field}
                </Label>
                {editable ? (
                  <input
                    id={`field-${category}-${field}`}
                    type="text"
                    value={value === undefined || value === null ? "" : String(value)}
                    onChange={(e) => onFieldChange?.(category, field, e.target.value)}
                    className="rounded-md border border-border bg-background text-foreground px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <span className="text-sm">{value === undefined || value === null ? "-" : String(value)}</span>
                )}
              </div>
            );
          })}
        </TabsContent>
      ))}
    </Tabs>
  );
}
