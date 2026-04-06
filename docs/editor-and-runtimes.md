# Editor And Runtimes

This document explains the spreadsheet editor itself and the roles of JavaScript, Go, Rust, and PySide6 in the project.

## Web editor overview

The browser editor is rendered on the workspace page and enhanced by client-side JavaScript.

Main editor features:

- editable spreadsheet grid
- active cell summary and formula bar
- add-row and add-column actions
- CSV import and export
- autosave to the backend
- visual modes
- zoom control
- tool state and inspector panels
- canvas-based overlays for a more studio-like feel

## Browser editor components

### Template layer

`templates/workspace.html` defines:

- the editor ribbon
- tool buttons
- visual mode selector
- zoom slider
- sheet stage
- overlay canvas
- inspector panel

### Behavior layer

`public/static/js/workspace.js` manages:

- active cell state
- grid rendering
- keyboard navigation
- formula bar syncing
- autosave scheduling
- import flow
- runtime-based graphics rendering
- visual mode changes
- zoom and swatch state

### Style layer

`public/static/css/site.css` provides:

- the editor chrome
- creative workbench layout
- sticky sheet headers
- overlay-ready sheet frame styling
- responsive behavior

## Runtime priority

The editor tries to use richer runtimes in this order:

1. Rust WebAssembly
2. Go WebAssembly with JavaScript visual fallback
3. JavaScript-only fallback

This logic lives in `public/static/js/wasm-loader.js`.

## JavaScript fallback

The fallback runtime is the guaranteed baseline.

It provides:

- spreadsheet statistics
- visual model generation
- canvas overlay rendering

This means the editor still works even when compiled wasm assets are not present.

## Go WebAssembly

Go currently provides spreadsheet statistics through `wasm/main.go`.

Current role:

- count filled cells
- count numeric cells
- compute numeric sum
- report max column count

Build helper:

```powershell
.\scripts\build_wasm.ps1
```

Output target:

```text
public/static/wasm/sheet_tools.wasm
```

## Rust WebAssembly

Rust is used for richer browser-side visual modeling.

Current role:

- parse serialized cell data
- compute statistics
- generate a visual model for overlay rendering
- prepare heat/intensity data for numeric cells

Source location:

```text
rust-wasm/sheet_graphics/
```

Build requirements:

- `wasm-pack`
- Rust target `wasm32-unknown-unknown`

Build helper:

```powershell
.\scripts\build_rust_wasm.ps1
```

Expected browser artifacts:

- `public/static/wasm/rust_sheet_graphics.js`
- `public/static/wasm/rust_sheet_graphics_bg.wasm`

## PySide6 desktop companion

PySide6 is included as a separate desktop studio in `desktop/`.

Why it is separate:

- PySide6 is a native desktop toolkit
- it does not run in the browser
- it does not run inside a Vercel-hosted Flask deployment

Current desktop companion responsibilities:

- native dark-shell spreadsheet interface
- formula bar
- basic grid editing
- CSV import and export
- tool dock and inspector dock

Run locally:

```powershell
pip install -r desktop/requirements.txt
python desktop/editor_studio.py
```

## Current limitations

The editor is a strong product foundation, but it is not yet a full spreadsheet engine.

Not yet implemented:

- true spreadsheet formulas and dependency recalculation
- collaborative multi-user editing
- permissions inside a workspace
- undo/redo history
- multi-sheet workbooks
- XLSX import/export
- cell formatting persistence beyond basic editing
- Photoshop-style freeform layers over cells

## Recommended next steps

If you want the editor to become more advanced, the most valuable additions would be:

- frozen rows and columns
- drag selection and fill handles
- comments and notes
- formula parser and recalculation engine
- richer formatting tools
- workbook tabs
- audit/version history
- real-time collaboration
