# Changelog

All notable changes to this project will be documented in this file.

**GitHub Repository:** [https://github.com/McKinnonIT/mck3dprintfarm](https://github.com/McKinnonIT/mck3dprintfarm)

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.6a] - 2025-04-12

### Fixed
- Resolved issues preventing selection of Moonraker printers in the Print File modal on the Files page.
- Fixed incorrect Moonraker print job submission logic; now uses direct HTTP POST via Node.js `fetch` instead of a Python bridge.
- Corrected file upload failures caused by a foreign key constraint violation (missing user check).
- Fixed duplicate Delete Printer confirmation dialogs on the Manage Printers page; ensured confirmation is modal-only.
- Made Delete Printer confirmation case-insensitive (accepts "delete", "DELETE", etc.).
- Resolved migration history inconsistency caused by `git clean` removing migration files.
- Corrected Moonraker Python library installation in Dockerfile (switched from `moonraker-py`/`moonraker-api` attempts to the correct `moonraker` package).

### Changed
- Refactored the Manage Printers page to use a table layout.
- Updated Manage Printers table to display Tool/Bed temperatures and Current Job filename/time remaining.

### Added
- Added `currentJobFilename` field to the `Printer` database model.

## [0.0.5a] - 2025-04-10

### Fixed
- Fix issue where the application crashes on first start if there is no database file.
- Updated PrusaLink Bridge to correctly handle file uploads and print start commands.
- Resolved issue where PrusaLink printers were not appearing in the print modal due to incorrect status filtering.

### Added
- Implemented basic print job initiation API (`/api/print-jobs`) and UI flow in the Files page modal.
- Added Python bridge (`prusalink_bridge.py`) for handling PrusaLink communication (upload/print).
- Included `aiohttp` dependency in Dockerfile for Python bridges.

### Changed
- Refined printer status checking logic in `/api/printers/status`.
- Updated `PrintFileModal` component to include Upload/Print buttons and printer filtering.

## [0.0.4a] - 2024-06-11

### Added
- **Role-Based Access Control (RBAC):**
  - Added Role model to Prisma schema (`id`, `name`, `description`, `allowedPages`).
  - Added relationship between User and Role.
  - Implemented UI for managing Roles (Add, Edit, Delete) in Settings page (Admin only).
  - Implemented UI for assigning Roles to Users during User Add/Edit (Admin only).
  - Updated `authOptions` (JWT/Session callbacks) to include user `role` and `allowedPages`.
  - Added `canAccessPage` utility function.
  - Implemented page access control based on `allowedPages` in Role.
  - Restricted access to Settings -> Users and Settings -> Roles tabs to Admins.
- **User Management Enhancements:**
  - Added `isEnabled` field to User model to allow disabling user login.
  - Added toggle switch to enable/disable users in the Users table (Admin only).
  - Updated authentication logic (`authorize` callback) to check `isEnabled` flag.
  - Added API endpoints for managing users (`GET /api/users`, `POST /api/users`, `PATCH /api/users/[id]`, `DELETE /api/users/[id]`).
  - Added API endpoints for managing roles (`GET /api/roles`, `POST /api/roles`, `PATCH /api/roles/[id]`, `DELETE /api/roles/[id]`).
- **Settings Page Refactoring:**
  - Refactored Settings page tabs ("General", "SSO", "Debug") to use consistent `Card`-based layout.
  - Added placeholders for SSO configuration.
  - Removed unused "Advanced" tab.
- Added Shadcn UI `Switch` component.
- Added `bcryptjs` dependency for password hashing.
- Added helper scripts (`create-admin-user.js`, `reset-admin-password.js`).

### Fixed
- Corrected various type errors related to Role handling.
- Ensured database operations use correct Role relations.
- Fixed issues with Docker build scripts and database persistence. 