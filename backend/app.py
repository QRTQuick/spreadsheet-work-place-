from __future__ import annotations

import json
from functools import wraps
from pathlib import Path
from typing import Any, Callable

from flask import Flask, Response, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import load_settings
from .db import Database

ROOT_DIR = Path(__file__).resolve().parent.parent


def software_schema(site_url: str) -> str:
    payload = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "электронная таблица",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "description": (
            "A premium spreadsheet workspace with private per-user workspaces, CSV import/export, "
            "analytics, and a Flask + Neon architecture."
        ),
        "url": site_url,
    }
    return json.dumps(payload, ensure_ascii=False)


def join_site_url(site_url: str, path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{site_url.rstrip('/')}/{path.lstrip('/')}"


def create_app() -> Flask:
    settings = load_settings()
    app = Flask(
        __name__,
        template_folder=str(ROOT_DIR / "templates"),
        static_folder=str(ROOT_DIR / "public"),
        static_url_path="",
    )
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)
    app.config.update(
        SECRET_KEY=settings.secret_key,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=settings.secure_cookies,
        PERMANENT_SESSION_LIFETIME=settings.session_lifetime,
        PREFERRED_URL_SCHEME="https" if settings.site_url.startswith("https://") else "http",
    )

    database = Database(settings.database_url)
    startup_database_error: str | None = None
    try:
        database.init_schema()
    except Exception as exc:  # pragma: no cover
        startup_database_error = str(exc)

    def current_user() -> dict[str, Any] | None:
        user_id = session.get("user_id")
        if not user_id:
            return None
        return database.get_user_by_id(user_id)

    def canonical(path: str) -> str:
        return join_site_url(settings.site_url, path)

    def asset_url(path: str) -> str:
        return url_for("static", filename=f"static/{path}")

    def require_auth(view: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(view)
        def wrapped(*args, **kwargs):
            if g.current_user is None:
                if request.path.startswith("/api/"):
                    return jsonify({"ok": False, "error": "Authentication required."}), 401
                return redirect(url_for("login_page"))
            return view(*args, **kwargs)

        return wrapped

    def require_database(view: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(view)
        def wrapped(*args, **kwargs):
            if g.database_error:
                if request.path.startswith("/api/"):
                    return (
                        jsonify(
                            {
                                "ok": False,
                                "error": "Database is unavailable in the current environment.",
                                "detail": g.database_error,
                            }
                        ),
                        503,
                    )
                return (
                    render_template(
                        "service_unavailable.html",
                        title="Service Unavailable",
                        description="The app backend is temporarily unavailable.",
                        canonical_url=canonical("/service-unavailable"),
                        db_error=g.database_error,
                    ),
                    503,
                )
            return view(*args, **kwargs)

        return wrapped

    @app.before_request
    def load_user() -> None:
        g.database_error = startup_database_error
        if g.database_error:
            g.current_user = None
            return

        try:
            g.current_user = current_user()
        except Exception as exc:  # pragma: no cover
            g.current_user = None
            g.database_error = str(exc)

    @app.context_processor
    def inject_globals() -> dict[str, Any]:
        return {
            "app_name": settings.app_name,
            "site_url": settings.site_url,
            "current_user": g.current_user,
            "database_error": g.database_error,
            "asset_url": asset_url,
        }

    @app.get("/")
    def landing_page():
        return render_template(
            "index.html",
            title="Premium Online Spreadsheet Workspace",
            description=(
                "Build private spreadsheet workspaces, import data, track live metrics, "
                "and launch a polished business-ready workflow."
            ),
            canonical_url=canonical("/"),
            structured_data=software_schema(settings.site_url),
        )

    @app.get("/favicon.ico")
    def favicon():
        return redirect(asset_url("img/logo-mark.svg"), code=307)

    @app.get("/login")
    @require_database
    def login_page():
        if g.current_user:
            return redirect(url_for("dashboard_page"))
        return render_template(
            "login.html",
            title="Log In",
            description="Log in to your private spreadsheet workspace.",
            canonical_url=canonical("/login"),
        )

    @app.get("/signup")
    @require_database
    def signup_page():
        if g.current_user:
            return redirect(url_for("dashboard_page"))
        return render_template(
            "signup.html",
            title="Create Your Account",
            description="Create a secure account and launch your first workspace.",
            canonical_url=canonical("/signup"),
        )

    @app.get("/dashboard")
    @require_database
    @require_auth
    def dashboard_page():
        bootstrap = {
            "user": g.current_user,
            "workspaces": database.list_workspaces(g.current_user["id"]),
            "events": database.list_recent_events(g.current_user["id"]),
        }
        return render_template(
            "dashboard.html",
            title="Workspace Dashboard",
            description="Create and manage private spreadsheet workspaces.",
            canonical_url=canonical("/dashboard"),
            dashboard_bootstrap=bootstrap,
        )

    @app.get("/workspace/<slug>")
    @require_database
    @require_auth
    def workspace_page(slug: str):
        workspace = database.get_workspace_by_slug(g.current_user["id"], slug)
        if workspace is None:
            return redirect(url_for("dashboard_page"))

        return render_template(
            "workspace.html",
            title=f"{workspace['name']} Workspace",
            description=f"Edit and analyze the {workspace['name']} spreadsheet workspace.",
            canonical_url=canonical(f"/workspace/{workspace['slug']}"),
            workspace_bootstrap={"user": g.current_user, "workspace": workspace},
        )

    @app.post("/api/auth/signup")
    @require_database
    def signup_api():
        payload = request.get_json(silent=True) or request.form
        full_name = (payload.get("fullName") or payload.get("full_name") or "").strip()
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""

        if len(full_name) < 2:
            return jsonify({"ok": False, "error": "Please enter your full name."}), 400
        if "@" not in email or "." not in email:
            return jsonify({"ok": False, "error": "Please enter a valid email address."}), 400
        if len(password) < 8:
            return jsonify({"ok": False, "error": "Password must be at least 8 characters."}), 400
        if database.get_user_with_password(email):
            return jsonify({"ok": False, "error": "That email is already registered."}), 409

        user = database.create_user(full_name, email, generate_password_hash(password))
        session.permanent = True
        session["user_id"] = user["id"]

        database.create_workspace(
            user["id"],
            name=f"{full_name.split()[0]}'s Workspace",
            description="Your first private spreadsheet workspace.",
        )

        return jsonify({"ok": True, "redirect": url_for("dashboard_page"), "user": user})

    @app.post("/api/auth/login")
    @require_database
    def login_api():
        payload = request.get_json(silent=True) or request.form
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""

        user = database.get_user_with_password(email)
        if user is None or not check_password_hash(user["password_hash"], password):
            return jsonify({"ok": False, "error": "Incorrect email or password."}), 401

        session.permanent = True
        session["user_id"] = user["id"]

        return jsonify(
            {
                "ok": True,
                "redirect": url_for("dashboard_page"),
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "full_name": user["full_name"],
                    "created_at": user["created_at"],
                },
            }
        )

    @app.post("/api/auth/logout")
    def logout_api():
        session.clear()
        return jsonify({"ok": True, "redirect": url_for("landing_page")})

    @app.get("/api/auth/session")
    def session_api():
        if g.current_user is None:
            return jsonify({"ok": True, "authenticated": False})
        return jsonify({"ok": True, "authenticated": True, "user": g.current_user})

    @app.get("/api/health")
    def health_api():
        return jsonify(
            {
                "ok": g.database_error is None,
                "database": "ready" if g.database_error is None else "unavailable",
                "environment": settings.deployment_env,
                "on_vercel": settings.on_vercel,
                "site_url": settings.site_url,
                "detail": g.database_error,
            }
        ), (200 if g.database_error is None else 503)

    @app.get("/api/workspaces")
    @require_database
    @require_auth
    def workspaces_api():
        return jsonify(
            {
                "ok": True,
                "workspaces": database.list_workspaces(g.current_user["id"]),
                "events": database.list_recent_events(g.current_user["id"]),
            }
        )

    @app.post("/api/workspaces")
    @require_database
    @require_auth
    def create_workspace_api():
        payload = request.get_json(silent=True) or request.form
        name = (payload.get("name") or "").strip()
        description = (payload.get("description") or "").strip()

        if len(name) < 2:
            return jsonify({"ok": False, "error": "Workspace name must be at least 2 characters."}), 400

        workspace = database.create_workspace(g.current_user["id"], name=name, description=description)
        return jsonify(
            {
                "ok": True,
                "workspace": workspace,
                "redirect": url_for("workspace_page", slug=workspace["slug"]),
            }
        )

    @app.get("/api/workspaces/<workspace_id>")
    @require_database
    @require_auth
    def workspace_api(workspace_id: str):
        workspace = database.get_workspace(g.current_user["id"], workspace_id)
        if workspace is None:
            return jsonify({"ok": False, "error": "Workspace not found."}), 404
        return jsonify({"ok": True, "workspace": workspace})

    @app.post("/api/workspaces/<workspace_id>/sheet")
    @require_database
    @require_auth
    def save_sheet_api(workspace_id: str):
        payload = request.get_json(silent=True) or {}
        cells = payload.get("cells")

        if not isinstance(cells, list):
            return jsonify({"ok": False, "error": "Invalid spreadsheet payload."}), 400

        workspace = database.save_sheet(g.current_user["id"], workspace_id, cells)
        if workspace is None:
            return jsonify({"ok": False, "error": "Workspace not found."}), 404

        return jsonify({"ok": True, "workspace": workspace})

    @app.post("/api/workspaces/<workspace_id>/import")
    @require_database
    @require_auth
    def import_sheet_api(workspace_id: str):
        upload = request.files.get("sheet")
        if upload is None or not upload.filename:
            return jsonify({"ok": False, "error": "Please choose a CSV file to import."}), 400

        workspace = database.import_csv(g.current_user["id"], workspace_id, upload.read())
        if workspace is None:
            return jsonify({"ok": False, "error": "Workspace not found."}), 404

        return jsonify({"ok": True, "workspace": workspace})

    @app.get("/api/workspaces/<workspace_id>/export.csv")
    @require_database
    @require_auth
    def export_sheet_api(workspace_id: str):
        payload, slug = database.export_csv(g.current_user["id"], workspace_id)
        if payload is None or slug is None:
            return jsonify({"ok": False, "error": "Workspace not found."}), 404

        return Response(
            payload,
            mimetype="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{slug}.csv"'},
        )

    @app.get("/robots.txt")
    def robots():
        body = "\n".join(
            [
                "User-agent: *",
                "Allow: /",
                "Disallow: /dashboard",
                "Disallow: /workspace/",
                f"Sitemap: {canonical('/sitemap.xml')}",
            ]
        )
        return Response(body, mimetype="text/plain")

    @app.get("/sitemap.xml")
    def sitemap():
        pages = [
            {"loc": canonical("/"), "priority": "1.0"},
            {"loc": canonical("/login"), "priority": "0.7"},
            {"loc": canonical("/signup"), "priority": "0.8"},
        ]
        return Response(render_template("sitemap.xml", pages=pages), mimetype="application/xml")

    @app.get("/site.webmanifest")
    def manifest():
        payload = {
            "name": settings.app_name,
            "short_name": "электронная таблица",
            "start_url": "/",
            "display": "standalone",
            "background_color": "#0b1020",
            "theme_color": "#78ffd6",
            "icons": [
                {
                    "src": asset_url("img/logo-mark.svg"),
                    "sizes": "any",
                    "type": "image/svg+xml",
                    "purpose": "any",
                }
            ],
        }
        return jsonify(payload)

    return app
