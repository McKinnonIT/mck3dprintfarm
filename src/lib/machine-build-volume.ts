export interface BuildVolume {
  width: number;
  depth: number;
  height: number;
}

/**
 * Derives a rectangular build volume from an OrcaSlicer machine profile's
 * printable_area (a polygon as ["0x0","250x0","250x210","0x210"]) and
 * printable_height. Uses the polygon's bounding box rather than its exact
 * shape - matches how desktop slicers draw the plate, and covers non-
 * rectangular beds (round, etc.) with a reasonable approximation.
 */
export function computeBuildVolume(machineJson: string): BuildVolume | null {
  try {
    const parsed = JSON.parse(machineJson);
    const areaPoints = parsed.printable_area;
    const height = parseFloat(parsed.printable_height);
    if (!Array.isArray(areaPoints) || areaPoints.length === 0 || !Number.isFinite(height)) {
      return null;
    }

    const xs: number[] = [];
    const ys: number[] = [];
    for (const point of areaPoints) {
      const [xStr, yStr] = String(point).split("x");
      const x = parseFloat(xStr);
      const y = parseFloat(yStr);
      if (Number.isFinite(x)) xs.push(x);
      if (Number.isFinite(y)) ys.push(y);
    }
    if (xs.length === 0 || ys.length === 0) return null;

    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...ys) - Math.min(...ys);
    if (width <= 0 || depth <= 0) return null;

    return { width, depth, height };
  } catch {
    return null;
  }
}
