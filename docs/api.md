# API Reference

This document describes the implemented HTTP routes and the current JSON contract used by the frontend.

## Notes

- Auth uses Flask session cookies
- Most `/api/workspaces/**` endpoints require an authenticated user
- When the database is unavailable, guarded routes return `503`
- Spreadsheet import currently supports CSV only

## Page routes

### `GET /`

Returns the landing page.

### `GET /login`

Returns the login page.

Blocked when:

- database is unavailable

### `GET /signup`

Returns the signup page.

Blocked when:

- database is unavailable

### `GET /dashboard`

Returns the authenticated dashboard page.

Requires:

- authenticated session
- available database

### `GET /workspace/<slug>`

Returns the authenticated workspace editor page for the current user.

Requires:

- authenticated session
- available database

## Auth API

### `POST /api/auth/signup`

Creates a new user and starter workspace.

Request body:

```json
{
  "fullName": "Alex Johnson",
  "email": "alex@example.com",
  "password": "StrongPass123!"
}
```

Success response:

```json
{
  "ok": true,
  "redirect": "/dashboard",
  "user": {
    "id": "...",
    "email": "alex@example.com",
    "full_name": "Alex Johnson",
    "created_at": "..."
  }
}
```

Validation rules:

- full name length must be at least 2
- email must look valid
- password length must be at least 8
- email must be unique

### `POST /api/auth/login`

Logs a user in and creates a session.

Request body:

```json
{
  "email": "alex@example.com",
  "password": "StrongPass123!"
}
```

Success response:

```json
{
  "ok": true,
  "redirect": "/dashboard",
  "user": {
    "id": "...",
    "email": "alex@example.com",
    "full_name": "Alex Johnson",
    "created_at": "..."
  }
}
```

### `POST /api/auth/logout`

Clears the current session.

Success response:

```json
{
  "ok": true,
  "redirect": "/"
}
```

### `GET /api/auth/session`

Returns the current authentication state.

Authenticated response:

```json
{
  "ok": true,
  "authenticated": true,
  "user": {
    "id": "...",
    "email": "...",
    "full_name": "...",
    "created_at": "..."
  }
}
```

Unauthenticated response:

```json
{
  "ok": true,
  "authenticated": false
}
```

## Health API

### `GET /api/health`

Returns deployment and database status.

Example response:

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

## Workspace API

### `GET /api/workspaces`

Returns the current user's workspaces and recent events.

Success response:

```json
{
  "ok": true,
  "workspaces": [],
  "events": []
}
```

### `POST /api/workspaces`

Creates a new workspace.

Request body:

```json
{
  "name": "Quarterly Planning Hub",
  "description": "Forecasting and reporting workspace"
}
```

Success response:

```json
{
  "ok": true,
  "workspace": {
    "id": "...",
    "name": "Quarterly Planning Hub",
    "slug": "quarterly-planning-hub",
    "description": "Forecasting and reporting workspace",
    "accent_color": "#78ffd6",
    "sheet": {
      "id": "...",
      "name": "Main Sheet",
      "row_count": 18,
      "col_count": 8,
      "cells": []
    }
  },
  "redirect": "/workspace/quarterly-planning-hub"
}
```

### `GET /api/workspaces/<workspace_id>`

Returns a single workspace for the authenticated owner.

### `POST /api/workspaces/<workspace_id>/sheet`

Saves the current spreadsheet grid.

Request body:

```json
{
  "cells": [
    ["Month", "MRR"],
    ["Jan", "14200"]
  ]
}
```

### `POST /api/workspaces/<workspace_id>/import`

Imports CSV data into the workspace sheet.

Request type:

- `multipart/form-data`

Expected file field:

- `sheet`

### `GET /api/workspaces/<workspace_id>/export.csv`

Downloads the current sheet as CSV.

## SEO and metadata routes

### `GET /robots.txt`

Returns crawler rules and the sitemap location.

### `GET /sitemap.xml`

Returns the current sitemap.

### `GET /site.webmanifest`

Returns the install manifest.

### `GET /favicon.ico`

Redirects to the SVG mark in `public/static/img/`.

## Error patterns

Common API responses:

### `401`

```json
{
  "ok": false,
  "error": "Authentication required."
}
```

### `404`

```json
{
  "ok": false,
  "error": "Workspace not found."
}
```

### `503`

```json
{
  "ok": false,
  "error": "Database is unavailable in the current environment.",
  "detail": "..."
}
```
