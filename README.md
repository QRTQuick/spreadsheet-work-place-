# электронная таблица

`электронная таблица` is a polished multi-page spreadsheet workspace built with HTML, CSS, JavaScript, Flask, Neon-ready PostgreSQL support, and a small Go WebAssembly helper pipeline. The project is now structured for Vercel hosting with Flask as the backend entrypoint and `public/static` as the CDN-served asset directory.

## What is included

- Premium landing page with strong SEO metadata, structured data, animated sections, and conversion-focused calls to action
- Multi-page app flow: landing page, login, signup, dashboard, and spreadsheet workspace
- Private per-user workspaces with session-based authentication
- CSV import and export for spreadsheet data
- Flask API routes for auth, workspace creation, autosave, import, and export
- `/api/health` for deployment and database checks
- Neon-ready database support via `DATABASE_URL`
- `robots.txt`, `sitemap.xml`, and a web manifest for search and installability
- Go WebAssembly source for spreadsheet stats with a JavaScript fallback when the compiled wasm bundle is not present
- Rust/WASM editor graphics scaffold for richer browser-side rendering
- Optional PySide6 desktop studio for native UI experiments
- Vercel-aware production URL detection via `VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_URL`

## Project structure

- `app.py`: Flask entrypoint for local use and Vercel deployment
- `backend/`: app factory, settings, and database layer
- `public/static/`: CSS, JavaScript, SVG assets, and wasm loader files served directly by Vercel
- `templates/`: server-rendered HTML pages
- `sql/schema.sql`: portable schema for SQLite dev or Neon/PostgreSQL production
- `wasm/main.go`: Go source for the WebAssembly helper
- `rust-wasm/sheet_graphics/`: Rust WebAssembly crate for editor graphics
- `desktop/`: optional PySide6 desktop companion
- `scripts/build_wasm.ps1`: copies `wasm_exec.js` and compiles the Go module
- `scripts/build_rust_wasm.ps1`: builds the Rust wasm bundle into `public/static/wasm/`

## Local setup

1. Create a virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env` and set a real `SECRET_KEY`.
4. For local SQLite, set `DATABASE_URL=sqlite:///local-dev.db`.
5. For Neon, replace `DATABASE_URL` with your Neon connection string.
6. Run the app with `python app.py`.

The app auto-loads `.env` with `python-dotenv`.

## Vercel deployment

1. Push the repository to GitHub.
2. Import the repo into Vercel.
3. Add these environment variables in the Vercel dashboard:
   - `DATABASE_URL`
   - `SECRET_KEY`
   - `SITE_URL`
   - `SECURE_COOKIES=1`
4. Optionally enable automatically exposed system environment variables in Vercel so the app can detect production and preview URLs.
5. Deploy.

Recommended production values:

- `SITE_URL=https://your-production-domain.com`
- `DATABASE_URL=postgresql://...` using the Neon pooled connection string

The Flask app is Vercel-aware:

- it reads `VERCEL_PROJECT_PRODUCTION_URL` for stable canonical URLs and OG image links
- it falls back to `VERCEL_URL` for preview deployments
- it enables secure cookies automatically on Vercel unless you override `SECURE_COOKIES`
- it serves frontend assets from `public/static`, which Vercel can cache and deliver directly

## Neon notes

The backend uses `psycopg` and works with Neon PostgreSQL connection strings. The schema is initialized automatically when the app starts, so the required tables are created on first boot.

If a live Neon connection string was pasted into chat or shared publicly, rotate it in Neon before going live.

## Health checks

Use this endpoint after deployment:

```text
/api/health
```

It returns the deployment environment, detected site URL, and whether the database is currently reachable.

## Rust / WebAssembly graphics

The browser editor now prefers a Rust/WASM graphics engine for spreadsheet overlays and falls back to JavaScript when the Rust bundle is not present.

Build requirements:

- `wasm-pack`
- the `wasm32-unknown-unknown` Rust target

Build command:

```powershell
.\scripts\build_rust_wasm.ps1
```

## Go / WebAssembly

Go is not installed in this workspace right now, so the browser will use the JavaScript fallback until you compile the wasm helper.

After installing Go, run:

```powershell
.\scripts\build_wasm.ps1
```

That script will:

- copy `wasm_exec.js` into `public/static/wasm/`
- compile `wasm/main.go` into `public/static/wasm/sheet_tools.wasm`

## PySide6 desktop studio

PySide6 does not run on Vercel or in the browser, so it is included as a separate native desktop companion.

Run it locally:

```powershell
pip install -r desktop/requirements.txt
python desktop/editor_studio.py
```

## Production notes

- Set `SECURE_COOKIES=1` behind HTTPS
- Use a strong `SECRET_KEY`
- Point `SITE_URL` to your public domain so sitemap and canonicals are correct
- Replace SQLite with Neon/PostgreSQL in production
- Keep frontend assets inside `public/static` for Vercel
