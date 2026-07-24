"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { PlusIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { SlicerSettingsTabs } from "@/components/slicer-settings-tabs";
import { FileViewer3D, PlateObject, PlateObjectTransform } from "@/components/file-viewer-3d";
import { SlicerSettingCategory } from "@/lib/slicer-setting-categories";

const CUSTOM_SETTINGS_VALUE = "__custom__";
type SettingsByCategory = Record<SlicerSettingCategory, Record<string, unknown>>;

// Assigned to plate objects in order, one per model - red is reserved for
// flagging an object that's hanging off the edge of the build plate, so
// it's deliberately excluded here. Cycles if there are ever more objects
// on one plate than colors.
const PLATE_OBJECT_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f97316", // orange
  "#14b8a6", // teal
  "#ec4899", // pink
  "#eab308", // yellow
  "#06b6d4", // cyan
  "#6366f1", // indigo
  "#84cc16", // lime
];
function nextPlateObjectColor(existingCount: number): string {
  return PLATE_OBJECT_COLORS[existingCount % PLATE_OBJECT_COLORS.length];
}

type FilamentProfile = {
  id: string;
  name: string;
};

type SlicingProfile = {
  id: string;
  name: string;
};

type MachineProfile = {
  id: string;
  name: string;
  // Empty = unrestricted (every Slicing Profile in the library is usable).
  allowedSlicingProfiles: { id: string }[];
  buildVolume?: { width: number; depth: number; height: number } | null;
  hasBedStl?: boolean;
};

export interface SlicePanelFile {
  id: string;
  name: string;
}

export interface SlicePanelProps {
  // The pool of the user's files that can be added to the plate ("+ Add
  // Model") - filtered down to STL internally, same restriction as
  // build-combined-3mf.ts.
  files: SlicePanelFile[];
  // Seeds the plate with this one file already placed, matching a "Slice"
  // click from the Files page. Omit to start from a completely blank plate.
  initialFile?: SlicePanelFile | null;
  // Case-insensitive substring matched against Machine Profile name to
  // auto-select one once the list loads - e.g. "prusa" for a page that
  // should default to a Prusa bed rather than force the user to pick one
  // first.
  defaultMachineProfileQuery?: string;
  onSliced: (result: { fileName: string }) => void;
  // Renders a Cancel button next to Slice when provided.
  onCancel?: () => void;
}

export function SlicePanel({ files, initialFile = null, defaultMachineProfileQuery, onSliced, onCancel }: SlicePanelProps) {
  const [filamentProfiles, setFilamentProfiles] = useState<FilamentProfile[]>([]);
  const [slicingProfiles, setSlicingProfiles] = useState<SlicingProfile[]>([]);
  const [machineProfiles, setMachineProfiles] = useState<MachineProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);

  const [plateObjects, setPlateObjects] = useState<PlateObject[]>(() =>
    initialFile
      ? [
          {
            id: initialFile.id,
            fileId: initialFile.id,
            fileName: initialFile.name,
            positionX: 0,
            positionZ: 0,
            rotationXDegrees: 0,
            rotationYDegrees: 0,
            rotationZDegrees: 0,
            color: nextPlateObjectColor(0),
          },
        ]
      : []
  );
  const [selectedPlateObjectId, setSelectedPlateObjectId] = useState<string | null>(initialFile?.id ?? null);
  const [pickingFaceObjectId, setPickingFaceObjectId] = useState<string | null>(null);
  const [outOfBoundsObjectIds, setOutOfBoundsObjectIds] = useState<Set<string>>(new Set());
  const [isAddModelModalOpen, setIsAddModelModalOpen] = useState(false);
  const [isCombining, setIsCombining] = useState(false);
  const [selectedMachineProfileId, setSelectedMachineProfileId] = useState<string>("");
  const [selectedFilamentProfileId, setSelectedFilamentProfileId] = useState<string>("");
  const [selectedSlicingProfileSelection, setSelectedSlicingProfileSelection] = useState<string>("");
  const [lastRealSlicingProfileId, setLastRealSlicingProfileId] = useState<string>("");
  const [resolvedCategories, setResolvedCategories] = useState<SettingsByCategory | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<SettingsByCategory | null>(null);
  const [isSlicing, setIsSlicing] = useState(false);
  const [sliceError, setSliceError] = useState<string | null>(null);

  const isCustomSettings = selectedSlicingProfileSelection === CUSTOM_SETTINGS_VALUE;

  // Only Slicing Profiles the selected Machine Profile allows - an empty
  // allow-list means unrestricted (show the whole library).
  const selectedMachineProfile = machineProfiles.find((mp) => mp.id === selectedMachineProfileId);
  const availableSlicingProfiles = (() => {
    const allowed = selectedMachineProfile?.allowedSlicingProfiles;
    if (!allowed || allowed.length === 0) return slicingProfiles;
    const allowedIds = new Set(allowed.map((p) => p.id));
    return slicingProfiles.filter((p) => allowedIds.has(p.id));
  })();

  const resolveBaseSlicingProfileId = isCustomSettings
    ? lastRealSlicingProfileId || availableSlicingProfiles[0]?.id || ""
    : selectedSlicingProfileSelection;
  const activeCategoryValues = isCustomSettings ? customValues : resolvedCategories;

  // Files that can be added onto the same plate for a combined slice - STL
  // only (see build-combined-3mf.ts), and not already placed.
  const plateFileIds = new Set(plateObjects.map((o) => o.fileId));
  const addableFiles = files.filter((f) => f.name.toLowerCase().endsWith(".stl") && !plateFileIds.has(f.id));

  // Fetch filament/slicing/machine profiles once on mount, then
  // auto-select a Machine Profile matching `defaultMachineProfileQuery` if
  // nothing else has picked one yet - lets a caller (e.g. the standalone
  // Slicer page) start the user on a specific bed instead of an empty
  // dropdown.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProfiles(true);
      setProfilesError(null);
      try {
        const [filamentRes, slicingRes, machineRes] = await Promise.all([
          fetch("/api/filament-profiles"),
          fetch("/api/slicing-profiles"),
          fetch("/api/machine-profiles"),
        ]);
        if (!filamentRes.ok) throw new Error("Failed to fetch filament profiles");
        if (!slicingRes.ok) throw new Error("Failed to fetch slicing profiles");
        if (!machineRes.ok) throw new Error("Failed to fetch machine profiles");
        const [filamentData, slicingData, machineData]: [
          FilamentProfile[],
          SlicingProfile[],
          MachineProfile[]
        ] = await Promise.all([filamentRes.json(), slicingRes.json(), machineRes.json()]);
        if (cancelled) return;
        setFilamentProfiles(filamentData);
        setSlicingProfiles(slicingData);
        setMachineProfiles(machineData);

        if (defaultMachineProfileQuery) {
          const query = defaultMachineProfileQuery.toLowerCase();
          const match = machineData.find((mp) => mp.name.toLowerCase().includes(query));
          if (match) setSelectedMachineProfileId(match.id);
        }
      } catch (err) {
        if (!cancelled) setProfilesError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally runs once per mount - a caller that needs a different
    // starting file/printer remounts this component (e.g. Files page keys
    // its dialog's SlicePanel by file id) rather than updating it in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectPlateObject = (id: string) => {
    setSelectedPlateObjectId(id);
    setPickingFaceObjectId(null);
  };

  const handleAddModelToPlate = (file: SlicePanelFile) => {
    // Small default offset so a newly-added object doesn't start stacked
    // exactly on top of an existing one - the drag gizmo takes it from there.
    const offset = plateObjects.length * 30;
    const newObject: PlateObject = {
      id: `${file.id}-${Date.now()}`,
      fileId: file.id,
      fileName: file.name,
      positionX: offset,
      positionZ: 0,
      rotationXDegrees: 0,
      rotationYDegrees: 0,
      rotationZDegrees: 0,
      color: nextPlateObjectColor(plateObjects.length),
    };
    setPlateObjects((prev) => [...prev, newObject]);
    setSelectedPlateObjectId(newObject.id);
    setIsAddModelModalOpen(false);
  };

  const handleRemoveFromPlate = (id: string) => {
    setPlateObjects((prev) => prev.filter((o) => o.id !== id));
    setSelectedPlateObjectId((prev) => (prev === id ? null : prev));
    setOutOfBoundsObjectIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handlePlateObjectBoundsChange = (id: string, inBounds: boolean) => {
    setOutOfBoundsObjectIds((prev) => {
      const isCurrentlyOut = prev.has(id);
      if (inBounds === !isCurrentlyOut) return prev;
      const next = new Set(prev);
      if (inBounds) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePlateObjectTransformChange = (id: string, transform: PlateObjectTransform) => {
    setPlateObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...transform } : o)));
  };

  const handleSlicingProfileSelectionChange = (value: string) => {
    setSelectedSlicingProfileSelection(value);
    if (value !== CUSTOM_SETTINGS_VALUE) {
      setLastRealSlicingProfileId(value);
    }
  };

  const handleCustomFieldChange = (category: SlicerSettingCategory, field: string, value: string) => {
    setCustomValues((prev) => ({
      Quality: {},
      Strength: {},
      Supports: {},
      Other: {},
      ...prev,
      [category]: { ...(prev?.[category] || {}), [field]: value },
    }));
  };

  // resolve-settings just needs SOME real file's path for the sidecar call
  // (it doesn't depend on which model is on the plate) - the first object
  // is as good a representative as any, matching how the slice submission
  // itself falls back to it for a single-object plate.
  const representativeFileId = plateObjects[0]?.fileId;

  // Resolve the effective settings whenever machine/filament/slicing-profile selection is complete.
  useEffect(() => {
    if (!representativeFileId || !selectedMachineProfileId || !selectedFilamentProfileId || !resolveBaseSlicingProfileId) {
      return;
    }
    let cancelled = false;
    setIsResolving(true);
    setResolveError(null);
    (async () => {
      try {
        const response = await fetch(`/api/files/${representativeFileId}/resolve-settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            machineProfileId: selectedMachineProfileId,
            filamentProfileId: selectedFilamentProfileId,
            slicingProfileId: resolveBaseSlicingProfileId,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to resolve settings");
        if (cancelled) return;
        setResolvedCategories(data.categories);
        setCustomValues(data.categories);
      } catch (err) {
        if (!cancelled) setResolveError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [representativeFileId, selectedMachineProfileId, selectedFilamentProfileId, resolveBaseSlicingProfileId]);

  const handleSubmitSlice = async () => {
    if (!selectedMachineProfileId || !selectedFilamentProfileId || !resolveBaseSlicingProfileId || plateObjects.length === 0) {
      return;
    }
    setIsSlicing(true);
    setSliceError(null);
    try {
      let targetFileId = plateObjects[0].fileId;
      let targetFileName = plateObjects[0].fileName;
      let preArranged = false;

      // More than one object on the plate - combine them into a single
      // .3mf carrying each object's chosen position/rotation, and slice
      // that instead. A single object skips this entirely and slices the
      // original file directly, exactly as before this feature existed.
      if (plateObjects.length > 1) {
        setIsCombining(true);
        const combineResponse = await fetch("/api/files/combine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objects: plateObjects.map((o) => ({
              fileId: o.fileId,
              positionX: o.positionX,
              positionZ: o.positionZ,
              rotationXDegrees: o.rotationXDegrees,
              rotationYDegrees: o.rotationYDegrees,
              rotationZDegrees: o.rotationZDegrees,
            })),
            bedWidth: selectedMachineProfile?.buildVolume?.width,
            bedDepth: selectedMachineProfile?.buildVolume?.depth,
          }),
        });
        const combineData = await combineResponse.json();
        setIsCombining(false);
        if (!combineResponse.ok) {
          throw new Error(combineData.error || "Failed to combine models onto one plate");
        }
        targetFileId = combineData.id;
        targetFileName = combineData.name;
        preArranged = true;
      }

      const response = await fetch(`/api/files/${targetFileId}/slice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineProfileId: selectedMachineProfileId,
          filamentProfileId: selectedFilamentProfileId,
          slicingProfileId: resolveBaseSlicingProfileId,
          overrides: isCustomSettings ? customValues : undefined,
          preArranged,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to slice file");
      }
      onSliced({ fileName: targetFileName });
    } catch (err) {
      setSliceError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsSlicing(false);
      setIsCombining(false);
    }
  };

  return (
    <div className="space-y-4">
      <FileViewer3D
        objects={plateObjects}
        selectedObjectId={selectedPlateObjectId}
        onSelectObject={handleSelectPlateObject}
        onTransformChange={handlePlateObjectTransformChange}
        pickingFaceObjectId={pickingFaceObjectId}
        onFacePicked={() => setPickingFaceObjectId(null)}
        onBoundsChange={handlePlateObjectBoundsChange}
        buildVolume={selectedMachineProfile?.buildVolume}
        bedStlUrl={selectedMachineProfile?.hasBedStl ? `/api/machine-profiles/${selectedMachineProfile.id}/bed-stl` : null}
      />

      {selectedMachineProfile?.buildVolume && (
        <p className="text-xs text-muted-foreground">
          Build plate: {selectedMachineProfile.buildVolume.width} × {selectedMachineProfile.buildVolume.depth} mm
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {plateObjects.map((object) => (
          <Badge
            key={object.id}
            variant={object.id === selectedPlateObjectId ? "default" : "outline"}
            className="cursor-pointer gap-1.5"
            onClick={() => handleSelectPlateObject(object.id)}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: outOfBoundsObjectIds.has(object.id) ? "#ef4444" : object.color }}
            />
            {object.fileName}
            <span className="text-xs opacity-70 tabular-nums">
              ({Math.round(object.positionX)}, {Math.round(object.positionZ)})
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFromPlate(object.id);
              }}
              className="ml-1 text-xs opacity-70 hover:opacity-100"
              aria-label={`Remove ${object.fileName} from plate`}
            >
              ×
            </button>
          </Badge>
        ))}
        <Button variant="outline" size="sm" onClick={() => setIsAddModelModalOpen(true)} disabled={isSlicing}>
          <PlusIcon className="h-4 w-4 mr-1" /> Add Model
        </Button>
        {pickingFaceObjectId ? (
          <Button variant="outline" size="sm" onClick={() => setPickingFaceObjectId(null)}>
            Cancel
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedPlateObjectId && setPickingFaceObjectId(selectedPlateObjectId)}
            disabled={isSlicing || !selectedPlateObjectId}
          >
            Place on Face
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {plateObjects.length === 0
          ? 'Click "Add Model" to place one of your files on the build plate.'
          : pickingFaceObjectId
          ? "Click a highlighted face on the model to rest it flat on that side."
          : "Click a model (in the list above or in the 3D view) to select it, then drag its arrows/plane to move it, drag its ring to spin it, or use \"Place on Face\" to rest it exactly on a chosen surface."}
      </p>

      {outOfBoundsObjectIds.size > 0 && (
        <p className="text-sm text-red-600">
          {outOfBoundsObjectIds.size === 1 ? "A model" : "Some models"} extend past the edge of the build plate
          (shown in red) - move {outOfBoundsObjectIds.size === 1 ? "it" : "them"} fully onto the plate before
          slicing.
        </p>
      )}

      {profilesError && <p className="text-sm text-red-600">Error: {profilesError}</p>}
      {sliceError && <p className="text-sm text-red-600">Error: {sliceError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label htmlFor="slice-machine-profile">Machine Profile</Label>
          <select
            id="slice-machine-profile"
            value={selectedMachineProfileId}
            onChange={(e) => setSelectedMachineProfileId(e.target.value)}
            className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isSlicing || loadingProfiles}
          >
            <option value="">-- Select Machine Profile --</option>
            {machineProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="slice-filament">Filament</Label>
          <select
            id="slice-filament"
            value={selectedFilamentProfileId}
            onChange={(e) => setSelectedFilamentProfileId(e.target.value)}
            className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isSlicing || loadingProfiles}
          >
            <option value="">-- Select Filament --</option>
            {filamentProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="slice-slicing-profile">Slicing Profile</Label>
          <select
            id="slice-slicing-profile"
            value={selectedSlicingProfileSelection}
            onChange={(e) => handleSlicingProfileSelectionChange(e.target.value)}
            className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isSlicing || availableSlicingProfiles.length === 0}
          >
            <option value="">-- Select Slicing Profile --</option>
            {availableSlicingProfiles.length > 0 && <option value={CUSTOM_SETTINGS_VALUE}>Custom Settings</option>}
            {availableSlicingProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {availableSlicingProfiles.length === 0 && (
        <p className="text-sm text-amber-600">
          {slicingProfiles.length === 0
            ? 'No Slicing Profiles are available yet - even "Custom Settings" needs one as a starting point. Import an OrcaSlicer bundle or create one from Settings → Slicer Profiles.'
            : "This Machine Profile doesn't allow any of the Slicing Profiles in your library yet - manage its allow-list from Settings → Slicer Profiles."}
        </p>
      )}

      {resolveError && <p className="text-sm text-red-600">Error: {resolveError}</p>}
      {isResolving && <p className="text-sm text-muted-foreground">Resolving print settings...</p>}

      {activeCategoryValues && (
        <SlicerSettingsTabs categories={activeCategoryValues} editable={isCustomSettings} onFieldChange={handleCustomFieldChange} />
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isSlicing}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmitSlice}
          disabled={
            isSlicing ||
            isResolving ||
            !selectedMachineProfileId ||
            !selectedFilamentProfileId ||
            !resolveBaseSlicingProfileId ||
            plateObjects.length === 0 ||
            outOfBoundsObjectIds.size > 0
          }
        >
          {isSlicing ? (
            <>
              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" /> {isCombining ? "Combining..." : "Slicing..."}
            </>
          ) : (
            "Slice"
          )}
        </Button>
      </div>

      {/* Add another model onto the same plate for one combined slice */}
      <Dialog open={isAddModelModalOpen} onOpenChange={setIsAddModelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Model to Plate</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 max-h-80 overflow-y-auto">
            {addableFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other STL models available to add - upload one first.</p>
            ) : (
              addableFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">{file.name}</span>
                  <Button size="sm" variant="outline" onClick={() => handleAddModelToPlate(file)}>
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModelModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
