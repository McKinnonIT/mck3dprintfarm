# orcaslicer sidecar

Headless slicing service. Wraps `lscr.io/linuxserver/orcaslicer`'s bundled
OrcaSlicer CLI binary in a tiny HTTP server (`server.js`, no npm
dependencies - only Node built-ins).

## Why this base image

We don't extract the OrcaSlicer AppImage ourselves. `linuxserver/orcaslicer`
already did that (see their Dockerfile) and ships every runtime library it
needs - proven by the fact their GUI works. Re-deriving that dependency list
from scratch would just be redoing solved work. We `FROM` their image and
drop their GUI/Selkies desktop layer entirely; nothing in this sidecar starts
a display.

## Confirmed CLI contract (OrcaSlicer 2.4.1)

Empirically verified before writing `server.js` - see the git history for
the spike that ran this against a real cube STL and bundled Voron/Bambu
sample profiles:

- Binary: `/opt/orcaslicer/bin/orca-slicer`. Runs headlessly with zero
  missing libraries. No GPU/Xvfb needed - thumbnail generation is skipped
  gracefully (`OpenGL context unavailable`), slicing is unaffected.
- Machine + process profiles load together:
  `--load-settings "machine.json;process.json"`. Filament loads separately:
  `--load-filaments filament.json"`.
- `--slice 0` slices all plates.
- There is **no plain gcode export flag**. `--export-3mf out.gcode.3mf`
  produces a real ZIP; the sliced gcode is at `Metadata/plate_1.gcode`
  inside it. The server unzips this out.
- `--logfile <path>` is required for a useful error message - stdout alone
  is too terse on failure.
- No `.bgcode` export flag exists. PrusaLink printing from a sliced file
  is a deferred follow-up, not solved here (see the v0.0.9a plan).
- The machine/process/filament profiles must be a genuinely compatible set
  (e.g. exported together from the OrcaSlicer GUI for one real printer).
  Mismatched combinations fail slicing with a clear error surfaced via
  `--logfile` (e.g. "process not compatible with printer", or gcode
  validation errors like missing `G92 E0` for relative extruder mode) -
  this is OrcaSlicer's own validation, not something this server checks.

## API

- `GET /health` → `200 ok`.
- `POST /slice` → JSON body:
  ```json
  {
    "sourceFilePath": "user/167.../model.stl",
    "machineJson": "...",
    "processJson": "...",
    "filamentJson": "...",
    "outputRelativePath": "user/167.../model.gcode"
  }
  ```
  Paths are relative to the shared `uploads` volume (mounted at
  `/data/uploads` in this container - the same host path the main app
  mounts). Profile contents are passed inline since they're small JSON
  files. Returns `{ "success": true }` or
  `{ "success": false, "error": "...", "log": "..." }`.
