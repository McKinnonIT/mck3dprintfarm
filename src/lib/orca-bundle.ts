import AdmZip from "adm-zip";
import path from "path";

export interface ParsedBundleEntry {
  name: string;
  filename: string;
  json: string;
}

export interface ParsedOrcaBundle {
  machines: ParsedBundleEntry[];
  filaments: ParsedBundleEntry[];
  processes: ParsedBundleEntry[];
}

/**
 * Parses a real OrcaSlicer "Export Config Bundle" (.orca_printer) file - a
 * ZIP archive with printer/, filament/, process/ folders and a
 * bundle_structure.json manifest listing which entries belong to which
 * category. Confirmed against a real user-exported bundle: printer/
 * usually has exactly one entry, filament/ commonly has many, process/ can
 * be empty (users often rely on bundled system presets for process
 * settings and only export their tuned machine + filaments).
 */
export function parseOrcaBundle(buffer: Buffer): ParsedOrcaBundle {
  const zip = new AdmZip(buffer);

  const manifestEntry = zip.getEntry("bundle_structure.json");
  if (!manifestEntry) {
    throw new Error("Not a valid OrcaSlicer config bundle: missing bundle_structure.json");
  }
  const manifest = JSON.parse(zip.readAsText(manifestEntry));

  const readEntries = (paths: string[] = []): ParsedBundleEntry[] =>
    paths.map((entryPath) => {
      const entry = zip.getEntry(entryPath);
      if (!entry) {
        throw new Error(`Bundle manifest references missing entry: ${entryPath}`);
      }
      const json = zip.readAsText(entry);
      let name: string;
      try {
        name = JSON.parse(json).name || path.basename(entryPath, ".json");
      } catch {
        name = path.basename(entryPath, ".json");
      }
      return { name, filename: path.basename(entryPath), json };
    });

  return {
    machines: readEntries(manifest.printer_config),
    filaments: readEntries(manifest.filament_config),
    processes: readEntries(manifest.process_config),
  };
}
