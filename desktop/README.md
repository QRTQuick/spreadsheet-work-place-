# PySide6 Studio

This folder contains an optional desktop companion for `электронная таблица`.

It is intentionally separate from the Vercel-hosted Flask app because PySide6 is a native desktop UI toolkit and does not run inside the browser or on Vercel serverless functions.

## Run locally

```powershell
pip install -r desktop/requirements.txt
python desktop/editor_studio.py
```

## What it includes

- premium dark desktop shell
- formula bar and spreadsheet grid
- import/export CSV
- left tool dock and right inspector dock
- a native place to experiment with richer “studio” UI ideas
