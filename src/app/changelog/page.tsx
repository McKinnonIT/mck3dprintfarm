import React from "react";
import Link from "next/link";

// Helper to get today's date
const getTodaysDate = () => {
  const today = new Date();
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return today.toLocaleDateString('en-US', options);
};

export default function ChangelogPage() {
  const releaseDate = getTodaysDate(); // Get today's date
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Changelog</h1>
      
      <div className="space-y-8">
        {/* START: v0.4.0a Entry */}
        <section className="border-b pb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold" id="v0.4.0a">Version 0.4.0a</h2>
            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">Latest</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Released: 2026-07-24</p>

          <div className="prose prose-blue max-w-none">
            <h3 className="text-lg font-medium mt-4 mb-2">Changed</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Manage Printers page:</strong>
                <ul className="list-disc pl-4">
                  <li>Printer, IP Address, and Status columns are now sortable - click a header to toggle ascending/descending.</li>
                </ul>
              </li>
              <li>
                <strong>Slicer Profiles settings:</strong>
                <ul className="list-disc pl-4">
                  <li>"Manage Slicing Profiles" is now "Printer Settings" - still manages a machine's Slicing Profile allow-list, and now also hosts its bed representation (see Added below).</li>
                </ul>
              </li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Added</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Printers:</strong>
                <ul className="list-disc pl-4">
                  <li>Track an optional filament material (fixed dropdown: PLA, PETG, ABS, ASA, PA (Nylon), PC (Polycarbonate), PEEK, HIPS, TPE, TPU, PVA, PP) and colour (preset dropdown, colour picker, optional hex entry) - shown as chips on the Manage Printers table and dashboard tiles.</li>
                </ul>
              </li>
              <li>
                <strong>Slicer page:</strong>
                <ul className="list-disc pl-4">
                  <li>A Machine Profile can have a bed STL uploaded (Settings → Printer Settings) for a more accurate 3D bed representation - purely visual, it's never sent to OrcaSlicer or included in a slice.</li>
                </ul>
              </li>
              <li>
                <strong>Settings:</strong>
                <ul className="list-disc pl-4">
                  <li>Machine, Filament, and Slicing Profiles can now be renamed in place.</li>
                </ul>
              </li>
            </ul>
          </div>
        </section>
        {/* END: v0.4.0a Entry */}

        {/* START: v0.3.0a Entry */}
        <section className="border-b pb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold" id="v0.3.0a">Version 0.3.0a</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Released: 2026-07-22</p>

          <div className="prose prose-blue max-w-none">
            <h3 className="text-lg font-medium mt-4 mb-2">Changed</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Slicing now targets a Machine Profile, not a printer:</strong>
                <ul className="list-disc pl-4">
                  <li>The Slicer page and the Files page's Slice dialog now show a Machine Profile dropdown (e.g. "Prusa MK4S") instead of a list of individual printers - slicing only ever depended on the machine type (nozzle size, build volume, gcode flavor), never on which specific physical unit would print it.</li>
                  <li>The printer badge on sliced files (added last version) now shows the Machine Profile name instead of a printer name, for the same reason.</li>
                </ul>
              </li>
              <li>
                <strong>Dashboard:</strong>
                <ul className="list-disc pl-4">
                  <li>Added a "Sort: Name / Status" control next to the refresh interval - status sort surfaces printing, paused, and errored printers before idle or offline ones.</li>
                </ul>
              </li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Added</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Files page:</strong>
                <ul className="list-disc pl-4">
                  <li>Sliced files now show a badge naming the Machine Profile they were sliced for.</li>
                </ul>
              </li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Fixed</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Appearance:</strong>
                <ul className="list-disc pl-4">
                  <li>Theme choice (light/dim/dark) is now read from localStorage directly as a fallback, instead of relying solely on a class the boot script may not have applied - previously the choice could silently reset to light on refresh with no visible error.</li>
                </ul>
              </li>
            </ul>
          </div>
        </section>
        {/* END: v0.3.0a Entry */}

        {/* START: v0.2.0a Entry */}
        <section className="border-b pb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold" id="v0.2.0a">Version 0.2.0a</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Released: 2026-07-22</p>

          <div className="prose prose-blue max-w-none">
            <h3 className="text-lg font-medium mt-4 mb-2">Added</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Camera streaming, proxied through a mediamtx sidecar:</strong>
                <ul className="list-disc pl-4">
                  <li>Live camera views now route through a local camera-proxy sidecar instead of embedding the origin stream directly, so viewers never reach across the restricted camera VLAN - closes an open-proxy/SSRF hole in the snapshot endpoints along the way and stops leaking origin camera URLs to unauthenticated API responses.</li>
                  <li>Printer camera config stores the exact HLS and WebRTC URLs a mediamtx bridge generates, with a preferred-mode selector, instead of guessing an HLS URL from a stored RTSP source. WebRTC as a live-view mode was later dropped - its UDP media can't tunnel through the proxy - so HLS is now the only supported mode.</li>
                  <li>Dashboard tiles for HLS-backed cameras now show a real snapshot preview (grabbed via a short-lived ffmpeg process every 30s), instead of a black placeholder box.</li>
                </ul>
              </li>
              <li>
                <strong>ONVIF camera support (e.g. TP-Link Tapo TC60):</strong>
                <ul className="list-disc pl-4">
                  <li>Given a camera's IP and ONVIF credentials, the app resolves its live RTSP URI and feeds it through the same camera-proxy pipeline already used for mediamtx-bridge cameras.</li>
                  <li>New "Test Connection" button in the Add/Edit Printer forms resolves the stream URI and device info before saving.</li>
                </ul>
              </li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Fixed</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>PrusaLink Integration:</strong>
                <ul className="list-disc pl-4">
                  <li>Uploading, starting, pausing, resuming, and cancelling prints all now go through PrusaLink's v1 API - the legacy endpoints this app used previously return 403 Forbidden on current firmware, which only exposes USB storage rather than internal "local" storage.</li>
                  <li>Print jobs sent to PrusaLink printers accept plain <code>.gcode</code> files again, not just <code>.bgcode</code> - the built-in OrcaSlicer sidecar can only ever produce <code>.gcode</code>, so this was blocking every in-app sliced file from being sent to a Prusa printer.</li>
                  <li>The current job's filename is now saved to the database when polling printer status, so the dashboard and printers table actually show what's printing instead of staying blank.</li>
                </ul>
              </li>
            </ul>
          </div>
        </section>
        {/* END: v0.2.0a Entry */}

        {/* START: v0.1.0a Entry */}
        <section className="border-b pb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold" id="v0.1.0a">Version 0.1.0a</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Released: 2026-07-14</p>

          <div className="prose prose-blue max-w-none">
            <h3 className="text-lg font-medium mt-4 mb-2">Added</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>RTSP camera support:</strong>
                <ul className="list-disc pl-4">
                  <li>Printers can now have an RTSP Camera URL (e.g. from a mediamtx bridge) in addition to the existing MJPEG/snapshot webcam URL.</li>
                  <li>The live camera modal plays the RTSP-backed stream via the bridge's HLS output, with no extra client-side video library required.</li>
                  <li>Dashboard tiles show a "View Live Camera" tile for printers with only an RTSP camera configured.</li>
                </ul>
              </li>
            </ul>
          </div>
        </section>
        {/* END: v0.1.0a Entry */}

        {/* START: v0.0.9a Entry */}
        <section className="border-b pb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold" id="v0.0.9a">Version 0.0.9a</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Released: 2026-07-07</p>

          <div className="prose prose-blue max-w-none">
            <h3 className="text-lg font-medium mt-4 mb-2">Added</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Built-in slicing via OrcaSlicer:</strong>
                <ul className="list-disc pl-4">
                  <li>New headless OrcaSlicer sidecar container - upload a model and slice it to gcode directly in the app, no external tool needed.</li>
                  <li>Import Machine, Filament, and Slicing Profiles from OrcaSlicer bundles on the Settings page, and assign a Machine Profile to each printer.</li>
                  <li>Per-printer Slicing Profile allow-lists, plus a "Custom Settings" option to override individual values before slicing.</li>
                </ul>
              </li>
              <li>
                <strong>Interactive build plate:</strong>
                <ul className="list-disc pl-4">
                  <li>The Slice panel now shows a live 3D build plate sized to the selected printer, with a height wireframe.</li>
                  <li>Drag to move or rotate a model on the plate (full 3-axis rotation), with "Place on Face" to rest it exactly flat on a chosen surface.</li>
                  <li>Add multiple models to the same plate - each gets its own colour and is combined into one slice job. Models that hang off the edge of the plate are highlighted red and blocked from slicing.</li>
                </ul>
              </li>
              <li>
                <strong>Standalone Slicer page:</strong>
                <ul className="list-disc pl-4">
                  <li>Replaced the old external Kiri:Moto handoff - the Slicer page now opens directly on a blank Prusa build plate, ready to add files from your library.</li>
                </ul>
              </li>
              <li>
                <strong>Appearance:</strong>
                <ul className="list-disc pl-4">
                  <li>New light / dim / dark theme toggle in the navigation bar, applied across the whole app.</li>
                </ul>
              </li>
            </ul>
          </div>
        </section>

        {/* START: v0.0.6a Entry */}
        <section className="border-b pb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold" id="v0.0.6a">Version 0.0.6a</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Released: 2025-04-12</p>
          
          <div className="prose prose-blue max-w-none">
            <h3 className="text-lg font-medium mt-4 mb-2">Fixed</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>PrusaLink Integration:</strong>
                <ul className="list-disc pl-4">
                  <li>Updated status checking to use direct HTTP API calls instead of the Python bridge for reliability.</li>
                  <li>Correctly extract job filename and temperatures from PrusaLink API responses.</li>
                </ul>
              </li>
              <li>
                <strong>Moonraker Integration:</strong>
                <ul className="list-disc pl-4">
                  <li>Fixed print job submission; now uses direct HTTP POST via Node.js `fetch` instead of incorrect Python bridge attempts.</li>
                  <li>Corrected Python library installation in Dockerfile (`moonraker` package).</li>
                </ul>
              </li>
              <li>
                <strong>Printer Selection:</strong>
                <ul className="list-disc pl-4">
                  <li>Resolved issue preventing selection of multiple compatible printers (e.g., Moonraker) in the Print File modal (fixed `useEffect` dependency bug).</li>
                </ul>
              </li>
              <li>
                <strong>Printer Management:</strong>
                <ul className="list-disc pl-4">
                  <li>Fixed duplicate Delete Printer confirmation dialogs; ensured confirmation is modal-only and correctly wrapped.</li>
                  <li>Made Delete Printer confirmation input case-insensitive.</li>
                </ul>
              </li>
              <li>
                <strong>File Uploads:</strong>
                <ul className="list-disc pl-4">
                  <li>Corrected failures caused by foreign key constraint violation (added missing user check before creating `File` record).</li>
                </ul>
              </li>
              <li>
                <strong>Database Migrations:</strong>
                <ul className="list-disc pl-4">
                  <li>Resolved migration history inconsistency caused by `git clean` removing applied migration files.</li>
                </ul>
              </li>
              <li>
                <strong>Changelog Page:</strong>
                <ul className="list-disc pl-4">
                  <li>Fixed JSX structure errors on the changelog page.</li>
                </ul>
              </li>
            </ul>
            
            <h3 className="text-lg font-medium mt-4 mb-2">Changed</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Printer Management UI:</strong>
                <ul className="list-disc pl-4">
                  <li>Refactored the Manage Printers page to use a table layout (`shadcn/ui`).</li>
                  <li>Updated Manage Printers table to display Tool/Bed temperatures.</li>
                  <li>Updated Manage Printers table to display Current Job filename and Time Remaining when printing/paused.</li>
                </ul>
              </li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Added</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Printer Data:</strong>
                <ul className="list-disc pl-4">
                  <li>Added `currentJobFilename` field to the `Printer` database model and corresponding API/UI handling.</li>
                </ul>
              </li>
            </ul>
          </div>
        </section>
        {/* END: v0.0.6a Entry */}

        {/* START: v0.0.5a Entry */}
        <section className="border-b pb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold" id="v0.0.5a">Version 0.0.5a</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Released: 2025-04-10</p>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Features</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Added "Database" tab to Settings page (Admin only).</li>
            <li>Implemented Database Statistics section (DB size, row counts, last backup).</li>
            <li>Implemented functionality to create manual database backups.</li>
            <li>Backup filenames use format `[printfarmtitle]-[timestamp].db`.</li>
            <li>Added section to list existing backup files.</li>
            <li>Implemented download functionality for existing backup files.</li>
            <li>Implemented delete functionality for existing backup files with confirmation.</li>
            <li>Added API endpoints for backup, listing, stats, download, and delete.</li>
            <li>Configured Docker volume mapping for persistent backup storage.</li>
            <li>Added `date-fns` dependency.</li>
            <li>Added Shadcn UI `AlertDialog` component.</li>
          </ul>

          <h3 className="text-lg font-medium mt-4 mb-2">Fixes</h3>
           <ul className="list-disc pl-6 space-y-2">
            <li>Resolved infinite loop issue in Settings page related to `useSession` hook.</li>
           </ul>

          <h3 className="text-lg font-medium mt-4 mb-2">Documentation</h3>
           <ul className="list-disc pl-6 space-y-2">
            <li>Added GitHub repository link to CHANGELOG.md and About page.</li>
           </ul>

        </section>
        {/* END: v0.0.5a Entry */}

        {/* START: v0.0.4a Entry */}
        <section className="border-b pb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold" id="v0.0.4a">Version 0.0.4a</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Released: 2024-06-11</p>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Features</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Implemented Role-Based Access Control (RBAC) for page-level access.</li>
            <li>Added Roles management tab in Settings (Admin only).</li>
            <li>Added Users management tab in Settings (Admin only).</li>
            <li>Added ability to assign Roles to Users.</li>
            <li>Added ability to define allowed pages per Role.</li>
            <li>Added ability to enable/disable user accounts.</li>
            <li>Added dedicated Access Denied page.</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Improvements</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Refactored Settings page UI using Card components for consistency.</li>
            <li>Secured API endpoints for Users, Roles, Settings, Printers, Files, and Groups to enforce appropriate permissions (Admin or User-specific).</li>
            <li>Fixed Docker data persistence issues for development testing.</li>
            <li>Refactored Docker test scripts for clearer separation of clean builds vs. persistent data runs (`start-clean.sh`, `start-persistent.sh`).</li>
            <li>Updated Dockerfile entrypoint to use `prisma migrate deploy` for safer database migrations on persistent volumes.</li>
            <li>Fixed marker file location for `run-ensure-tables.sh` to ensure it respects persistent volumes.</li>
            <li>Updated Docker Compose file to correctly use named volumes and build context.</li>
             <li>Ensured newly added users have the UI toggle correctly showing 'enabled' status.</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Under the Hood</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Extended NextAuth session to include user role and allowed pages.</li>
            <li>Added `allowedPages` field to Role model in database schema.</li>
            <li>Added `isEnabled` field to User model in database schema.</li>
            <li>Created shared `canAccessPage` RBAC utility function.</li>
            <li>Added Shadcn UI components: Switch, Checkbox, Label, Select.</li>
          </ul>
        </section>
        {/* END: v0.0.4a Entry */}

         <section className="border-b pb-6">
           <div className="flex items-center gap-4 mb-4">
             <h2 className="text-2xl font-semibold" id="v0.0.3a">Version 0.0.3a</h2>
           </div>
          <p className="text-sm text-muted-foreground mb-4">Released: May 14, 2024</p>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Features</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Added dynamic Settings page with tabs for configuration</li>
            <li>Added SSO configuration tab with support for Google and Microsoft Entra ID providers</li>
            <li>Redesigned About page with improved visual layout and dynamic content</li>
            <li>Added self-healing database structure for Docker deployments</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Improvements</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fixed Moonraker upload session cleanup using aiohttp throughout for proper session management</li>
            <li>Fixed PrusaLinkPy upload error by removing unsupported timeout parameter</li>
            <li>Fixed Python syntax error in Moonraker bridge script</li>
            <li>Enhanced error handling for printer connection failures</li>
            <li>Improved Settings API with automatic table creation and error recovery</li>
            <li>Fixed Docker environment to properly handle limited disk space on Alpine Linux</li>
            <li>Added dynamic version display in the footer from package.json</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Under the Hood</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Resolved ENOSPC errors in Docker Alpine Linux builds</li>
            <li>Improved Dockerfile with better npm cache configuration</li>
            <li>Enhanced Docker startup scripts with database verification</li>
            <li>Added direct SQLite integration for database resilience</li>
            <li>Created fallback mechanism for settings persistence using raw SQL queries</li>
            <li>Optimized Next.js server-side rendering for browser-specific APIs</li>
          </ul>
        </section>
        
        <section className="border-b pb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-semibold" id="v0.0.2a">Version 0.0.2a</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Released: June 2023</p>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Features</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Added support for Bambu Lab printers (X1 and P1 series)</li>
            <li>Integrated bambulabs_api Python library for printer communication</li>
            <li>Added serialNumber field to Printer model for Bambu Lab authentication</li>
            <li>Added new changelog page for version tracking</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Improvements</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Updated printer connection test to support Bambu Lab devices</li>
            <li>Enhanced printer type selection in Add/Edit printer forms</li>
            <li>Updated Docker configuration to include bambulabs_api package</li>
            <li>Made footer version number link to the changelog</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Under the Hood</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Created bambulabs-bridge.js for Python/JavaScript interoperability</li>
            <li>Updated database schema to include serialNumber field</li>
            <li>Enhanced printer-utils.ts to handle Bambu Lab authentication</li>
            <li>Updated Docker build system to include all needed Python packages (prusaLinkPy, moonraker-api, bambulabs_api)</li>
            <li>Added placeholder Bambu Lab UI components for Docker builds</li>
          </ul>
        </section>
        
        <section className="border-b pb-6">
          <h2 className="text-2xl font-semibold mb-4" id="v0.0.1a">Version 0.0.1a</h2>
          <p className="text-sm text-muted-foreground mb-4">Released: April 2023</p>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Initial Release</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Basic 3D printer farm management functionality</li>
            <li>Support for PrusaLink printers</li>
            <li>Support for Moonraker-based printers (Klipper)</li>
            <li>User authentication and management</li>
            <li>Printer monitoring dashboard</li>
            <li>File upload and print management</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Features</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Printer status monitoring</li>
            <li>Remote print control (start, stop, pause)</li>
            <li>File management for uploaded prints</li>
            <li>Printer configuration (add, edit, delete)</li>
            <li>Docker containerization for easy deployment</li>
          </ul>
        </section>
      </div>
      
      <div className="mt-8 text-center">
        <Link href="/" className="text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
} 