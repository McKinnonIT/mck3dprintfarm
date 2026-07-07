// Minimal headless slicing HTTP server, driven against
// lscr.io/linuxserver/orcaslicer's bundled OrcaSlicer CLI binary.
//
// Confirmed empirically (see docker/orcaslicer/README.md for the spike
// notes) against OrcaSlicer 2.4.1:
//   - The binary at /opt/orcaslicer/bin/orca-slicer runs headlessly with
//     no missing libraries and no display/GPU - thumbnail generation is
//     skipped gracefully ("OpenGL context unavailable") but slicing itself
//     is unaffected.
//   - Machine + process profiles load together via
//       --load-settings "machine.json;process.json"
//     and filament loads separately via --load-filaments.
//   - There is no plain --export-gcode flag. --export-3mf produces a real
//     ZIP ("*.gcode.3mf") containing the sliced result at
//     Metadata/plate_1.gcode - that file must be unzipped out.
//   - --logfile is required to get a useful error message on failure;
//     stdout alone is too terse.
//   - No .bgcode export flag exists in --help output.
//   - --export-settings <path> <file> works standalone (no --slice needed)
//     and still requires a trailing model file argument even though the
//     model itself is irrelevant to a settings export. The result is a
//     fully flattened JSON (626 keys observed, no "inherits" pointer) -
//     confirmed real values for every field in
//     src/lib/slicer-setting-categories.ts came back correctly typed
//     (numbers, percentage strings like "20%", or enum strings).
//   - Real user-exported profiles (from OrcaSlicer's "Export Config
//     Bundle", e.g. a .orca_printer file) do NOT include the "type"
//     field that bundled system profiles have. --load-settings needs
//     that field to tell machine.json apart from process.json when both
//     are passed together - without it, it fails with "unknown config
//     type of file ... in load-settings". ensureType() below injects it.
//   - inherits-by-name resolution (a filament/process preset pointing at
//     a system preset by name, e.g. "Bambu PLA Basic @System") works
//     correctly for arbitrary uploaded files, confirmed with a real
//     user-exported filament preset - OrcaSlicer resolves it against its
//     own bundled system profile library regardless of where the leaf
//     file lives on disk.
//   - Machine/process compatibility is checked by exact printer name
//     against the process's compatible_printers list, and does NOT follow
//     a machine's own "inherits" chain. Confirmed an empty array or a
//     wholly absent field are BOTH read as "compatible with nothing", not
//     "unrestricted" - a machine-agnostic process (no field at all) fails
//     against every printer just as surely as a Voron-specific one fails
//     against a "Tuned" custom machine name it doesn't list. This is real
//     OrcaSlicer behavior, not a bug here - it surfaces as "process not
//     compatible with printer" via the logfile. Since the app already
//     gates which Slicing Profiles a Machine Profile allows
//     (MachineProfile.allowedSlicingProfiles), that pairing decision has
//     already been made by the time a request reaches here, so
//     ensureCompatiblePrinter() below always injects the target machine's
//     name rather than trusting whatever the process file shipped with.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const ORCASLICER_BIN = "/opt/orcaslicer/bin/orca-slicer";
const UPLOADS_ROOT = "/data/uploads";
const DUMMY_MODEL_PATH = "/app/dummy.stl";
const PORT = process.env.PORT || 8090;

function resolveSafePath(relativePath) {
  const resolved = path.resolve(UPLOADS_ROOT, relativePath);
  if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + path.sep)) {
    throw new Error(`Path escapes uploads root: ${relativePath}`);
  }
  return resolved;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

// Some real exports (confirmed with a Prusa machine profile exported
// straight from a stock system preset, no user customization) carry
// "from":"System" - the CLI parser only accepts a lowercase value here and
// fails with "'s from System unsupported" otherwise.
function normalizeFrom(parsed) {
  if (typeof parsed.from === "string") {
    parsed.from = parsed.from.toLowerCase();
  }
  return parsed;
}

// Real user-exported profiles omit "type" - inject it if missing so
// --load-settings can tell machine/process files apart. Never overwrites
// an existing type (bundled system profiles already have the right one).
function ensureType(jsonContent, type) {
  const parsed = normalizeFrom(JSON.parse(jsonContent));
  if (!parsed.type) {
    parsed.type = type;
  }
  return JSON.stringify(parsed);
}

// OrcaSlicer's machine/process compatibility check matches the process's
// compatible_printers list against the MACHINE's ancestor name (its own
// "inherits" field), NOT the machine's own top-level "name" - confirmed by
// direct CLI testing: a custom/tuned machine (e.g. "Voron 0.1 0.4 nozzle
// Tuned", inherits "Voron 0.1 0.4 nozzle") is rejected by a process whose
// compatible_printers contains the tuned leaf name itself, but accepted by
// one containing just the ancestor "Voron 0.1 0.4 nozzle". A missing or
// empty compatible_printers field is read as "compatible with nothing",
// not "unrestricted" - so any process lacking a literal (non-inherited)
// compatible_printers entry for the right name fails outright, including
// real user-exported presets that rely on inheriting it (most do). The
// app has its own access-control layer for this pairing decision
// (MachineProfile.allowedSlicingProfiles) - the user already chose this
// combination there, so we make the CLI agree rather than trust whatever
// compatible_printers the process file shipped with.
function ensureCompatiblePrinter(processObj, machineJsonContent) {
  const machine = JSON.parse(machineJsonContent);
  const names = [machine.inherits, machine.name].filter(Boolean);
  if (names.length === 0) return processObj;
  const current = Array.isArray(processObj.compatible_printers) ? processObj.compatible_printers : [];
  const missing = names.filter((n) => !current.includes(n));
  if (missing.length > 0) {
    processObj.compatible_printers = [...current, ...missing];
  }
  return processObj;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, opts);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ code, stdout, stderr }));
    proc.on("error", (err) => resolve({ code: -1, stdout, stderr: err.message }));
  });
}

async function handleSlice(req, res) {
  const jobId = crypto.randomUUID();
  const tmpDir = path.join("/tmp", `slice-${jobId}`);

  try {
    const body = await readJsonBody(req);
    const { sourceFilePath, machineJson, processJson, filamentJson, outputRelativePath, overrides, preArranged } = body;
    if (!sourceFilePath || !machineJson || !processJson || !filamentJson || !outputRelativePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Missing required field(s)" }));
      return;
    }

    const sourcePath = resolveSafePath(sourceFilePath);
    const outputPath = resolveSafePath(outputRelativePath);
    if (!fs.existsSync(sourcePath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: `Source file not found: ${sourceFilePath}` }));
      return;
    }

    fs.mkdirSync(tmpDir, { recursive: true });
    const machinePath = path.join(tmpDir, "machine.json");
    const processPath = path.join(tmpDir, "process.json");
    const filamentPath = path.join(tmpDir, "filament.json");
    const bundlePath = path.join(tmpDir, "output.gcode.3mf");
    const logPath = path.join(tmpDir, "orca.log");
    fs.writeFileSync(machinePath, ensureType(machineJson, "machine"));
    // "Custom Settings" overrides are applied by merging them into a copy
    // of the process profile before it's loaded - simpler and more
    // reliable than constructing individual CLI override flags per field.
    const processObj = normalizeFrom({ ...JSON.parse(processJson), ...(overrides || {}) });
    if (!processObj.type) processObj.type = "process";
    ensureCompatiblePrinter(processObj, machineJson);
    fs.writeFileSync(processPath, JSON.stringify(processObj));
    fs.writeFileSync(filamentPath, ensureType(filamentJson, "filament"));

    // A caller-built multi-object .3mf (see src/lib/build-combined-3mf.ts
    // in the app) already carries each object's exact position/rotation as
    // a per-item transform - OrcaSlicer's default arrange would discard
    // that and re-lay-out the plate itself, confirmed empirically. Only
    // single-object slices (the vast majority) omit this and get the
    // original default behavior, unchanged.
    const arrangeArgs = preArranged ? ["--arrange", "0"] : [];

    const { code } = await run(ORCASLICER_BIN, [
      "--logfile", logPath,
      "--load-settings", `${machinePath};${processPath}`,
      "--load-filaments", filamentPath,
      ...arrangeArgs,
      "--slice", "0",
      "--export-3mf", bundlePath,
      sourcePath,
    ]);

    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";

    if (code !== 0 || !fs.existsSync(bundlePath)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: log.trim() || `orca-slicer exited with code ${code}`, log }));
      return;
    }

    const extracted = await run("unzip", ["-p", bundlePath, "Metadata/plate_1.gcode"]);
    if (extracted.code !== 0 || !extracted.stdout) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Slice succeeded but no gcode found in output bundle", log }));
      return;
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, extracted.stdout);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function handleResolveSettings(req, res) {
  const jobId = crypto.randomUUID();
  const tmpDir = path.join("/tmp", `resolve-${jobId}`);

  try {
    const body = await readJsonBody(req);
    const { sourceFilePath, machineJson, processJson, filamentJson } = body;
    if (!machineJson || !processJson || !filamentJson) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Missing required field(s)" }));
      return;
    }

    // No specific uploaded file in context (e.g. previewing a Slicing
    // Profile edit) - fall back to the bundled dummy model. Its geometry
    // is irrelevant to a settings export.
    const sourcePath = sourceFilePath ? resolveSafePath(sourceFilePath) : DUMMY_MODEL_PATH;
    if (!fs.existsSync(sourcePath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: `Source file not found: ${sourceFilePath || sourcePath}` }));
      return;
    }

    fs.mkdirSync(tmpDir, { recursive: true });
    const machinePath = path.join(tmpDir, "machine.json");
    const processPath = path.join(tmpDir, "process.json");
    const filamentPath = path.join(tmpDir, "filament.json");
    const resolvedPath = path.join(tmpDir, "resolved.json");
    const logPath = path.join(tmpDir, "orca.log");
    const processObj = normalizeFrom(JSON.parse(processJson));
    if (!processObj.type) processObj.type = "process";
    ensureCompatiblePrinter(processObj, machineJson);
    fs.writeFileSync(machinePath, ensureType(machineJson, "machine"));
    fs.writeFileSync(processPath, JSON.stringify(processObj));
    fs.writeFileSync(filamentPath, ensureType(filamentJson, "filament"));

    const { code } = await run(ORCASLICER_BIN, [
      "--logfile", logPath,
      "--load-settings", `${machinePath};${processPath}`,
      "--load-filaments", filamentPath,
      "--export-settings", resolvedPath,
      sourcePath,
    ]);

    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";

    if (code !== 0 || !fs.existsSync(resolvedPath)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: log.trim() || `orca-slicer exited with code ${code}`, log }));
      return;
    }

    const settings = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, settings }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  if (req.method === "POST" && req.url === "/slice") {
    handleSlice(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/resolve-settings") {
    handleResolveSettings(req, res);
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => console.log(`orcaslicer sidecar listening on :${PORT}`));
