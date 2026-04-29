# SecureShare — Secure Organisational File Sharing System
### Product Requirements Document (PRD)
**Version 1.0 | April 2026 | CONFIDENTIAL**

**Tech Stack:** Node.js · Express.js · Neon Postgres · Cloudinary · EJS / HTML

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Database Design](#3-database-design-neon-postgres)
4. [Backend — Project Folder Structure](#4-backend--project-folder-structure)
5. [Backend — API Routes](#5-backend--api-routes)
6. [Middleware Pipeline](#6-middleware-pipeline)
7. [Frontend — Pages & Views](#7-frontend--pages--views)
8. [Frontend — Navigation & Click Flows](#8-frontend--navigation--click-flows)
9. [Frontend — Key UI Components](#9-frontend--key-ui-components)
10. [Security Requirements](#10-security-requirements)
11. [Environment Variables](#11-environment-variables-env)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Project Overview

SecureShare is an organisational file sharing platform that allows multiple users within a single organisation to upload, manage, and securely share files. It enforces role-based access control across three tiers: Super Admin (org-level), Admin, and regular Users.

### 1.1 Goals

- Allow organisations to centralise file storage with strict access boundaries.
- Provide admins with full control over user management, folder structure, and permissions.
- Enable fine-grained file sharing — share with specific users, groups, or entire org.
- Maintain a complete audit trail of all file operations.
- Store files securely on Cloudinary with metadata/access records in Neon Postgres.

### 1.2 Scope

This PRD covers the complete backend API (routes, controllers, DB schema) and frontend (pages, components, navigation flows) for the initial v1.0 release. Real-time collaboration and third-party integrations are out of scope for v1.0.

### 1.3 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 20 LTS | Server runtime |
| Framework | Express.js 4 | HTTP routing & middleware |
| Database | Neon (serverless Postgres) | Relational data, access control |
| File Storage | Cloudinary | File upload, CDN delivery |
| Templating | EJS + Vanilla HTML/CSS/JS | Server-side rendered views |
| Auth | bcrypt + JWT (httpOnly cookie) | Password hashing, session tokens |
| File Parsing | Multer | Multipart upload handling |
| ORM | pg / node-postgres | Direct Postgres queries |

---

## 2. User Roles & Permissions

| Role | Who | Core Permissions |
|------|-----|-----------------|
| Super Admin | Org owner / first account | Full access: manage org, all admins, all users, all files, audit logs |
| Admin | Appointed by Super Admin | Manage users (no role change), manage folders, view all files, share on behalf |
| User | Regular member | Upload own files, view shared files, manage own folders, share with permitted users |

### 2.1 Permission Matrix

| Action | Super Admin | Admin | User |
|--------|:-----------:|:-----:|:----:|
| Create / deactivate org | Y | N | N |
| Invite / remove admins | Y | N | N |
| Invite / remove users | Y | Y | N |
| Reset any user password | Y | Y | N |
| View all files in org | Y | Y | N |
| Delete any file | Y | Y | N |
| Create top-level folders | Y | Y | N |
| Create sub-folders | Y | Y | Y |
| Upload files | Y | Y | Y |
| Share files (org-wide) | Y | Y | N |
| Share files (specific users) | Y | Y | Y |
| View audit log | Y | Y | N |
| Download own files | Y | Y | Y |
| Download shared files | Y | Y | Y |

---

## 3. Database Design (Neon Postgres)

All tables use UUID primary keys. `created_at` and `updated_at` are managed by triggers. Soft-deletes are preferred over hard-deletes to maintain audit trails.

### 3.1 `organisations`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| name | VARCHAR(255) | NOT NULL | Organisation display name |
| slug | VARCHAR(100) | NOT NULL, UNIQUE | URL-safe org identifier |
| logo_url | TEXT | | Cloudinary URL for org logo |
| storage_quota_mb | INTEGER | DEFAULT 5120 | Total storage limit in MB |
| is_active | BOOLEAN | DEFAULT true | Soft deactivation flag |
| created_at | TIMESTAMPTZ | DEFAULT now() | Auto-set on insert |
| updated_at | TIMESTAMPTZ | DEFAULT now() | Updated via trigger |

### 3.2 `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | Primary key |
| org_id | UUID | FK organisations.id NOT NULL | Owning organisation |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Login identifier |
| password_hash | TEXT | NOT NULL | bcrypt hash |
| full_name | VARCHAR(255) | NOT NULL | Display name |
| role | ENUM | NOT NULL DEFAULT 'user' | 'super_admin' or 'admin' or 'user' |
| avatar_url | TEXT | | Cloudinary profile picture URL |
| is_active | BOOLEAN | DEFAULT true | Account enabled flag |
| last_login_at | TIMESTAMPTZ | | Updated on successful login |
| reset_token | TEXT | | Password reset token |
| reset_token_expires | TIMESTAMPTZ | | Expiry for reset token |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

### 3.3 `folders`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| org_id | UUID | FK organisations.id NOT NULL | |
| created_by | UUID | FK users.id NOT NULL | |
| parent_id | UUID | FK folders.id NULL | NULL = root-level folder |
| name | VARCHAR(255) | NOT NULL | Folder display name |
| path | TEXT | NOT NULL | Materialised path e.g. /design/assets |
| is_deleted | BOOLEAN | DEFAULT false | Soft delete |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

### 3.4 `files`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| org_id | UUID | FK organisations NOT NULL | |
| folder_id | UUID | FK folders NULL | NULL = root of org |
| uploaded_by | UUID | FK users.id NOT NULL | |
| original_name | VARCHAR(500) | NOT NULL | Original filename from client |
| cloudinary_public_id | TEXT | NOT NULL, UNIQUE | Cloudinary resource identifier |
| cloudinary_url | TEXT | NOT NULL | Secure CDN URL |
| cloudinary_resource_type | VARCHAR(50) | NOT NULL | image / video / raw |
| mime_type | VARCHAR(100) | NOT NULL | e.g. application/pdf |
| size_bytes | BIGINT | NOT NULL | File size |
| version | INTEGER | DEFAULT 1 | File version counter |
| description | TEXT | | Optional user note |
| tags | TEXT[] | DEFAULT '{}' | Searchable tags array |
| is_deleted | BOOLEAN | DEFAULT false | Soft delete |
| deleted_by | UUID | FK users NULL | |
| deleted_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

### 3.5 `file_shares`

Controls who can access a given file beyond its uploader.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| file_id | UUID | FK files.id NOT NULL | |
| shared_by | UUID | FK users.id NOT NULL | |
| share_type | ENUM | NOT NULL | 'user' or 'org_wide' |
| shared_with_user_id | UUID | FK users NULL | NULL when org_wide |
| permission | ENUM | DEFAULT 'view' | 'view' or 'download' or 'edit' |
| expires_at | TIMESTAMPTZ | | NULL = no expiry |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

### 3.6 `audit_logs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| org_id | UUID | FK organisations NOT NULL | |
| actor_id | UUID | FK users NULL | NULL if system action |
| action | VARCHAR(100) | NOT NULL | e.g. FILE_UPLOAD, FILE_DELETE, USER_INVITE |
| resource_type | VARCHAR(50) | | 'file' or 'user' or 'folder' or 'org' |
| resource_id | UUID | | ID of affected resource |
| meta | JSONB | DEFAULT '{}' | Additional context (IP, browser, etc.) |
| created_at | TIMESTAMPTZ | DEFAULT now() | Immutable |

### 3.7 `invitations`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| org_id | UUID | FK organisations NOT NULL | |
| invited_by | UUID | FK users.id NOT NULL | |
| email | VARCHAR(255) | NOT NULL | Invitee email |
| role | ENUM | DEFAULT 'user' | Role granted on acceptance |
| token | TEXT | NOT NULL, UNIQUE | One-time acceptance token |
| status | ENUM | DEFAULT 'pending' | 'pending' or 'accepted' or 'expired' |
| expires_at | TIMESTAMPTZ | NOT NULL | Typically +7 days |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

### 3.8 Indexes

- **users:** `(org_id)`, `(email)`, `(role)`
- **files:** `(org_id)`, `(folder_id)`, `(uploaded_by)`, `(is_deleted)`, `(tags GIN)`
- **folders:** `(org_id)`, `(parent_id)`, `(created_by)`
- **file_shares:** `(file_id)`, `(shared_with_user_id)`, `(share_type)`
- **audit_logs:** `(org_id)`, `(actor_id)`, `(action)`, `(created_at DESC)`

---

## 4. Backend — Project Folder Structure

```
src/
├── server.js                        # Entry point — creates HTTP server, loads app
├── app.js                           # Express init, global middleware, route mounting
├── config/
│   ├── db.js                        # Neon Postgres pool configuration
│   ├── cloudinary.js                # Cloudinary SDK initialisation
│   └── env.js                       # Validated environment variable exports
├── routes/
│   ├── auth.routes.js               # POST /login, /logout, /register, /forgot-password
│   ├── user.routes.js               # CRUD for users (admin-scoped)
│   ├── file.routes.js               # Upload, list, download, delete, share endpoints
│   ├── folder.routes.js             # Create, rename, delete, list folders
│   ├── org.routes.js                # Org settings, invite, audit log endpoints
│   ├── admin.routes.js              # Admin dashboard aggregations
│   └── view.routes.js               # Server-side rendered EJS page routes
├── controllers/
│   ├── auth.controller.js           # Login / register / token refresh logic
│   ├── user.controller.js           # User CRUD handlers
│   ├── file.controller.js           # Upload to Cloudinary, DB record, share
│   ├── folder.controller.js         # Folder tree management
│   ├── org.controller.js            # Org-level admin actions
│   └── audit.controller.js          # Audit log write & query
├── middleware/
│   ├── auth.middleware.js           # JWT verification, attach req.user
│   ├── role.middleware.js           # requireRole('admin') guard factory
│   ├── upload.middleware.js         # Multer + Cloudinary upload pipeline
│   └── rateLimit.middleware.js      # Per-route rate limiting
├── models/
│   ├── user.model.js                # SQL query helpers for users table
│   ├── file.model.js                # SQL query helpers for files table
│   ├── folder.model.js              # SQL query helpers for folders table
│   ├── org.model.js                 # SQL query helpers for organisations table
│   ├── share.model.js               # SQL query helpers for file_shares table
│   └── audit.model.js               # SQL query helpers for audit_logs table
├── services/
│   ├── cloudinary.service.js        # Upload, delete, generate signed URL helpers
│   └── email.service.js             # Invitation & reset email sending (Nodemailer)
├── utils/
│   ├── jwt.js                       # Sign / verify JWT helper
│   ├── pagination.js                # Offset/limit pagination helper
│   └── validators.js                # Joi schema validators
├── views/                           # EJS template files (see Frontend section)
└── public/
    ├── css/                         # Global stylesheets
    ├── js/                          # Client-side JS modules
    └── assets/                      # Icons, images

migrations/                          # SQL migration files (ordered by timestamp)
.env                                 # Environment variables (never committed)
```

---

## 5. Backend — API Routes

**Base path:** `/api/v1`
All routes return JSON. Auth routes are excluded from JWT middleware. All other routes require a valid JWT in an httpOnly cookie or `Authorization: Bearer` header.

### 5.1 Auth Routes — `/api/v1/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | Public | First-user org registration (creates org + super_admin) |
| POST | `/login` | Public | Returns JWT cookie on success |
| POST | `/logout` | JWT | Clears auth cookie |
| POST | `/forgot-password` | Public | Sends reset link email |
| POST | `/reset-password/:token` | Public | Validates token, updates password |
| GET | `/me` | JWT | Returns current user profile |
| POST | `/accept-invite/:token` | Public | Accepts invitation, creates user account |

### 5.2 User Routes — `/api/v1/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin+ | List all users in org (paginated) |
| POST | `/invite` | Admin+ | Send invitation email with token |
| GET | `/:id` | Admin+ | Get single user profile |
| PATCH | `/:id` | Admin+ | Update user name, role, active flag |
| DELETE | `/:id` | Super Admin | Soft-delete user account |
| PATCH | `/:id/reset-password` | Admin+ | Admin-triggered password reset |
| GET | `/me/profile` | JWT (self) | View own profile |
| PATCH | `/me/profile` | JWT (self) | Update own name, avatar |

### 5.3 File Routes — `/api/v1/files`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/upload` | JWT | Multipart upload to Cloudinary, then DB record |
| GET | `/` | JWT | List files accessible to current user (paginated, filterable) |
| GET | `/:id` | JWT | Get file metadata + share status |
| GET | `/:id/download` | JWT | Generate signed Cloudinary URL, log download |
| PATCH | `/:id` | Owner / Admin | Update description, tags, folder |
| DELETE | `/:id` | Owner / Admin | Soft-delete, remove from Cloudinary |
| POST | `/:id/share` | Owner / Admin | Create file_share record(s) |
| DELETE | `/:id/share/:shareId` | Owner / Admin | Revoke a specific share |
| GET | `/:id/shares` | Owner / Admin | List all active shares for a file |
| GET | `/shared-with-me` | JWT | List files shared with current user |
| POST | `/:id/version` | Owner / Admin | Upload new version of existing file |

### 5.4 Folder Routes — `/api/v1/folders`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List root folders visible to current user |
| POST | `/` | Admin+ (root) / Any (sub) | Create a folder |
| GET | `/:id` | JWT | Get folder contents (sub-folders + files) |
| PATCH | `/:id` | Owner / Admin | Rename folder |
| DELETE | `/:id` | Owner / Admin | Soft-delete folder and all contents |
| GET | `/:id/breadcrumb` | JWT | Return ancestor path array |

### 5.5 Organisation Routes — `/api/v1/org`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings` | Admin+ | Get org name, logo, quota |
| PATCH | `/settings` | Super Admin | Update org name, logo |
| GET | `/audit-log` | Admin+ | Paginated audit log with filters |
| GET | `/stats` | Admin+ | Storage used, user count, file count |

---

## 6. Middleware Pipeline

### 6.1 Global Middleware (app.js order)

1. `helmet()` — Security headers
2. `cors()` — Configured for front-end origin
3. `express.json()` — Parse JSON body
4. `express.urlencoded()` — Parse form bodies
5. `cookieParser()` — Parse httpOnly auth cookie
6. `morgan('combined')` — HTTP request logging
7. `rateLimit` (global) — 200 req / 15 min per IP

### 6.2 Auth Middleware

`auth.middleware.js`: Reads JWT from cookie (or Bearer header). Verifies signature, checks expiry, fetches user from DB. Attaches `req.user = { id, org_id, role }`. Returns `401` on failure.

### 6.3 Role Guard

`role.middleware.js` exports `requireRole(...roles)`. Usage: `router.get('/', requireRole('admin', 'super_admin'), handler)`. Returns `403` if `req.user.role` not in allowed list.

### 6.4 Upload Middleware

`upload.middleware.js`: Multer memory storage to `cloudinary.service.js.uploadStream()`. Attaches `req.cloudinaryResult` to request. Validates MIME type whitelist and 50 MB max size before upload.

---

## 7. Frontend — Pages & Views

All pages are served as EJS templates from `src/views/`. Client-side JS in `src/public/js/` handles AJAX calls to the API. Navigation state is managed via the JWT cookie.

### 7.1 Public Pages (no auth required)

| Route | View File | Description |
|-------|-----------|-------------|
| `GET /` | `views/landing.ejs` | Marketing landing page; CTA buttons: 'Get Started' to /register, 'Sign In' to /login |
| `GET /login` | `views/auth/login.ejs` | Email + password form; 'Forgot password?' link to /forgot-password; on success to /dashboard |
| `GET /register` | `views/auth/register.ejs` | Org name + admin email + password; on success to /dashboard |
| `GET /forgot-password` | `views/auth/forgot-password.ejs` | Email input form; on submit calls POST /api/v1/auth/forgot-password; shows confirmation |
| `GET /reset-password/:token` | `views/auth/reset-password.ejs` | New password form; on submit calls POST /api/v1/auth/reset-password/:token |
| `GET /accept-invite/:token` | `views/auth/accept-invite.ejs` | Set name + password form for invited users |

### 7.2 Authenticated Pages (all roles)

| Route | View File | Description |
|-------|-----------|-------------|
| `GET /dashboard` | `views/dashboard.ejs` | Overview: recent files, storage bar, quick-upload button, pinned folders |
| `GET /files` | `views/files/index.ejs` | File browser: grid/list toggle, search, filter by type/date, sort; breadcrumb nav |
| `GET /files/shared-with-me` | `views/files/shared.ejs` | Files shared by others; filter by sharer, file type |
| `GET /folders/:id` | `views/files/folder.ejs` | Folder contents: sub-folders + files; breadcrumb; create sub-folder button |
| `GET /files/:id` | `views/files/detail.ejs` | File detail: preview, metadata, share panel, version history, download button |
| `GET /profile` | `views/profile.ejs` | Edit display name, avatar; change password form |

### 7.3 Admin Pages (Admin + Super Admin)

| Route | View File | Description |
|-------|-----------|-------------|
| `GET /admin` | `views/admin/dashboard.ejs` | Admin overview: total users, files, storage used, recent activity feed |
| `GET /admin/users` | `views/admin/users/index.ejs` | User list: search, filter by role/status, paginated; 'Invite User' button top-right |
| `GET /admin/users/:id` | `views/admin/users/detail.ejs` | User profile: role badge, active toggle, 'Reset Password' button, files owned, activity |
| `GET /admin/files` | `views/admin/files/index.ejs` | All org files: search, filter, bulk delete; owner column visible |
| `GET /admin/audit-log` | `views/admin/audit-log.ejs` | Paginated log with action type filter, date range picker, actor filter |

### 7.4 Super Admin Pages

| Route | View File | Description |
|-------|-----------|-------------|
| `GET /admin/org-settings` | `views/admin/org-settings.ejs` | Edit org name, logo, storage quota; 'Save Changes' button |
| `GET /admin/admins` | `views/admin/admins.ejs` | Promote users to admin or demote; grid with role badge toggles |

---

## 8. Frontend — Navigation & Click Flows

### 8.1 Global Navigation Bar (authenticated)

Present on all authenticated pages. Layout: **Logo** (left) → 'My Files', 'Shared With Me', 'Admin' (if admin role) links → Search bar → Notification bell → User avatar dropdown (right).

| UI Element | Action / Redirect |
|-----------|------------------|
| Logo click | to /dashboard |
| 'My Files' nav link | to /files |
| 'Shared With Me' nav link | to /files/shared-with-me |
| 'Admin' nav link (admin+) | to /admin |
| Search bar (enter / icon click) | to /files?q={query} — filters file list, calls API |
| Notification bell | Opens slide-over panel listing recent share events |
| Avatar → 'Profile' | to /profile |
| Avatar → 'Sign Out' | POST /api/v1/auth/logout then to /login |

### 8.2 Login Flow

1. User visits `/login`
2. Fills email + password → clicks **'Sign In'** button
3. JS: `POST /api/v1/auth/login` → `{ token }` (cookie set server-side)
4. On `200` → redirect to `/dashboard`
5. On `401` → show inline error 'Invalid email or password'
6. 'Forgot password?' link → `/forgot-password`

### 8.3 File Upload Flow

1. User clicks **'Upload File'** button (FAB on `/files` or `/dashboard`)
2. Upload modal opens: drag-and-drop zone + file picker, folder selector dropdown, tags input, description textarea
3. User selects file → clicks **'Upload'**
4. JS: `POST /api/v1/files/upload` (multipart/form-data)
5. Progress bar shown during upload
6. On `201` → modal closes, file appears in list with fade-in animation
7. On error → toast notification with error message

### 8.4 File Share Flow

1. User opens `/files/:id` (file detail page)
2. Clicks **'Share'** button in action bar
3. Share modal opens: radio buttons for 'Specific People' vs 'Entire Organisation'
4. If **'Specific People'**: type-ahead user search input (calls `GET /api/v1/users?q=...`) → select user(s) → choose permission (View / Download / Edit) → optional expiry date
5. If **'Entire Organisation'**: choose permission → optional expiry
6. Clicks **'Share'** → `POST /api/v1/files/:id/share`
7. On `201` → share panel updates with new share entry; existing shares listed with **'Revoke'** button
8. 'Revoke' button → `DELETE /api/v1/files/:id/share/:shareId` → entry removed from list

### 8.5 Folder Navigation Flow

1. User is on `/files` — sees root folders as cards
2. Clicks folder card → navigates to `/folders/:id`
3. Breadcrumb at top: 'My Files > Design > Assets' — each crumb is a link
4. **'+ New Folder'** button → inline input appears in folder grid → confirm with Enter or tick icon → `POST /api/v1/folders`
5. Right-click / three-dot menu on folder: 'Rename', 'Delete'
6. 'Rename' → inline edit input, confirm → `PATCH /api/v1/folders/:id`
7. 'Delete' → confirmation modal → `DELETE /api/v1/folders/:id`

### 8.6 Admin — Invite User Flow

1. Admin navigates to `/admin/users`
2. Clicks **'Invite User'** button (top-right)
3. Modal opens: Email field, Role selector (User / Admin)
4. Clicks **'Send Invitation'** → `POST /api/v1/users/invite`
5. On `201` → modal closes, toast 'Invitation sent to {email}'
6. Pending invite appears in user list with 'Pending' badge
7. Invitee receives email → clicks link → `/accept-invite/:token` → fills name + password → `POST /api/v1/auth/accept-invite/:token` → redirected to `/dashboard`

### 8.7 Admin — Manage User Flow

1. Admin navigates to `/admin/users/:id`
2. Sees user profile: name, email, role badge, active/inactive toggle, last login
3. **'Active / Inactive'** toggle → `PATCH /api/v1/users/:id { is_active }`
4. **'Reset Password'** button → confirmation modal → `PATCH /api/v1/users/:id/reset-password` → triggers email to user
5. Role badge click (Super Admin only) → dropdown: User / Admin → `PATCH /api/v1/users/:id { role }`
6. **'View Files'** tab → filtered file list for this user

---

## 9. Frontend — Key UI Components

| Component | Used On | Notes |
|-----------|---------|-------|
| FileCard (grid/list) | Files index, Folder detail | Thumbnail preview, name, size, date, 3-dot actions menu |
| UploadModal | Dashboard, Files index | Drag-drop, folder picker, tags, description, progress bar |
| ShareModal | File detail page | People search, org-wide toggle, permission selector, expiry picker |
| FolderTree (sidebar) | All file pages | Collapsible folder tree with active state highlighting |
| Breadcrumb | Folder detail | Dynamic path segments, each a link |
| UserTable | Admin users list | Sortable, paginated, role badge, active toggle inline |
| InviteModal | Admin users | Email + role selector, send button |
| AuditLogTable | Admin audit log | Colour-coded action badges, actor, resource link, timestamp |
| StorageBar | Dashboard, org settings | Progress bar with used/total display |
| Toast Notification | All pages | Success (green), error (red), info (blue) — auto-dismiss 4s |
| ConfirmDialog | Delete actions | Modal with destructive red confirm button |
| FilePreview | File detail | In-browser preview for PDF, image, video, audio; fallback icon |
| RoleBadge | User tables, detail pages | Coloured pill: super_admin=navy, admin=blue, user=grey |
| VersionHistory | File detail | List of versions with uploader, date, restore button |

---

## 10. Security Requirements

### 10.1 Authentication

- Passwords hashed with bcrypt (cost factor 12).
- JWT signed with HS256, 8-hour expiry, stored in httpOnly `SameSite=Strict` cookie.
- Refresh token (30 days) stored in DB; rotated on each refresh.
- Maximum 5 failed login attempts triggers 15-minute lockout per account.

### 10.2 Authorisation

- Every API route enforces `auth.middleware` + `role.middleware`.
- File access checks: user must be owner OR have an active `file_share` record OR be admin of same org.
- Org isolation: every query filters by `org_id` from `req.user` — no cross-org data leakage.

### 10.3 File Storage

- Files stored in Cloudinary under **private** access type — no public URLs.
- Downloads use short-lived (60-second) signed URLs generated server-side.
- MIME type whitelist enforced both client-side and in upload middleware.
- 50 MB per-file limit; org-level storage quota enforced before upload accepted.

### 10.4 Transport & Headers

- HTTPS enforced in production (HSTS header via helmet).
- CSRF protection via `csurf` middleware on all state-changing routes.
- Content Security Policy set via `helmet.contentSecurityPolicy`.
- Rate limiting: 10 req/min on `/auth` routes, 200 req/15 min globally.

---

## 11. Environment Variables (.env)

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | development, production, or test |
| `PORT` | HTTP server port (default 3000) |
| `DATABASE_URL` | Neon Postgres connection string |
| `JWT_SECRET` | Secret for signing JWTs (min 64 chars) |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CLOUDINARY_FOLDER` | Root folder name in Cloudinary (e.g. secureshare) |
| `SMTP_HOST` | SMTP server for invitation / reset emails |
| `SMTP_PORT` | SMTP port (465 for SSL) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `EMAIL_FROM` | SecureShare noreply address |
| `APP_BASE_URL` | Base URL for email links (e.g. https://secureshare.app) |
| `COOKIE_SECRET` | Secret for signed cookies |
| `MAX_FILE_SIZE_MB` | Per-file upload limit in MB (default 50) |

---

## 12. Implementation Roadmap

| Phase | Focus | Deliverables |
|-------|-------|-------------|
| 1 | Foundation | Project scaffold, DB migrations, env config, Neon connection, Cloudinary config, JWT auth (register + login + logout) |
| 2 | Core File Ops | Multer + Cloudinary upload pipeline, file CRUD API, folder CRUD API, download with signed URL |
| 3 | Access Control | Role middleware, file sharing API, org isolation, permission checks on all routes |
| 4 | Frontend — Auth | EJS login, register, forgot/reset password pages, accept-invite page, form validation |
| 5 | Frontend — Files | Dashboard, file browser, folder navigation, upload modal, file detail + preview, share modal |
| 6 | Admin Panel | User management pages, invite flow, audit log page, org settings page |
| 7 | Security Hardening | Rate limiting, CSRF, CSP, account lockout, Cloudinary private delivery |
| 8 | Polish & Testing | Toast notifications, error pages, mobile responsiveness, API integration tests |

---

*— End of Document —*

*SecureShare PRD v1.0 | April 2026*
