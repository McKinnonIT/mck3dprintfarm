"use client";

import React, { Suspense, useMemo, useEffect, useRef, useState } from "react";
import { Canvas, useLoader, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Center, Bounds, useBounds, Line, Text, PivotControls } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import * as THREE from "three";
import { GCodeLoader } from "three/examples/jsm/loaders/GCodeLoader";

type BuildVolume = {
  width: number;
  depth: number;
  height: number;
};

export type PlateObject = {
  /** Stable key for this plate entry (not necessarily unique per fileId, in case a file is ever added twice). */
  id: string;
  fileId: string;
  fileName: string;
  positionX: number;
  positionZ: number;
  rotationXDegrees: number;
  rotationYDegrees: number;
  rotationZDegrees: number;
  /** Assigned once when added to the plate so it doesn't shift if other objects are removed. */
  color: string;
};

export type PlateObjectTransform = {
  positionX: number;
  positionZ: number;
  rotationXDegrees: number;
  rotationYDegrees: number;
  rotationZDegrees: number;
};

type FileViewer3DProps = {
  // Single-file mode (used by the standalone read-only preview modal) - a
  // plain fileId/fileName with no gizmo, no plate objects.
  fileId?: string;
  fileName?: string;
  // Multi-object plate mode (used by the Files-page Slice panel) - each
  // object is independently draggable/rotatable via a PivotControls gizmo
  // when selected.
  objects?: PlateObject[];
  selectedObjectId?: string | null;
  onSelectObject?: (id: string) => void;
  onTransformChange?: (id: string, transform: PlateObjectTransform) => void;
  /** When set, that object is in "Place on Face" mode - hovering highlights
   * the triangle under the cursor, clicking rests the model on it. */
  pickingFaceObjectId?: string | null;
  onFacePicked?: (id: string) => void;
  /** Reports whether an object's footprint currently fits on the bed - the
   * Files page uses this to block slicing while anything hangs over the edge. */
  onBoundsChange?: (id: string, inBounds: boolean) => void;
  /** The selected printer's bed size/height, if known - draws a build plate under the model(s). */
  buildVolume?: BuildVolume | null;
};

// Loads the STL and converts its Z-up (slicer convention) coordinates to
// Three.js's Y-up. Used for the simple, non-interactive single-file
// preview - centers the footprint and rests it on the floor once, since
// there's no rotation control to keep it in sync with.
function useFloorRestedGeometry(fileUrl: string) {
  const rawGeometry = useLoader(STLLoader, fileUrl);
  return useMemo(() => {
    const geo = rawGeometry.clone();
    geo.rotateX(-Math.PI / 2);
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const centerX = (box.min.x + box.max.x) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;
    geo.translate(-centerX, -box.min.y, -centerZ);
    return geo;
  }, [rawGeometry]);
}

// Same Z-up -> Y-up conversion, but centered on ALL three axes (not just
// footprint + floor) so the origin is the model's true geometric center -
// a stable rotation pivot regardless of which way it's currently turned.
// Used for plate objects, where "resting on the floor" has to be
// recomputed live as the user rotates the model on any axis.
function useCenteredGeometry(fileUrl: string) {
  const rawGeometry = useLoader(STLLoader, fileUrl);
  return useMemo(() => {
    const geo = rawGeometry.clone();
    geo.rotateX(-Math.PI / 2);
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const centerX = (box.min.x + box.max.x) / 2;
    const centerY = (box.min.y + box.max.y) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;
    geo.translate(-centerX, -centerY, -centerZ);
    geo.computeBoundingBox();
    return geo;
  }, [rawGeometry]);
}

function StlModel({ fileUrl, onClick }: { fileUrl: string; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const geometry = useFloorRestedGeometry(fileUrl);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x007bff }), []);
  return <mesh geometry={geometry} material={material} onClick={onClick} />;
}

// The model's footprint/height once rotated, computed by walking every
// vertex - exact regardless of shape, unlike transforming just the
// bounding box's 8 corners (a valid lower bound, since the box is the
// convex hull of its corners and rotation preserves convex combinations,
// but not a TIGHT one for anything that isn't box-shaped - it left a
// visible gap above the plate for the common case of a wheel, a dome,
// anything whose actual lowest point isn't near a corner of its own
// bounding box). STL meshes are small enough that this is cheap even
// redone on every rotation change. restOffsetY is how far below its own
// center the lowest point sits (used to rest it on the plate); minX/maxX/
// minZ/maxZ are the rotated footprint, used for the build-plate bounds
// check (still relative to the object's own center - the caller adds its
// position to get the real footprint on the bed).
function useTransformedFootprint(geometry: THREE.BufferGeometry, euler: THREE.Euler) {
  return useMemo(() => {
    const position = geometry.getAttribute("position");
    if (!position) return { restOffsetY: 0, minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    const v = new THREE.Vector3();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < position.count; i++) {
      v.set(position.getX(i), position.getY(i), position.getZ(i)).applyEuler(euler);
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.z < minZ) minZ = v.z;
      if (v.z > maxZ) maxZ = v.z;
    }
    return { restOffsetY: -minY, minX, maxX, minZ, maxZ };
  }, [geometry, euler]);
}

// Highlights whichever triangle is currently under the cursor while
// picking a face to rest the model on - a lightweight overlay mesh
// tracking just those 3 vertices, rendered on top (depthTest disabled) to
// avoid z-fighting with the coplanar triangle underneath it.
function FaceHighlight({ geometry, faceIndex }: { geometry: THREE.BufferGeometry; faceIndex: number | null }) {
  const highlightGeometry = useMemo(() => {
    if (faceIndex === null) return null;
    const position = geometry.getAttribute("position");
    const i = faceIndex * 3;
    if (i + 2 >= position.count) return null;
    const verts = new Float32Array(9);
    for (let k = 0; k < 3; k++) {
      verts[k * 3] = position.getX(i + k);
      verts[k * 3 + 1] = position.getY(i + k);
      verts[k * 3 + 2] = position.getZ(i + k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    return geo;
  }, [geometry, faceIndex]);

  if (!highlightGeometry) return null;
  return (
    <mesh geometry={highlightGeometry} renderOrder={999}>
      <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} depthTest={false} transparent opacity={0.85} />
    </mesh>
  );
}

// The rotation that lays a given (local-space) face normal flat against
// the plate, facing down - the same "shortest arc" rotation real slicers
// use for their own Place on Face tool. There are infinitely many
// rotations that satisfy "this normal points down" (they differ by a
// spin around the down axis itself); setFromUnitVectors picks the one
// with no extra unnecessary twist, which is as good a default as any.
function rotationDegreesFromFaceNormal(localNormal: THREE.Vector3): PlateObjectTransform {
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    localNormal.clone().normalize(),
    new THREE.Vector3(0, -1, 0)
  );
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  const toDegrees = (rad: number) => (THREE.MathUtils.radToDeg(rad) + 360) % 360;
  return {
    positionX: 0,
    positionZ: 0,
    rotationXDegrees: toDegrees(euler.x),
    rotationYDegrees: toDegrees(euler.y),
    rotationZDegrees: toDegrees(euler.z),
  };
}

// One plate entry: a group positioned/rotated per its React-state
// transform, wrapped in a PivotControls gizmo when selected. Translation
// is constrained to the ground plane (X/Z) - height is never directly
// settable, it's always derived from the current rotation via
// useRestOffsetY so the model stays resting on the plate no matter how
// it's turned. Rotation is free on all three axes, for orienting a model
// however prints best - either by dragging the gizmo's ring, or exactly
// via "Place on Face".
function PlateModel({
  object,
  isSelected,
  isPickingFace,
  buildVolume,
  onSelect,
  onTransformChange,
  onFacePicked,
  onBoundsChange,
}: {
  object: PlateObject;
  isSelected: boolean;
  isPickingFace: boolean;
  buildVolume?: BuildVolume | null;
  onSelect?: () => void;
  onTransformChange?: (transform: PlateObjectTransform) => void;
  onFacePicked?: () => void;
  onBoundsChange?: (inBounds: boolean) => void;
}) {
  const fileUrl = `/api/files/preview/${object.fileId}`;
  const geometry = useCenteredGeometry(fileUrl);
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const [hoveredFaceIndex, setHoveredFaceIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isPickingFace) setHoveredFaceIndex(null);
  }, [isPickingFace]);

  const euler = useMemo(
    () =>
      new THREE.Euler(
        THREE.MathUtils.degToRad(object.rotationXDegrees),
        THREE.MathUtils.degToRad(object.rotationYDegrees),
        THREE.MathUtils.degToRad(object.rotationZDegrees),
        "XYZ"
      ),
    [object.rotationXDegrees, object.rotationYDegrees, object.rotationZDegrees]
  );
  const footprint = useTransformedFootprint(geometry, euler);
  const { restOffsetY } = footprint;

  const isOutOfBounds = useMemo(() => {
    if (!buildVolume) return false;
    const halfW = buildVolume.width / 2;
    const halfD = buildVolume.depth / 2;
    return (
      object.positionX + footprint.minX < -halfW ||
      object.positionX + footprint.maxX > halfW ||
      object.positionZ + footprint.minZ < -halfD ||
      object.positionZ + footprint.maxZ > halfD
    );
  }, [buildVolume, object.positionX, object.positionZ, footprint]);

  useEffect(() => {
    onBoundsChange?.(!isOutOfBounds);
  }, [isOutOfBounds, onBoundsChange]);

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: isOutOfBounds ? "#ef4444" : object.color }),
    [object.color, isOutOfBounds]
  );

  // PivotControls (autoTransform) applies the drag delta to its OWN
  // internal wrapper group, which is groupRef's *parent* - not to groupRef
  // itself. So groupRef.position/rotation never change from a drag; they
  // always read back whatever React last set them to. The actual dragged
  // result only shows up in the combined world transform. Read it via
  // matrixWorld, commit it as the new absolute state, then zero out
  // PivotControls' own matrix - otherwise its accumulated drag offset
  // would still be sitting on the parent and get added a second time on
  // top of the new state-driven position next render.
  const handleDragEnd = () => {
    const group = groupRef.current;
    const pivot = pivotRef.current;
    if (!group || !pivot || !onTransformChange) return;
    group.updateWorldMatrix(true, false);
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    group.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
    const worldEuler = new THREE.Euler().setFromQuaternion(worldQuaternion, "XYZ");
    const toDegrees = (rad: number) => (THREE.MathUtils.radToDeg(rad) + 360) % 360;
    onTransformChange({
      positionX: worldPosition.x,
      positionZ: worldPosition.z,
      rotationXDegrees: toDegrees(worldEuler.x),
      rotationYDegrees: toDegrees(worldEuler.y),
      rotationZDegrees: toDegrees(worldEuler.z),
    });
    pivot.matrix.identity();
  };

  const handleFaceClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!e.face || !onTransformChange) return;
    const rotation = rotationDegreesFromFaceNormal(e.face.normal);
    onTransformChange({ ...rotation, positionX: object.positionX, positionZ: object.positionZ });
    onFacePicked?.();
  };

  // PivotControls owns its wrapped children's transform once mounted
  // (autoTransform) - conditionally rendering it only while selected meant
  // remounting it fresh on every selection change, which discarded
  // whatever transform it had last applied. Keep it always mounted for
  // every object and just toggle `enabled` instead, so its internal state
  // (and therefore the model's position) survives switching selection.
  // Disabled entirely while picking a face so its handles don't compete
  // with clicking the model itself.
  return (
    <PivotControls
      ref={pivotRef}
      enabled={isSelected && !isPickingFace}
      activeAxes={[true, true, true]}
      // All three rotation rings need all three axes "active" (see drei's
      // own gating logic - each ring shows only when its OTHER two axes
      // are active) - translationLimits then locks out actual vertical
      // movement so the Y arrow/plane-sliders that come along with that
      // are present but inert, never letting the model lift off the plate.
      translationLimits={[undefined, [0, 0], undefined]}
      disableScaling
      depthTest={false}
      // Anchored to the top of the model's bounding box (anchor's Y=1 is
      // the max-Y face) rather than its base, where it was easy to lose
      // against the model or the plate. `fixed` + `scale` (a pixel radius,
      // not a world-space size) keeps it comfortably large on screen no
      // matter how big or small the selected model or how far the camera
      // has zoomed to fit it.
      anchor={[0, 1, 0]}
      fixed
      scale={120}
      onDragEnd={handleDragEnd}
    >
      <group
        ref={groupRef}
        position={[object.positionX, restOffsetY, object.positionZ]}
        rotation={[euler.x, euler.y, euler.z]}
      >
        {isPickingFace ? (
          <>
            <mesh
              geometry={geometry}
              material={material}
              onPointerMove={(e) => {
                e.stopPropagation();
                setHoveredFaceIndex(e.faceIndex ?? null);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoveredFaceIndex(null);
              }}
              onClick={handleFaceClick}
            />
            <FaceHighlight geometry={geometry} faceIndex={hoveredFaceIndex} />
          </>
        ) : (
          <mesh
            geometry={geometry}
            material={material}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
          />
        )}
      </group>
    </PivotControls>
  );
}

// Component to load and display G-code
function GCodeModel({ fileUrl }: { fileUrl: string }) {
  // Load G-code using THREE.GCodeLoader
  // Note: GCodeLoader returns a Group containing LineSegments
  const gcodeObject = useLoader(GCodeLoader, fileUrl);

  useEffect(() => {
    // Optional: Center the loaded G-code object
    // This can be tricky as GCodeLoader might not provide a standard bounding box
    if (gcodeObject) {
      // You might need custom logic here to find the center based on line segments
      // For now, let's rely on the <Center> component in the parent
       console.log("G-code loaded by GCodeLoader:", gcodeObject);
    }
  }, [gcodeObject]);

  // GCodeLoader returns a Group, which can be rendered directly
  return <primitive object={gcodeObject} />;
}

// Flat plate matching the printer's bed footprint, plus a wireframe box
// showing its max build height - the same visual language desktop slicers
// (OrcaSlicer, Cura, PrusaSlicer) use for their build volume.
function BuildPlate({ width, depth, height }: BuildVolume) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const corners: [number, number, number][] = [
    [-halfW, 0, -halfD],
    [halfW, 0, -halfD],
    [halfW, 0, halfD],
    [-halfW, 0, halfD],
    [-halfW, 0, -halfD],
  ];

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onClick={(e) => e.stopPropagation()}
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#d4d4d8" side={THREE.DoubleSide} />
      </mesh>
      <Line points={corners} color="#71717a" lineWidth={1.5} />
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color="#71717a" wireframe transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

// <Bounds> (with `observe`) only recomputes its camera fit on mount or
// canvas resize - never when its children change (confirmed by reading
// drei's source: the effect's dependency array is [size, clip, fit,
// observe, camera, controls], with no `children`). The Slice panel always
// opens with no printer selected yet, so the very first fit happens
// before the build plate exists at all - picking a printer afterward (or
// adding another model) then never re-frames the camera, leaving
// everything positioned correctly but visually stranded outside the
// original framing. Refit explicitly whenever the plate's actual content
// changes instead of relying on <Bounds>'s own (mount-only) behavior.
function AutoRefit({ dep }: { dep: string }) {
  const bounds = useBounds();
  useEffect(() => {
    bounds.refresh().fit().clip();
  }, [dep, bounds]);
  return null;
}

// Main viewer component setting up the scene
export function FileViewer3D({
  fileId,
  fileName,
  objects,
  selectedObjectId,
  onSelectObject,
  onTransformChange,
  pickingFaceObjectId,
  onFacePicked,
  onBoundsChange,
  buildVolume,
}: FileViewer3DProps) {
  const isMultiObject = Array.isArray(objects);
  const fileUrl = fileId ? `/api/files/preview/${fileId}` : null;
  const fileExtension = fileName?.split('.').pop()?.toLowerCase();

  return (
    <div className="w-full h-[500px] bg-muted rounded">
      <Canvas camera={{ position: [0, 100, 150], fov: 50 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={0.5} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />

        <Suspense fallback={<Center><Text>Loading...</Text></Center>}>
          <Bounds fit clip observe margin={1.3}>
            {isMultiObject ? (
              <>
                <AutoRefit dep={`${buildVolume?.width}x${buildVolume?.depth}-${objects!.length}`} />
                {objects!.map((object) => (
                  <PlateModel
                    key={object.id}
                    object={object}
                    isSelected={object.id === selectedObjectId}
                    isPickingFace={object.id === pickingFaceObjectId}
                    buildVolume={buildVolume}
                    onSelect={() => onSelectObject?.(object.id)}
                    onTransformChange={(t) => onTransformChange?.(object.id, t)}
                    onFacePicked={() => onFacePicked?.(object.id)}
                    onBoundsChange={(inBounds) => onBoundsChange?.(object.id, inBounds)}
                  />
                ))}
                {buildVolume && <BuildPlate {...buildVolume} />}
              </>
            ) : fileExtension === 'stl' && fileUrl ? (
              <>
                <AutoRefit dep={`${buildVolume?.width}x${buildVolume?.depth}`} />
                <StlModel fileUrl={fileUrl} />
                {buildVolume && <BuildPlate {...buildVolume} />}
              </>
            ) : (fileExtension === 'gcode' || fileExtension === 'bgcode') && fileUrl ? (
              <Center><GCodeModel fileUrl={fileUrl} /></Center>
            ) : (
              <Center><Text>Unsupported file type for 3D preview</Text></Center>
            )}
          </Bounds>
        </Suspense>

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
