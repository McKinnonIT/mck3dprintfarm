# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.5a] - 2025-04-08

### Added
- **Database Backup & Management:**
  - Added "Database" tab to Settings page (Admin only).
  - Implemented Database Statistics section displaying DB size, row counts (users, roles, printers), and last backup date.
  - Implemented functionality to create manual database backups (`.db` file).
  - Backup filenames now use the format `[printfarmtitle]-[timestamp].db` based on the "Print Farm Title" setting.
  - Added section to list existing backup files.
  - Implemented functionality to download existing backup files.
  - Implemented functionality to delete existing backup files with confirmation dialog.
  - Added API endpoints (`/api/database/backup`, `/api/database/backups`, `/api/database/stats`, `/api/database/backups/[filename]`) to support these features.
  - Configured Docker volume mapping (`./docker-tests/backups`) for persistent backup storage.
- Added `date-fns` dependency for timestamp formatting.
- Added Shadcn UI `AlertDialog` component.

### Fixed
- Resolved complex infinite loop issue in Settings page related to `useSession` hook and `useEffect` dependencies.

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