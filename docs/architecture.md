# Architecture

This document explains how `электронная таблица` is structured across the web app, backend, database, and optional runtime extensions.

## High-level system

The application is a server-rendered Flask product with progressive client-side behavior.

Main layers:

- Flask renders the landing, auth, dashboard, and workspace pages
- JavaScript enhances the dashboard and spreadsheet editor in the browser
- the database stores users, workspaces, sheets, and activity events
- Vercel serves the Flask app as a single backend function and serves `public/static/**` from the CDN
- Go and Rust wasm modules are optional browser-side accelerators
- PySide6 is an optional native desktop companion and is not part of the web deployment

## Request flow

### Public pages

- `GET /`
  Landing page with SEO metadata and product positioning.
- `GET /login`
  Login screen for returning users.
- `GET /signup`
  Signup screen for new users.

### Authenticated pages

- `GET /dashboard`
  Creates the dashboard view with current user data, workspaces, and recent events.
- `GET /workspace/<slug>`
  Opens a specific workspace editor for the authenticated owner.

### API layer

The browser uses JSON and multipart requests for account actions, workspace creation, autosave, import, and export.

## Backend modules

### `app.py`

The root application entrypoint. Vercel detects this file automatically for Flask deployment.

### `backend/app.py`

Application factory responsibilities:

- load configuration
- initialize Flask
- apply `ProxyFix`
- initialize the database schema
- attach context globals
- define routes and JSON API handlers
- provide database availability guards

### `backend/config.py`

Configuration responsibilities:

- load environment values from `.env`
- derive `SITE_URL`
- infer Vercel production and preview URLs
- control secure cookie behavior
- expose a typed `Settings` object

### `backend/db.py`

Persistence responsibilities:

- connect to SQLite or PostgreSQL/Neon
- initialize the schema
- create and fetch users
- create, list, and fetch workspaces
- serialize and deserialize spreadsheet cell grids
- import/export CSV
- record workspace activity events

## Data model

The schema lives in `sql/schema.sql`.

### `users`

Stores:

- `id`
- `full_name`
- `email`
- `password_hash`
- `created_at`

### `workspaces`

Stores:

- `id`
- `user_id`
- `name`
- `slug`
- `description`
- `accent_color`
- `created_at`
- `updated_at`

Each workspace belongs to exactly one user.

### `sheets`

Stores:

- `id`
- `workspace_id`
- `name`
- `cells_json`
- `row_count`
- `col_count`
- `created_at`
- `updated_at`

The current implementation uses one main sheet per workspace.

### `workspace_events`

Stores an activity history for each user and workspace:

- account creation
- workspace creation
- CSV import
- other future sheet actions

## Spreadsheet storage model

Spreadsheet cells are stored as serialized JSON arrays, not as normalized per-cell rows.

That design keeps this version simple and practical for:

- loading an entire sheet into the editor
- autosaving the current state
- CSV import/export

Current normalization rules from the backend:

- minimum grid size: `18 x 8`
- maximum persisted rows: `120`
- maximum persisted columns: `40`
- maximum cell text length: `220` characters

## Authentication model

Authentication is session-based with Flask cookies.

Flow:

1. User signs up or logs in.
2. The backend validates the credentials.
3. `session["user_id"]` is stored.
4. Protected routes check the current user before serving content or API data.

There is no multi-tenant cross-user access in the current implementation. Workspaces are always filtered by the authenticated `user_id`.

## Frontend structure

### Server-rendered templates

- `templates/index.html`
- `templates/login.html`
- `templates/signup.html`
- `templates/dashboard.html`
- `templates/workspace.html`

### Browser scripts

- `public/static/js/site.js`
  Shared page interactions and reveal animations.
- `public/static/js/auth.js`
  Login and signup form submission.
- `public/static/js/dashboard.js`
  Dashboard interactions and workspace creation.
- `public/static/js/workspace.js`
  Spreadsheet editor behavior, autosave, tool state, inspector state, zoom, and canvas overlays.
- `public/static/js/wasm-loader.js`
  Runtime selection between Rust wasm, Go wasm, and JavaScript fallback.

## Editor runtime hierarchy

The workspace editor prefers richer runtimes in this order:

1. Rust WebAssembly
2. Go WebAssembly plus JavaScript graphics fallback
3. JavaScript-only fallback

This keeps the editor deployable even when optional compiled assets are missing.

## Deployment model

On Vercel:

- Flask runs as one backend function through framework support
- static files are served from `public/static/**`
- the app uses Vercel system environment variables to infer public URLs when needed

For full deployment instructions, see [deployment.md](deployment.md).
