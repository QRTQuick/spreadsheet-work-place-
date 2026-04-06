from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    app_name: str
    secret_key: str
    database_url: str
    site_url: str
    secure_cookies: bool
    session_lifetime: timedelta
    deployment_env: str
    on_vercel: bool


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _resolve_site_url() -> str:
    explicit = os.getenv("SITE_URL")
    if explicit:
        return explicit.rstrip("/")

    production_host = os.getenv("VERCEL_PROJECT_PRODUCTION_URL")
    if production_host:
        return f"https://{production_host}"

    deployment_host = os.getenv("VERCEL_URL")
    if deployment_host:
        return f"https://{deployment_host}"

    return "http://127.0.0.1:5000"


def _resolve_secure_cookies() -> bool:
    if "SECURE_COOKIES" in os.environ:
        return _bool_env("SECURE_COOKIES", default=True)
    return os.getenv("VERCEL") == "1"


def load_settings() -> Settings:
    return Settings(
        app_name="электронная таблица",
        secret_key=os.getenv("SECRET_KEY", "dev-secret-key"),
        database_url=os.getenv("DATABASE_URL", "sqlite:///local-dev.db"),
        site_url=_resolve_site_url(),
        secure_cookies=_resolve_secure_cookies(),
        session_lifetime=timedelta(days=7),
        deployment_env=os.getenv("VERCEL_ENV", os.getenv("FLASK_ENV", "development")),
        on_vercel=os.getenv("VERCEL") == "1",
    )
