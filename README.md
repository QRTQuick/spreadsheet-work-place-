# электронная таблица

`электронная таблица` is a premium online spreadsheet workspace built with Flask, HTML, CSS, JavaScript, Neon/PostgreSQL, and browser-side WebAssembly hooks. It combines a marketing site, authentication flow, private user workspaces, CSV import/export, a visual spreadsheet editor, and Vercel-ready deployment in one codebase.

## Overview

The product is organized as a multi-page web application:

- marketing landing page for discovery and conversion
- login and signup pages for account access
- dashboard for creating and opening private workspaces
- spreadsheet editor for importing, editing, visualizing, and exporting sheet data

Each authenticated user gets private workspaces tied to their own account. Workspaces are persisted in the database, and spreadsheet content is stored as serialized grid data with import/export support.

## Core capabilities

- Private user accounts with session-based authentication
- User-specific workspaces with unique slugs
- CSV import and export
- Browser spreadsheet editor with autosave
- Visual editor overlays with JavaScript fallback and Rust/Go WASM extension points
- Neon-ready PostgreSQL support with SQLite fallback for local development
- Vercel-ready Flask deployment
- SEO assets including metadata, JSON-LD, `robots.txt`, `sitemap.xml`, and a web manifest
- Optional PySide6 desktop companion for native UI experiments

## Documentation map

- [Architecture](docs/architecture.md)
- [API Reference](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Editor And Runtimes](docs/editor-and-runtimes.md)

## Repository structure

- `app.py`
  Flask entrypoint used locally and by Vercel framework detection.
- `backend/`
  Application factory, configuration loading, and database access layer.
- `templates/`
  Server-rendered pages for landing, auth, dashboard, and workspace UI.
- `public/static/`
  CSS, JavaScript, images, and wasm runtime assets served by Vercel's static layer.
- `sql/schema.sql`
  Database schema for users, workspaces, sheets, and activity events.
- `wasm/main.go`
  Go-based WebAssembly source for spreadsheet statistics.
- `rust-wasm/sheet_graphics/`
  Rust WebAssembly crate for spreadsheet visual model generation.
- `desktop/`
  Optional PySide6 desktop studio for native UI exploration.
- `scripts/`
  Build helpers for Go and Rust wasm outputs.

## Quick start

### 1. Create the environment

Copy the example file and set your own secrets:

```powershell
Copy-Item .env.example .env
```

Important environment values:

- `SECRET_KEY`
  Required for Flask sessions. Use a long random value in every non-dev environment.
- `DATABASE_URL`
  Use Neon/PostgreSQL in production. You can use `sqlite:///local-dev.db` locally.
- `SITE_URL`
  Your public domain. Used for canonical URLs, OG tags, and sitemap generation.
- `SECURE_COOKIES`
  Set to `1` behind HTTPS.

### 2. Install Python dependencies

```powershell
pip install -r requirements.txt
```

### 3. Run the app locally

```powershell
python app.py
```

Open `http://127.0.0.1:5000`.

## Local development modes

### SQLite mode

Use this for quick local development:

```env
DATABASE_URL=sqlite:///local-dev.db
```

### Neon mode

Use this to match production more closely:

```env
DATABASE_URL=postgresql://username:password@your-neon-host.neon.tech/your_database?sslmode=require
```

## Deployment summary

The site is structured for Vercel Flask deployment:

- the Flask app is exported from root `app.py`
- static assets are stored in `public/static/`
- deployment settings are defined with the Flask framework in `vercel.json`
- production URLs can be inferred from Vercel system environment variables

For the full process, see [docs/deployment.md](docs/deployment.md).

## Health endpoint

The application exposes:

```text
/api/health
```

This returns database readiness, detected environment, Vercel status, and the active site URL.

## WebAssembly and desktop extras

The project currently supports three extension paths around the main editor:

- JavaScript fallback rendering in the browser
- Go WebAssembly for spreadsheet statistics
- Rust WebAssembly for browser-side visual models

There is also a separate PySide6 desktop studio for native UI experimentation. This desktop app is not part of the Vercel deployment.

See [docs/editor-and-runtimes.md](docs/editor-and-runtimes.md) for details.

## Security notes

- Never commit a real `SECRET_KEY`
- Never commit a live production `DATABASE_URL`
- Rotate any credentials that were ever pasted into public or semi-public channels
- Keep `SECURE_COOKIES=1` in production

## Current status

This repository already includes:

- a polished landing page
- private authentication and workspace flows
- a working dashboard and spreadsheet editor
- database-backed persistence
- deployment scaffolding for Vercel
- deeper runtime scaffolds for Go, Rust, and PySide6

The project is a solid production-oriented base, with clear extension points for richer spreadsheet logic, collaboration features, formula engines, permissions, and advanced import/export support.
