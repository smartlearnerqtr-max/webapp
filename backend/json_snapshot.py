from __future__ import annotations

import argparse
import json
import os
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import Date, DateTime, select

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SNAPSHOT_PATH = BASE_DIR / "data" / "demo_snapshot.json"
SNAPSHOT_VERSION = 1
SKIP_TABLES = {"realtime_events", "server_logs", "user_ai_settings"}


def _table_names() -> set[str]:
    database = _get_db()
    return {table.name for table in database.metadata.sorted_tables}


def _get_db():
    from app.extensions import db

    return db


def _serialize_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _deserialize_value(column, value: Any) -> Any:
    if value is None:
        return None
    if isinstance(column.type, DateTime) and isinstance(value, str):
        return datetime.fromisoformat(value)
    if isinstance(column.type, Date) and isinstance(value, str):
        return date.fromisoformat(value)
    return value


def _row_to_json(row: dict[str, Any]) -> dict[str, Any]:
    return {key: _serialize_value(value) for key, value in row.items()}


def _json_to_row(table, row: dict[str, Any]) -> dict[str, Any]:
    columns = {column.name: column for column in table.columns}
    return {
        key: _deserialize_value(columns[key], value)
        for key, value in row.items()
        if key in columns
    }


def export_snapshot(snapshot_path: Path = DEFAULT_SNAPSHOT_PATH) -> dict[str, int]:
    database = _get_db()
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    tables_payload: dict[str, list[dict[str, Any]]] = {}
    row_counts: dict[str, int] = {}

    for table in database.metadata.sorted_tables:
        if table.name in SKIP_TABLES:
            continue
        rows = database.session.execute(select(table)).mappings().all()
        payload_rows = [_row_to_json(dict(row)) for row in rows]
        tables_payload[table.name] = payload_rows
        row_counts[table.name] = len(payload_rows)

    snapshot = {
        "version": SNAPSHOT_VERSION,
        "exported_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "tables": tables_payload,
    }
    snapshot_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    return row_counts


def restore_snapshot(snapshot_path: Path = DEFAULT_SNAPSHOT_PATH) -> dict[str, int]:
    database = _get_db()
    if not snapshot_path.exists():
        raise FileNotFoundError(f"JSON snapshot not found: {snapshot_path}")

    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    raw_tables = snapshot.get("tables")
    if not isinstance(raw_tables, dict):
        raise ValueError("Invalid JSON snapshot: missing object field 'tables'.")

    database.create_all()
    known_table_names = _table_names()
    unknown_table_names = sorted(set(raw_tables) - known_table_names)
    if unknown_table_names:
        print(f"Skipping unknown snapshot table(s): {', '.join(unknown_table_names)}")

    row_counts: dict[str, int] = {}
    with database.engine.begin() as connection:
        if database.engine.dialect.name == "sqlite":
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")

        for table in reversed(database.metadata.sorted_tables):
            if table.name in SKIP_TABLES:
                continue
            connection.execute(table.delete())

        for table in database.metadata.sorted_tables:
            if table.name in SKIP_TABLES:
                continue
            rows = raw_tables.get(table.name, [])
            if not rows:
                row_counts[table.name] = 0
                continue
            if not isinstance(rows, list):
                raise ValueError(f"Invalid JSON snapshot: table '{table.name}' must be a list.")
            payload = [_json_to_row(table, row) for row in rows if isinstance(row, dict)]
            if payload:
                connection.execute(table.insert(), payload)
            row_counts[table.name] = len(payload)

        if database.engine.dialect.name == "sqlite":
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")

    database.session.remove()
    return row_counts


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export or restore the demo database JSON snapshot.")
    parser.add_argument("action", choices=["export", "restore"])
    parser.add_argument(
        "--snapshot",
        default=os.getenv("JSON_SNAPSHOT_PATH") or str(DEFAULT_SNAPSHOT_PATH),
        help="Path to the JSON snapshot file.",
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="Optional database URL override, for example sqlite:///instance/dev.db.",
    )
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url

    from app import create_app
    from app import models  # noqa: F401  # Register all models before touching metadata.

    app = create_app()
    snapshot_path = Path(args.snapshot)
    if not snapshot_path.is_absolute():
        snapshot_path = BASE_DIR / snapshot_path

    with app.app_context():
        if args.action == "export":
            row_counts = export_snapshot(snapshot_path)
            verb = "Exported"
        else:
            row_counts = restore_snapshot(snapshot_path)
            verb = "Restored"

    total_rows = sum(row_counts.values())
    print(f"{verb} JSON snapshot: {snapshot_path}")
    print(f"Total rows: {total_rows}")
    for table_name, row_count in row_counts.items():
        print(f"  - {table_name}: {row_count}")


if __name__ == "__main__":
    main()
