# Deployment Guide

This document explains how to run and deploy `электронная таблица` in local, Neon-backed, and Vercel-hosted environments.

## Deployment targets

### Local development

Recommended for:

- UI iteration
- route testing
- SQLite-based quick checks

### Neon-backed local or staging

Recommended for:

- matching production behavior more closely
- testing PostgreSQL-specific behavior
- validating connection strings before deploy

### Vercel production

Recommended for:

- public hosting
- CDN-backed static delivery
- automatic framework deployment for Flask

## Environment variables

### Required

- `SECRET_KEY`
  Used for Flask sessions.
- `DATABASE_URL`
  Database connection string.

### Strongly recommended

- `SITE_URL`
  Public site URL for canonical tags, OG tags, sitemap entries, and manifest links.
- `SECURE_COOKIES`
  Set to `1` in production.

### Optional / platform-provided

- `FLASK_APP`
- `FLASK_ENV`
- `VERCEL`
- `VERCEL_ENV`
- `VERCEL_URL`
- `VERCEL_PROJECT_PRODUCTION_URL`

## Local setup

### SQLite workflow

1. Copy `.env.example` to `.env`
2. Replace `SECRET_KEY`
3. Set:

```env
DATABASE_URL=sqlite:///local-dev.db
```

4. Install dependencies:

```powershell
pip install -r requirements.txt
```

5. Run:

```powershell
python app.py
```

## Neon setup

Use a pooled Neon connection string in production and staging.

Example shape:

```env
DATABASE_URL=postgresql://username:password@your-neon-host.neon.tech/your_database?sslmode=require
```

Recommendations:

- use Neon pooled connections for hosted deployments
- keep `sslmode=require`
- do not commit the real connection string to the repository
- rotate any secret that has already been exposed publicly

## Vercel deployment

### Current deployment model

The project uses Vercel's Flask framework support.

Important points:

- the backend entrypoint is root `app.py`
- static assets live under `public/static/`
- the app should not rely on Flask's default static directory for Vercel CDN delivery
- the project does not need an `api/` Flask wrapper

### Steps

1. Push the repository to GitHub
2. Import the repo into Vercel
3. Set environment variables in the Vercel dashboard:
   - `DATABASE_URL`
   - `SECRET_KEY`
   - `SITE_URL`
   - `SECURE_COOKIES=1`
4. Deploy

### `vercel.json`

Current config:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "flask"
}
```

### URL detection

If `SITE_URL` is not set, the app can infer URLs from Vercel system environment variables:

- `VERCEL_PROJECT_PRODUCTION_URL`
- `VERCEL_URL`

Even so, explicitly setting `SITE_URL` is still the clearest production setup.

## Static assets

All publicly served frontend assets should live in:

```text
public/static/
```

This includes:

- CSS
- JavaScript
- images
- wasm runtime files

## Database schema initialization

The schema is initialized automatically during app startup through the database layer.

That means the app will create required tables on first boot if the connected database is reachable.

## Health verification

After deployment, verify:

```text
/api/health
```

Expected success shape:

```json
{
  "ok": true,
  "database": "ready",
  "environment": "production",
  "on_vercel": true,
  "site_url": "https://your-domain.com",
  "detail": null
}
```

## Troubleshooting

### Vercel says a function pattern does not match

Cause:

- `vercel.json` is pointing to a function path that does not match the actual Flask deployment model

Fix:

- use framework mode with root `app.py`
- do not point `functions` at a non-existent or unnecessary `api/*.py` wrapper for this project

### Login or dashboard returns `503`

Cause:

- database connection failed during startup

Check:

- `DATABASE_URL`
- Neon hostname and credentials
- whether the project can reach the database from the deployment environment

### Static assets are missing in production

Cause:

- assets are outside `public/static/`

Fix:

- move them into `public/static/`
- reference them through the current asset helper

### Canonical or OG URLs are wrong

Cause:

- `SITE_URL` is missing or incorrect

Fix:

- set `SITE_URL=https://your-production-domain.com`
