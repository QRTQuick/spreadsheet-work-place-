from __future__ import annotations

import csv
import io
import json
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any
from uuid import uuid4

try:
    import psycopg
    from psycopg.rows import dict_row
except ModuleNotFoundError:  # pragma: no cover
    psycopg = None
    dict_row = None

ROOT_DIR = Path(__file__).resolve().parent.parent
SCHEMA_FILE = ROOT_DIR / "sql" / "schema.sql"


def blank_sheet(rows: int = 18, cols: int = 8) -> list[list[str]]:
    return [["" for _ in range(cols)] for _ in range(rows)]


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "workspace"


def normalize_cells(
    cells: list[list[Any]] | None,
    min_rows: int = 18,
    min_cols: int = 8,
    max_rows: int = 120,
    max_cols: int = 40,
) -> list[list[str]]:
    if not cells:
        return blank_sheet(min_rows, min_cols)

    trimmed_rows = cells[:max_rows]
    normalized: list[list[str]] = []
    for row in trimmed_rows:
        safe_row = [str(cell)[:220] if cell is not None else "" for cell in row[:max_cols]]
        normalized.append(safe_row)

    width = max((len(row) for row in normalized), default=min_cols)
    width = max(width, min_cols)

    for row in normalized:
        row.extend([""] * (width - len(row)))

    while len(normalized) < min_rows:
        normalized.append([""] * width)

    return normalized


class Database:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url
        self.is_sqlite = database_url.startswith("sqlite:///")
        self.sqlite_path: Path | None = None

        if self.is_sqlite:
            raw_path = database_url.removeprefix("sqlite:///")
            self.sqlite_path = (ROOT_DIR / raw_path).resolve()
            self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connection(self):
        if self.is_sqlite:
            if self.sqlite_path is None:
                raise RuntimeError("SQLite path is not configured.")
            conn = sqlite3.connect(self.sqlite_path)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON;")
        else:
            if psycopg is None:
                raise RuntimeError(
                    "psycopg is required for PostgreSQL/Neon connections. "
                    "Install dependencies with `pip install -r requirements.txt`."
                )
            conn = psycopg.connect(self.database_url, row_factory=dict_row)

        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def init_schema(self) -> None:
        schema = SCHEMA_FILE.read_text(encoding="utf-8")
        with self.connection() as conn:
            if self.is_sqlite:
                conn.executescript(schema)
            else:
                statements = [statement.strip() for statement in schema.split(";") if statement.strip()]
                with conn.cursor() as cursor:
                    for statement in statements:
                        cursor.execute(statement)

    def fetch_one(self, query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        with self.connection() as conn:
            return self._fetch_one(conn, query, params)

    def fetch_all(self, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self.connection() as conn:
            return self._fetch_all(conn, query, params)

    def _sql(self, query: str) -> str:
        return query if self.is_sqlite else query.replace("?", "%s")

    def _fetch_one(self, conn, query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        if self.is_sqlite:
            row = conn.execute(query, params).fetchone()
            return dict(row) if row else None
        with conn.cursor() as cursor:
            cursor.execute(self._sql(query), params)
            row = cursor.fetchone()
            return dict(row) if row else None

    def _fetch_all(self, conn, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        if self.is_sqlite:
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]
        with conn.cursor() as cursor:
            cursor.execute(self._sql(query), params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def _execute(self, conn, query: str, params: tuple[Any, ...] = ()) -> None:
        if self.is_sqlite:
            conn.execute(query, params)
            return
        with conn.cursor() as cursor:
            cursor.execute(self._sql(query), params)

    def _decode_cells(self, raw: str | None) -> list[list[str]]:
        if not raw:
            return blank_sheet()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return blank_sheet()
        return normalize_cells(parsed)

    def _serialize_cells(self, cells: list[list[Any]]) -> tuple[str, int, int]:
        normalized = normalize_cells(cells)
        row_count = len(normalized)
        col_count = max((len(row) for row in normalized), default=0)
        return json.dumps(normalized, ensure_ascii=False), row_count, col_count

    def _log_event(
        self,
        conn,
        *,
        user_id: str,
        workspace_id: str | None,
        action: str,
        detail: str,
    ) -> None:
        self._execute(
            conn,
            """
            INSERT INTO workspace_events (id, user_id, workspace_id, action, detail)
            VALUES (?, ?, ?, ?, ?)
            """,
            (str(uuid4()), user_id, workspace_id, action, detail),
        )

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        return self.fetch_one(
            """
            SELECT id, email, full_name, created_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        )

    def get_user_with_password(self, email: str) -> dict[str, Any] | None:
        return self.fetch_one(
            """
            SELECT id, email, full_name, password_hash, created_at
            FROM users
            WHERE email = ?
            """,
            (email.lower().strip(),),
        )

    def create_user(self, full_name: str, email: str, password_hash: str) -> dict[str, Any]:
        user_id = str(uuid4())
        clean_email = email.lower().strip()

        with self.connection() as conn:
            self._execute(
                conn,
                """
                INSERT INTO users (id, full_name, email, password_hash)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, full_name.strip(), clean_email, password_hash),
            )
            self._log_event(
                conn,
                user_id=user_id,
                workspace_id=None,
                action="account.created",
                detail="Created a new account.",
            )

        user = self.get_user_by_id(user_id)
        if user is None:
            raise RuntimeError("User creation failed.")
        return user

    def list_recent_events(self, user_id: str, limit: int = 6) -> list[dict[str, Any]]:
        return self.fetch_all(
            """
            SELECT id, workspace_id, action, detail, created_at
            FROM workspace_events
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        )

    def _workspace_payload(self, row: dict[str, Any]) -> dict[str, Any]:
        cells = self._decode_cells(row.get("cells_json"))
        return {
            "id": row["id"],
            "name": row["name"],
            "slug": row["slug"],
            "description": row.get("description") or "",
            "accent_color": row.get("accent_color") or "#78ffd6",
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "sheet": {
                "id": row.get("sheet_id"),
                "name": row.get("sheet_name") or "Main Sheet",
                "row_count": row.get("row_count") or len(cells),
                "col_count": row.get("col_count") or (len(cells[0]) if cells else 0),
                "cells": cells,
            },
        }

    def _workspace_slug(self, conn, user_id: str, name: str) -> str:
        base = slugify(name)
        candidate = base
        counter = 2

        rows = self._fetch_all(
            conn,
            "SELECT slug FROM workspaces WHERE user_id = ? AND slug LIKE ?",
            (user_id, f"{base}%"),
        )
        existing = {row["slug"] for row in rows}

        while candidate in existing:
            candidate = f"{base}-{counter}"
            counter += 1
        return candidate

    def list_workspaces(self, user_id: str) -> list[dict[str, Any]]:
        rows = self.fetch_all(
            """
            SELECT
                workspaces.id,
                workspaces.name,
                workspaces.slug,
                workspaces.description,
                workspaces.accent_color,
                workspaces.created_at,
                workspaces.updated_at,
                sheets.id AS sheet_id,
                sheets.name AS sheet_name,
                sheets.cells_json,
                sheets.row_count,
                sheets.col_count
            FROM workspaces
            LEFT JOIN sheets ON sheets.workspace_id = workspaces.id
            WHERE workspaces.user_id = ?
            ORDER BY workspaces.updated_at DESC, workspaces.created_at DESC
            """,
            (user_id,),
        )
        return [self._workspace_payload(row) for row in rows]

    def get_workspace(self, user_id: str, workspace_id: str) -> dict[str, Any] | None:
        row = self.fetch_one(
            """
            SELECT
                workspaces.id,
                workspaces.name,
                workspaces.slug,
                workspaces.description,
                workspaces.accent_color,
                workspaces.created_at,
                workspaces.updated_at,
                sheets.id AS sheet_id,
                sheets.name AS sheet_name,
                sheets.cells_json,
                sheets.row_count,
                sheets.col_count
            FROM workspaces
            LEFT JOIN sheets ON sheets.workspace_id = workspaces.id
            WHERE workspaces.user_id = ? AND workspaces.id = ?
            """,
            (user_id, workspace_id),
        )
        return self._workspace_payload(row) if row else None

    def get_workspace_by_slug(self, user_id: str, slug: str) -> dict[str, Any] | None:
        row = self.fetch_one(
            """
            SELECT
                workspaces.id,
                workspaces.name,
                workspaces.slug,
                workspaces.description,
                workspaces.accent_color,
                workspaces.created_at,
                workspaces.updated_at,
                sheets.id AS sheet_id,
                sheets.name AS sheet_name,
                sheets.cells_json,
                sheets.row_count,
                sheets.col_count
            FROM workspaces
            LEFT JOIN sheets ON sheets.workspace_id = workspaces.id
            WHERE workspaces.user_id = ? AND workspaces.slug = ?
            """,
            (user_id, slug),
        )
        return self._workspace_payload(row) if row else None

    def create_workspace(
        self,
        user_id: str,
        name: str,
        description: str = "",
        accent_color: str = "#78ffd6",
    ) -> dict[str, Any]:
        workspace_id = str(uuid4())
        sheet_id = str(uuid4())
        sheet_blob, row_count, col_count = self._serialize_cells(blank_sheet())

        with self.connection() as conn:
            slug = self._workspace_slug(conn, user_id, name)
            self._execute(
                conn,
                """
                INSERT INTO workspaces (id, user_id, name, slug, description, accent_color)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (workspace_id, user_id, name.strip(), slug, description.strip(), accent_color),
            )
            self._execute(
                conn,
                """
                INSERT INTO sheets (id, workspace_id, name, cells_json, row_count, col_count)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (sheet_id, workspace_id, "Main Sheet", sheet_blob, row_count, col_count),
            )
            self._log_event(
                conn,
                user_id=user_id,
                workspace_id=workspace_id,
                action="workspace.created",
                detail=f"Created workspace '{name.strip()}'.",
            )

        workspace = self.get_workspace(user_id, workspace_id)
        if workspace is None:
            raise RuntimeError("Workspace creation failed.")
        return workspace

    def save_sheet(
        self,
        user_id: str,
        workspace_id: str,
        cells: list[list[Any]],
        *,
        activity_action: str | None = None,
        activity_detail: str | None = None,
    ) -> dict[str, Any] | None:
        workspace = self.get_workspace(user_id, workspace_id)
        if workspace is None:
            return None

        serialized, row_count, col_count = self._serialize_cells(cells)

        with self.connection() as conn:
            self._execute(
                conn,
                """
                UPDATE sheets
                SET cells_json = ?, row_count = ?, col_count = ?, updated_at = CURRENT_TIMESTAMP
                WHERE workspace_id = ?
                """,
                (serialized, row_count, col_count, workspace_id),
            )
            self._execute(
                conn,
                """
                UPDATE workspaces
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (workspace_id,),
            )

            if activity_action and activity_detail:
                self._log_event(
                    conn,
                    user_id=user_id,
                    workspace_id=workspace_id,
                    action=activity_action,
                    detail=activity_detail,
                )

        return self.get_workspace(user_id, workspace_id)

    def import_csv(self, user_id: str, workspace_id: str, payload: bytes) -> dict[str, Any] | None:
        text = payload.decode("utf-8-sig", errors="ignore")
        reader = csv.reader(io.StringIO(text))
        cells = [row for row in reader]
        return self.save_sheet(
            user_id,
            workspace_id,
            cells,
            activity_action="sheet.imported",
            activity_detail="Imported spreadsheet data from CSV.",
        )

    def export_csv(self, user_id: str, workspace_id: str) -> tuple[str, str] | tuple[None, None]:
        workspace = self.get_workspace(user_id, workspace_id)
        if workspace is None:
            return None, None

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerows(workspace["sheet"]["cells"])
        return buffer.getvalue(), workspace["slug"]
