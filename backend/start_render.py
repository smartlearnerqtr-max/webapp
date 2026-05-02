from __future__ import annotations

import os

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from waitress import serve


def _bool_env(name: str, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _maybe_fallback_to_sqlite() -> None:
    if not _bool_env("RENDER_SQLITE_FALLBACK", True):
        return

    raw_database_url = (os.getenv("DATABASE_URL") or "").strip()
    if not raw_database_url:
        os.environ["DATABASE_URL"] = "sqlite:///instance/dev.db"
        os.environ["SYNC_DEPLOY_SNAPSHOT"] = "false"
        print("DATABASE_URL is empty. Falling back to local SQLite snapshot.")
        return

    from app.config import _normalize_database_url

    normalized_database_url = _normalize_database_url(raw_database_url)

    try:
        engine = create_engine(normalized_database_url, future=True, pool_pre_ping=True)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        engine.dispose()
        print("Primary database connection is available.")
    except SQLAlchemyError as error:
        print(f"Primary database connection failed: {error}")
        os.environ["DATABASE_URL"] = "sqlite:///instance/dev.db"
        os.environ["SYNC_DEPLOY_SNAPSHOT"] = "false"
        print("Falling back to local SQLite snapshot for startup.")


def main() -> None:
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "10000"))
    threads = int(os.getenv("WAITRESS_THREADS", "8"))

    _maybe_fallback_to_sqlite()

    from init_and_seed import run_init_and_seed
    from run import app

    print("Running database init before serving...")
    run_init_and_seed()
    print(f"Starting Waitress on {host}:{port} with {threads} thread(s)...")
    serve(app, host=host, port=port, threads=threads)


if __name__ == "__main__":
    main()
