import { readFile } from "fs/promises";
import AdmZip from "adm-zip";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { Euler, Matrix4, MathUtils } from "three";

export interface PlacedObject {
  absolutePath: string;
  /** Ground-plane position in the viewer's display space (X right, Z "forward"). */
  positionX: number;
  positionZ: number;
  /** Rotation in the viewer's display space (Y-up), in degrees, Euler order XYZ. */
  rotationXDegrees: number;
  rotationYDegrees: number;
  rotationZDegrees: number;
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;

// The viewer displays models in Three.js's Y-up convention (STL/3MF's own
// native "up" axis is Z), converted via a fixed -90 degree rotation about
// X - i.e. v_display = R_CONV * v_native for R_CONV = rotationX(-90deg). A
// rotation the user applies in DISPLAY space doesn't carry over as the
// same-looking rotation in NATIVE space directly (only true for a pure
// Y-axis spin, which is all the earlier single-axis version needed) - for
// arbitrary XYZ rotation it has to be conjugated into native space:
// M_native = R_CONV^-1 * M_display * R_CONV. This is the standard
// change-of-basis formula for expressing the same linear transform under
// a different coordinate frame.
const R_CONV = new Matrix4().makeRotationX(-Math.PI / 2);
const R_CONV_INV = R_CONV.clone().invert();

// 3MF's transform attribute is row-major, applied to a ROW vector on the
// left (v' = v * M), while Three.js's Matrix4 is column-major and applies
// to a COLUMN vector on the left (v' = M * v) - so the matrix that
// produces the same result under 3MF's convention is the transpose.
// Column-major storage of M^T, read sequentially, is exactly the row-major
// reading of M itself - i.e. row r of the output is
// [elements[r*4], elements[r*4+1], elements[r*4+2]].
function matrix3RowMajor(m: Matrix4): number[] {
  const e = m.elements;
  return [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]];
}

// Ground-plane position re-centers from the viewer's bed-centered origin
// into the bed's own corner-origin coordinate system (printable_area is a
// polygon like "0x0,120x0,120x120,0x120", not centered on 0,0 - confirmed
// empirically: centered-relative coordinates placed objects entirely
// off-bed and OrcaSlicer refused to slice at all). Height is left to
// OrcaSlicer's own auto-drop-onto-bed behavior, confirmed to always place
// objects flat on the plate regardless of what we pass here.
function buildTransformAttr(
  positionX: number,
  positionZ: number,
  rotationXDegrees: number,
  rotationYDegrees: number,
  rotationZDegrees: number,
  bedWidth: number,
  bedDepth: number
): string {
  const displayEuler = new Euler(
    MathUtils.degToRad(rotationXDegrees),
    MathUtils.degToRad(rotationYDegrees),
    MathUtils.degToRad(rotationZDegrees),
    "XYZ"
  );
  const rotationDisplay = new Matrix4().makeRotationFromEuler(displayEuler);
  const rotationNative = R_CONV_INV.clone().multiply(rotationDisplay).multiply(R_CONV);

  const rows = matrix3RowMajor(rotationNative);
  const translation = [positionX + bedWidth / 2, -positionZ + bedDepth / 2, 0];
  return [...rows, ...translation].map((n) => String(n)).join(" ");
}

function meshXmlFromStl(buffer: Buffer): string {
  const arrayBuffer = new Uint8Array(buffer).buffer;
  const geometry = new STLLoader().parse(arrayBuffer);
  const position = geometry.getAttribute("position");
  const vertexCount = position.count;

  // Many uploaded STLs aren't authored centered at their own origin - the
  // viewer always shows each model with its own footprint AND height
  // centered on its geometric middle (see useCenteredGeometry in
  // file-viewer-3d.tsx, needed as a stable pivot once rotation isn't
  // limited to a single axis), so the per-item transform below must
  // rotate/place around THAT same center, not whatever arbitrary point
  // the file's own local origin happens to be.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < vertexCount; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const vertexLines: string[] = [];
  for (let i = 0; i < vertexCount; i++) {
    const x = position.getX(i) - centerX;
    const y = position.getY(i) - centerY;
    const z = position.getZ(i) - centerZ;
    vertexLines.push(`<vertex x="${x}" y="${y}" z="${z}"/>`);
  }

  // STL geometry from STLLoader is non-indexed - every 3 consecutive
  // vertices form one triangle, with no vertex sharing. Fine for 3MF too;
  // no need to dedupe.
  const triangleLines: string[] = [];
  for (let i = 0; i < vertexCount; i += 3) {
    triangleLines.push(`<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}"/>`);
  }

  return `<mesh><vertices>${vertexLines.join("")}</vertices><triangles>${triangleLines.join("")}</triangles></mesh>`;
}

/**
 * Builds a minimal .3mf package placing each object's STL mesh (copied
 * verbatim, no coordinate changes) at its own position/rotation via a
 * per-item build transform - this is the format OrcaSlicer's CLI reads
 * and slices at exactly the given placement when passed `--arrange 0`,
 * confirmed empirically against the real binary.
 */
export async function buildCombined3mf(
  objects: PlacedObject[],
  bed: { width: number; depth: number }
): Promise<Buffer> {
  if (objects.length < 2) {
    throw new Error("buildCombined3mf requires at least 2 objects");
  }

  const objectXmlParts: string[] = [];
  const buildItemParts: string[] = [];

  for (let i = 0; i < objects.length; i++) {
    const objectId = i + 1;
    const fileBuffer = await readFile(objects[i].absolutePath);
    const meshXml = meshXmlFromStl(fileBuffer);
    objectXmlParts.push(`<object id="${objectId}" type="model">${meshXml}</object>`);
    const transform = buildTransformAttr(
      objects[i].positionX,
      objects[i].positionZ,
      objects[i].rotationXDegrees,
      objects[i].rotationYDegrees,
      objects[i].rotationZDegrees,
      bed.width,
      bed.depth
    );
    buildItemParts.push(`<item objectid="${objectId}" transform="${transform}"/>`);
  }

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>${objectXmlParts.join("")}</resources>
  <build>${buildItemParts.join("")}</build>
</model>
`;

  const zip = new AdmZip();
  zip.addFile("[Content_Types].xml", Buffer.from(CONTENT_TYPES_XML, "utf8"));
  zip.addFile("_rels/.rels", Buffer.from(RELS_XML, "utf8"));
  zip.addFile("3D/3dmodel.model", Buffer.from(modelXml, "utf8"));
  return zip.toBuffer();
}
